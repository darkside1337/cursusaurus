import { z } from "zod";
import { getServerSession } from "@/lib/auth";
import { ActionError, logActionError } from "./action-errors";

export type SessionUser = NonNullable<Awaited<ReturnType<typeof getServerSession>>>["user"];

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export function formatZodError(error: z.ZodError): string {
  const first = error.issues[0];
  return first?.message || "Invalid input";
}

interface SafeActionConfig<TSchema extends z.ZodTypeAny, TData> {
  actionName: string;
  schema?: TSchema;
  input?: unknown;
  handler: (data: z.infer<TSchema>, user: SessionUser) => Promise<TData>;
}

export async function safeAction<TSchema extends z.ZodTypeAny, TData>(
  config: SafeActionConfig<TSchema, TData>
): Promise<ActionResult<TData>> {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return { success: false, error: "Authentication required" };
    }

    let parsedData = config.input as z.infer<TSchema>;
    if (config.schema) {
      const result = config.schema.safeParse(config.input);
      if (!result.success) {
        return { success: false, error: formatZodError(result.error) };
      }
      parsedData = result.data;
    }

    const data = await config.handler(parsedData, session.user as SessionUser);
    return { success: true, data };
  } catch (err: unknown) {
    if (err instanceof ActionError) {
      return { success: false, error: err.message };
    }

    logActionError(config.actionName, err);
    return { success: false, error: "An unexpected error occurred. Please try again." };
  }
}

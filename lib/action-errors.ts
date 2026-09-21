export class ActionError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = "ActionError";
  }
}

export function isActionError(err: unknown): err is ActionError {
  return err instanceof ActionError;
}

export function logActionError(
  actionName: string,
  err: unknown,
  context?: Record<string, unknown>
): void {
  const errorInfo =
    err instanceof Error
      ? { name: err.name, message: err.message }
      : { message: "Unknown error" };

  console.error(`[ServerAction:${actionName}]`, {
    ...context,
    error: errorInfo,
    timestamp: new Date().toISOString(),
  });
}

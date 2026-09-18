import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth";
import { getActiveSubscriptionByUserId } from "@/features/subscriptions/queries";
import { listPurchasesByUserWithCourse } from "@/features/purchases/queries";
import { BillingContent } from "./billing-content";

export default async function BillingPage() {
  const session = await getServerSession();
  if (!session?.user) {
    redirect("/login?callbackUrl=/billing");
  }

  const [subscription, purchases] = await Promise.all([
    getActiveSubscriptionByUserId(session.user.id),
    listPurchasesByUserWithCourse(session.user.id),
  ]);

  return (
    <BillingContent
      user={session.user}
      subscription={subscription}
      purchases={purchases}
    />
  );
}

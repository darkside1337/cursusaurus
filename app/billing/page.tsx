import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth";
import { getLatestSubscriptionByUserId } from "@/features/subscriptions/queries";
import { listPurchasesByUserWithCourse } from "@/features/purchases/queries";
import { MarketplaceNav } from "@/components/marketplace-nav";
import { BillingContent } from "./billing-content";

export default async function BillingPage() {
  const session = await getServerSession();
  if (!session?.user) {
    redirect("/login?callbackUrl=/billing");
  }

  const [subscription, purchases] = await Promise.all([
    getLatestSubscriptionByUserId(session.user.id),
    listPurchasesByUserWithCourse(session.user.id),
  ]);

  return (
    <div className="min-h-screen bg-paper-white flex flex-col justify-between">
      <MarketplaceNav user={session.user} />
      <main className="flex-1 w-full">
        <BillingContent
          user={session.user}
          subscription={subscription}
          purchases={purchases}
        />
      </main>
    </div>
  );
}

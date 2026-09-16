import { getServerSession } from "@/lib/auth";
import { MarketplaceNav } from "@/components/marketplace-nav";

export default async function MarketplaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();

  return (
    <div className="min-h-screen bg-paper-white flex flex-col">
      <MarketplaceNav user={session?.user} />
      <main className="flex-1 w-full">{children}</main>
    </div>
  );
}

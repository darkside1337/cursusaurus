import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth";
import { DashboardNav } from "@/components/dashboard-nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();

  if (!session?.user) {
    redirect("/login?callbackUrl=/dashboard/courses");
  }

  return (
    <div className="min-h-screen bg-fog-white flex flex-col">
      <DashboardNav user={session.user} />
      <main className="flex-1 w-full bg-fog-white">{children}</main>
    </div>
  );
}

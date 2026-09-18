import Link from "next/link";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { OrderStatusView } from "./order-status-view";

interface SuccessPageProps {
  searchParams: Promise<{ session_id?: string }>;
}

export default async function CheckoutSuccessPage({ searchParams }: SuccessPageProps) {
  const { session_id } = await searchParams;

  return (
    <div className="min-h-screen bg-fog-white flex flex-col justify-between">
      <header className="w-full border-b border-hairline bg-paper-white">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="font-serif text-xl sm:text-2xl text-ink-black tracking-tight hover:opacity-80 transition-opacity"
          >
            Cursusaurus
          </Link>
          <Button
            variant="ghost"
            size="sm"
            render={<Link href="/" />}
            className="text-slate-gray hover:text-ink-black gap-1.5 font-normal text-xs"
          >
            <ArrowLeft className="size-3.5" />
            <span>Catalog</span>
          </Button>
        </div>
      </header>

      <main className="w-full max-w-[720px] mx-auto px-4 sm:px-6 py-12 sm:py-20 flex-1 flex flex-col justify-center">
        {!session_id ? (
          <Card className="p-8 sm:p-10 bg-paper-white rounded-cards border border-hairline shadow-subtle flex flex-col items-center text-center gap-6">
            <div className="size-12 rounded-full bg-mist-gray flex items-center justify-center text-slate-gray">
              <AlertCircle className="size-6 text-slate-gray" />
            </div>
            <div className="flex flex-col gap-2">
              <h1 className="font-serif text-2xl sm:text-3xl text-ink-black font-normal">
                Missing Order Identifier
              </h1>
              <p className="text-slate-gray text-sm leading-relaxed max-w-md">
                No checkout session reference was provided. If you completed a purchase, you can check your active enrollments directly in your library.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                render={<Link href="/" />}
                className="rounded-full bg-ink-black text-paper-white px-6 text-sm"
              >
                Return to Catalog
              </Button>
              <Button
                variant="ghost"
                render={<Link href="/library" />}
                className="rounded-full text-slate-gray hover:text-ink-black text-sm"
              >
                Go to My Library
              </Button>
            </div>
          </Card>
        ) : (
          <OrderStatusView sessionId={session_id} />
        )}
      </main>

      <footer className="w-full border-t border-hairline bg-paper-white py-6">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-gray">
          <span>&copy; {new Date().getFullYear()} Cursusaurus. All monographs and lectures protected.</span>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-ink-black transition-colors">Catalog</Link>
            <Link href="/billing" className="hover:text-ink-black transition-colors">Billing</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

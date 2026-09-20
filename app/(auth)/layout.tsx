import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Sign In — Cursusaurus",
  description: "Sign in to access your courses and monographs.",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-fog-white font-sohne text-ink-black min-h-svh flex flex-col justify-between selection:bg-ink-black selection:text-paper-white">
      <header className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 pt-6 flex items-center justify-between relative">
        <Button
          variant="ghost"
          size="sm"
          render={<Link href="/" />}
          aria-label="Back to Prospectus"
          className="rounded-full px-2.5 sm:px-3 text-slate-gray hover:text-ink-black font-sohne text-xs z-10 -ml-2 gap-1.5 h-9"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" />
          <span className="hidden sm:inline">Back to Prospectus</span>
        </Button>
        <Link
          href="/"
          className="font-signifier text-subheading tracking-tight text-ink-black absolute left-1/2 -translate-x-1/2 hover:opacity-85 transition-opacity"
        >
          Cursusaurus
        </Link>
        <div className="w-9 sm:w-[120px]" />
      </header>
      <main className="w-full flex-1 flex flex-col items-center justify-center max-w-[1200px] mx-auto px-4 sm:px-6 py-12 md:py-20">
        {children}
      </main>
      <footer className="w-full max-w-[1200px] mx-auto px-6 pb-6 text-center font-sohne text-caption text-slate-gray">
        <p>© Cursusaurus Editorial Education. Deliberate, quiet learning.</p>
      </footer>
    </div>
  );
}

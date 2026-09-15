import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

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
    <div className="bg-fog-white font-sans text-ink-black min-h-svh flex flex-col justify-between selection:bg-blush-peach selection:text-sienna-brown">
      <header className="w-full max-w-[1200px] mx-auto px-6 pt-6 flex items-center justify-between relative">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-caption text-slate-gray hover:text-ink-black transition-colors z-10"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" />
          <span className="hidden sm:inline">Back to Prospectus</span>
          <span className="sm:hidden">Prospectus</span>
        </Link>
        <Link
          href="/"
          className="font-serif text-subheading tracking-tight text-ink-black absolute left-1/2 -translate-x-1/2"
        >
          Cursusaurus
        </Link>
        <div className="w-[80px] sm:w-[120px]" />
      </header>
      <main className="w-full flex-1 flex flex-col items-center justify-center max-w-[1200px] mx-auto px-6 py-12 md:py-20">
        {children}
      </main>
      <footer className="w-full max-w-[1200px] mx-auto px-6 pb-6 text-center text-caption text-slate-gray">
        <p>© Cursusaurus Editorial Education. Deliberate, quiet learning.</p>
      </footer>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function GoogleIcon({ className = "size-[18px]" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        fill="#EA4335"
      />
    </svg>
  );
}

function GitHubIcon({ className = "size-[18px]" }: { className?: string }) {
  return (
    <svg
      className={`${className} fill-current`}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

export default function LoginPage() {
  const [loadingProvider, setLoadingProvider] = useState<
    "google" | "github" | null
  >(null);

  const handleSignIn = async (provider: "google" | "github") => {
    try {
      setLoadingProvider(provider);
      await authClient.signIn.social({
        provider,
        callbackURL: "/",
      });
    } catch (err) {
      setLoadingProvider(null);
      toast.error(
        err instanceof Error ? err.message : "Failed to initiate sign in"
      );
    }
  };

  return (
    <div className="flex flex-col w-full items-center justify-center font-sohne">
      <Card className="w-full max-w-[420px] bg-paper-white rounded-cards p-8 sm:p-11 shadow-subtle border border-black/[0.05] flex flex-col items-center text-center relative overflow-hidden transition-all duration-300">
        {/* Blush-peach glow per Stitch design spec */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-32 bg-blush-peach/30 rounded-full blur-3xl pointer-events-none" />

        {/* Eyebrow */}
        <div className="mb-2.5 flex items-center justify-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-sienna-brown/40" />
          <span className="text-[11px] uppercase tracking-widest text-slate-gray font-medium">
            Prospectus Access
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-sienna-brown/40" />
        </div>

        <h1 className="font-signifier text-[30px] font-normal text-ink-black tracking-tight leading-tight">
          Cursusaurus
        </h1>
        <p className="text-[22px] font-medium text-ink-black mt-3 mb-1 tracking-tight">
          Sign in to continue
        </p>
        <p className="text-caption text-slate-gray max-w-[280px] leading-relaxed mb-7">
          Deliberate, quiet learning for enrolled fellows & monograph subscribers.
        </p>

        <div className="w-full flex flex-col gap-3">
          {/* Google */}
          <Button
            type="button"
            variant="outline"
            disabled={loadingProvider !== null}
            onClick={() => handleSignIn("google")}
            className="w-full h-12 rounded-buttons bg-paper-white hover:bg-mist-gray text-ink-black text-caption font-medium flex items-center justify-center gap-3 transition-all shadow-subtle hover:shadow-subtle-2 active:scale-[0.99]"
          >
            {loadingProvider === "google" ? (
              <Loader2 className="size-[18px] animate-spin shrink-0 text-slate-gray" />
            ) : (
              <GoogleIcon className="size-[18px] shrink-0" />
            )}
            <span>
              {loadingProvider === "google"
                ? "Connecting to Google…"
                : "Continue with Google"}
            </span>
          </Button>

          {/* GitHub */}
          <Button
            type="button"
            variant="default"
            disabled={loadingProvider !== null}
            onClick={() => handleSignIn("github")}
            className="w-full h-12 rounded-buttons bg-ink-black hover:bg-ink-black/90 text-paper-white text-caption font-medium flex items-center justify-center gap-3 transition-all shadow-subtle hover:shadow-subtle-2 active:scale-[0.99]"
          >
            {loadingProvider === "github" ? (
              <Loader2 className="size-[18px] animate-spin shrink-0 text-paper-white" />
            ) : (
              <GitHubIcon className="size-[18px] shrink-0 text-paper-white" />
            )}
            <span className="text-paper-white">
              {loadingProvider === "github"
                ? "Connecting to GitHub…"
                : "Continue with GitHub"}
            </span>
          </Button>
        </div>

        {/* Soft Divider & Guest Action */}
        <div className="w-full flex items-center justify-center my-6 gap-3">
          <div className="h-px bg-border flex-1" />
          <span className="text-[11px] text-slate-gray uppercase tracking-widest font-medium">
            or explore
          </span>
          <div className="h-px bg-border flex-1" />
        </div>

        <Button
          variant="ghost"
          render={<Link href="/" />}
          nativeButton={false}
          className="w-full h-10 rounded-buttons text-slate-gray hover:text-ink-black hover:bg-mist-gray text-caption font-medium transition-colors"
        >
          Browse syllabus as guest
        </Button>

        {/* ToS & Privacy */}
        <div className="mt-6 flex flex-col items-center">
          <p className="text-[13px] text-slate-gray leading-relaxed max-w-[280px]">
            By continuing, you agree to our{" "}
            <Link
              href="/terms"
              className="underline underline-offset-2 decoration-smoke-gray hover:text-ink-black transition-colors"
            >
              Terms
            </Link>{" "}
            and{" "}
            <Link
              href="/privacy"
              className="underline underline-offset-2 decoration-smoke-gray hover:text-ink-black transition-colors"
            >
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </Card>

      {/* Bottom tagline */}
      <div className="mt-8 flex items-center justify-center gap-2">
        <span className="w-1 h-1 rounded-full bg-slate-gray/40" />
        <span className="text-[12px] tracking-wide text-slate-gray font-medium">
          Single unified access for members & subscribers
        </span>
        <span className="w-1 h-1 rounded-full bg-slate-gray/40" />
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X, LogOut, BookOpen, Layers, Library } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface MarketplaceNavProps {
  user?: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
}

export function MarketplaceNav({ user }: MarketplaceNavProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push("/login");
  };

  const getInitials = (name?: string | null, email?: string | null) => {
    if (name) {
      const parts = name.trim().split(" ");
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return name.slice(0, 2).toUpperCase();
    }
    if (email) {
      return email.slice(0, 2).toUpperCase();
    }
    return "CS";
  };

  const isBrowseActive = pathname === "/";
  const isPricingActive = pathname === "/pricing";
  const isLibraryActive = pathname === "/library" || pathname.startsWith("/library/");

  return (
    <header className="sticky top-0 left-0 w-full z-50 bg-paper-white/95 backdrop-blur-md border-b border-hairline">
      <div className="w-full max-w-[1200px] mx-auto px-4 md:px-6 h-16 md:h-20 flex items-center justify-between">
        {/* Logo Left */}
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="text-ink-black font-serif text-2xl md:text-[26px] tracking-tight font-normal hover:opacity-90 transition-opacity"
          >
            Cursusaurus
          </Link>

          {/* Desktop Nav Links (Center/Left) */}
          <nav className="hidden md:flex items-center gap-8 pt-0.5" aria-label="Main Navigation">
            <Link
              href="/"
              aria-current={isBrowseActive ? "page" : undefined}
              className={`text-[15px] relative py-1 transition-colors ${
                isBrowseActive
                  ? "text-ink-black font-medium after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-ink-black"
                  : "text-slate-gray hover:text-ink-black font-normal"
              }`}
            >
              Browse
            </Link>
            <Link
              href="/pricing"
              aria-current={isPricingActive ? "page" : undefined}
              className={`text-[15px] relative py-1 transition-colors ${
                isPricingActive
                  ? "text-ink-black font-medium after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-ink-black"
                  : "text-slate-gray hover:text-ink-black font-normal"
              }`}
            >
              Pricing
            </Link>
            {user && (
              <Link
                href="/library"
                aria-current={isLibraryActive ? "page" : undefined}
                className={`text-[15px] relative py-1 transition-colors ${
                  isLibraryActive
                    ? "text-ink-black font-medium after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-ink-black"
                    : "text-slate-gray hover:text-ink-black font-normal"
                }`}
              >
                My Library
              </Link>
            )}
            {user && (
              <Link
                href="/dashboard/courses"
                className="text-slate-gray hover:text-ink-black transition-colors text-[15px] font-normal"
              >
                Dashboard
              </Link>
            )}
          </nav>
        </div>

        {/* Right Desktop CTAs / Auth */}
        <div className="hidden md:flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                render={<Link href="/pricing" />}
                className="rounded-full border-hairline text-slate-gray hover:text-ink-black text-xs font-medium px-4"
              >
                All-Access Pass
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      className="relative rounded-full size-9 p-0 border border-hairline hover:border-slate-gray/40 focus-visible:ring-1"
                      aria-label="User account menu"
                    />
                  }
                >
                  <Avatar className="size-8">
                    {user.image && <AvatarImage src={user.image} alt={user.name || "User"} />}
                    <AvatarFallback className="bg-ink-black text-paper-white font-medium text-xs tracking-wider">
                      {getInitials(user.name, user.email)}
                    </AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                  align="end"
                  className="w-56 bg-paper-white rounded-[16px] border-hairline shadow-ledger p-1.5 font-sohne"
                >
                  <DropdownMenuLabel className="px-2 py-1.5">
                    <div className="flex flex-col space-y-0.5">
                      <p className="text-sm font-medium text-ink-black leading-none truncate">
                        {user.name || "Learner"}
                      </p>
                      <p className="text-xs text-slate-gray leading-none truncate pt-1">
                        {user.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-hairline my-1" />

                  <DropdownMenuItem
                    render={<Link href="/library" />}
                    className="cursor-pointer rounded-lg text-sm text-ink-black focus:bg-mist-gray flex items-center gap-2"
                  >
                    <Library className="size-4 text-slate-gray" />
                    <span>My Library</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    render={<Link href="/dashboard/courses" />}
                    className="cursor-pointer rounded-lg text-sm text-ink-black focus:bg-mist-gray flex items-center gap-2"
                  >
                    <Layers className="size-4 text-slate-gray" />
                    <span>Creator Studio</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    render={<Link href="/" />}
                    className="cursor-pointer rounded-lg text-sm text-ink-black focus:bg-mist-gray flex items-center gap-2"
                  >
                    <BookOpen className="size-4 text-slate-gray" />
                    <span>Browse Catalog</span>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator className="bg-hairline my-1" />
                  <DropdownMenuItem
                    onClick={handleSignOut}
                    className="cursor-pointer rounded-lg text-sm text-destructive focus:bg-destructive/10 flex items-center gap-2"
                  >
                    <LogOut className="size-4" />
                    <span>Sign out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                render={<Link href="/login" />}
                className="text-slate-gray hover:text-ink-black text-sm font-normal px-3"
              >
                Sign in
              </Button>
              <Button
                render={<Link href="/pricing" />}
                className="rounded-full bg-ink-black text-paper-white px-5 py-2 text-sm font-medium hover:opacity-90 transition-opacity shadow-sm"
              >
                Get All-Access
              </Button>
            </div>
          )}
        </div>

        {/* Mobile Hamburger Button */}
        <div className="flex md:hidden items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            className="size-10 text-ink-black"
          >
            {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile Menu Panel */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-hairline bg-paper-white px-4 py-6 flex flex-col gap-5 animate-in slide-in-from-top-2 duration-150">
          <nav className="flex flex-col gap-2 font-sohne" aria-label="Mobile Navigation">
            <Link
              href="/"
              onClick={() => setMobileMenuOpen(false)}
              className={`text-base py-3 px-3 rounded-lg flex items-center min-h-[44px] ${
                isBrowseActive ? "bg-mist-gray text-ink-black font-medium" : "text-slate-gray hover:text-ink-black"
              }`}
            >
              Browse Catalog
            </Link>
            <Link
              href="/pricing"
              onClick={() => setMobileMenuOpen(false)}
              className={`text-base py-3 px-3 rounded-lg flex items-center min-h-[44px] ${
                isPricingActive ? "bg-mist-gray text-ink-black font-medium" : "text-slate-gray hover:text-ink-black"
              }`}
            >
              Pricing & All-Access
            </Link>
            {user && (
              <Link
                href="/library"
                onClick={() => setMobileMenuOpen(false)}
                className="text-base py-3 px-3 rounded-lg flex items-center min-h-[44px] text-slate-gray hover:text-ink-black"
              >
                My Library
              </Link>
            )}
            {user && (
              <Link
                href="/dashboard/courses"
                onClick={() => setMobileMenuOpen(false)}
                className="text-base py-3 px-3 rounded-lg flex items-center min-h-[44px] text-slate-gray hover:text-ink-black"
              >
                Creator Studio
              </Link>
            )}
          </nav>

          <div className="pt-4 border-t border-hairline flex flex-col gap-3">
            {user ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Avatar className="size-8">
                    {user.image && <AvatarImage src={user.image} alt={user.name || "User"} />}
                    <AvatarFallback className="bg-ink-black text-paper-white font-medium text-xs">
                      {getInitials(user.name, user.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-ink-black leading-tight">
                      {user.name || "User"}
                    </span>
                    <span className="text-xs text-slate-gray leading-tight">{user.email}</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSignOut}
                  className="text-xs text-destructive hover:bg-destructive/10"
                >
                  Sign out
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                <Button
                  render={<Link href="/pricing" />}
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full rounded-full bg-ink-black text-paper-white py-3 text-sm font-medium"
                >
                  Get All-Access
                </Button>
                <Button
                  variant="outline"
                  render={<Link href="/login" />}
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full rounded-full border-hairline text-ink-black py-3 text-sm font-medium"
                >
                  Sign in
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

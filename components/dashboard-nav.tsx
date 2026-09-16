"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, BookOpen, Layers, Library } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Badge } from "@/components/ui/badge";
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

interface DashboardNavProps {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export function DashboardNav({ user }: DashboardNavProps) {
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
    return "CR";
  };

  const isDashboardActive = pathname.startsWith("/dashboard");

  return (
    <header className="sticky top-0 left-0 w-full z-50 bg-paper-white/95 backdrop-blur-md border-b border-hairline">
      <div className="max-w-[1200px] mx-auto px-4 md:px-6 h-16 md:h-20 flex items-center justify-between">
        {/* Left Branding & Nav Links */}
        <div className="flex items-center gap-6 md:gap-10">
          <div className="flex items-center gap-2.5 md:gap-3">
            <Link
              href="/dashboard/courses"
              className="text-ink-black font-serif text-xl md:text-[24px] tracking-tight font-normal hover:opacity-90 transition-opacity"
            >
              Cursusaurus
            </Link>
            <Badge
              variant="secondary"
              className="rounded-full bg-mist-gray text-ink-black text-[11px] md:text-xs font-medium tracking-wide"
            >
              Creator Studio
            </Badge>
          </div>

          <nav className="hidden md:flex items-center gap-7 pt-0.5" aria-label="Main Navigation">
            <Link
              href="/"
              className="text-slate-gray hover:text-ink-black transition-colors text-[15px] font-normal"
            >
              Browse
            </Link>
            <Link
              href="/library"
              className="text-slate-gray hover:text-ink-black transition-colors text-[15px] font-normal"
            >
              My Library
            </Link>
            <Link
              href="/dashboard/courses"
              aria-current={isDashboardActive ? "page" : undefined}
              className={`text-[15px] relative py-1 transition-colors ${
                isDashboardActive
                  ? "text-ink-black font-medium after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-ink-black"
                  : "text-slate-gray hover:text-ink-black font-normal"
              }`}
            >
              Dashboard
            </Link>
          </nav>
        </div>

        {/* Right Actions & User Profile */}
        <div className="flex items-center gap-3">
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
                    {user.name || "Creator"}
                  </p>
                  <p className="text-xs text-slate-gray leading-none truncate pt-1">
                    {user.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-hairline my-1" />

              <DropdownMenuItem
                render={<Link href="/dashboard/courses" />}
                className="cursor-pointer rounded-lg text-sm text-ink-black focus:bg-mist-gray flex items-center gap-2"
              >
                <Layers className="size-4 text-slate-gray" />
                <span>Course Management</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                render={<Link href="/library" />}
                className="cursor-pointer rounded-lg text-sm text-ink-black focus:bg-mist-gray flex items-center gap-2"
              >
                <Library className="size-4 text-slate-gray" />
                <span>My Library</span>
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
      </div>

      {/* Mobile Nav Sub-row */}
      <nav className="md:hidden flex items-center justify-around border-t border-hairline py-2 px-4 bg-paper-white" aria-label="Mobile Navigation">
        <Link
          href="/"
          className="text-xs text-slate-gray hover:text-ink-black font-medium py-1 px-2"
        >
          Browse
        </Link>
        <Link
          href="/library"
          className="text-xs text-slate-gray hover:text-ink-black font-medium py-1 px-2"
        >
          My Library
        </Link>
        <Link
          href="/dashboard/courses"
          className={`text-xs font-medium py-1 px-2 rounded-full ${
            isDashboardActive ? "bg-mist-gray text-ink-black" : "text-slate-gray hover:text-ink-black"
          }`}
        >
          Dashboard
        </Link>
      </nav>
    </header>
  );
}

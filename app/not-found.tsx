import Link from "next/link";
import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-fog-white flex items-center justify-center px-4">
      <Card className="max-w-md w-full bg-paper-white rounded-cards border border-hairline p-10 md:p-12 text-center flex flex-col items-center justify-center gap-4">
        <div className="size-14 rounded-full bg-mist-gray flex items-center justify-center text-slate-gray">
          <BookOpen className="size-6 stroke-[1.5]" />
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="font-serif text-2xl md:text-3xl text-ink-black font-normal">
            Page not found
          </h1>
          <p className="text-sm text-slate-gray font-sohne leading-relaxed">
            The monograph or page you&apos;re looking for doesn&apos;t exist, or
            is not yet readable by you.
          </p>
        </div>

        <Button
          render={<Link href="/" />}
          className="mt-2 rounded-full bg-ink-black text-paper-white px-6 text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Back to catalog
        </Button>
      </Card>
    </div>
  );
}
import * as React from "react";
import { Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export type AccessBadgeState = "all-access" | "purchased" | "locked";

export interface AccessBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  state: AccessBadgeState;
  showIcon?: boolean;
}

export function AccessBadge({
  state,
  showIcon = true,
  className,
  ...props
}: AccessBadgeProps) {
  if (state === "purchased") {
    return (
      <Badge variant="purchased" className={className} {...props}>
        Purchased
      </Badge>
    );
  }

  if (state === "all-access") {
    return (
      <Badge variant="allAccess" className={className} {...props}>
        All-Access
      </Badge>
    );
  }

  return (
    <Badge variant="locked" className={className} {...props}>
      {showIcon && <Lock className="size-3 stroke-[1.8]" />}
      <span>Locked</span>
    </Badge>
  );
}

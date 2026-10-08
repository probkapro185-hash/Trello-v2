import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium tracking-wide", {
  variants: {
    variant: {
      default: "bg-primary/12 text-primary",
      muted: "bg-secondary text-muted-foreground",
      outline: "border border-border text-muted-foreground",
      success: "bg-emerald-500/10 text-emerald-300",
    },
  },
  defaultVariants: { variant: "default" },
});

export function Badge({ className, variant, ...props }: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}


import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Rail({ title, subtitle, action, children, className }: Props) {
  return (
    <section className={cn("space-y-4", className)}>
      <div className="flex items-end justify-between gap-4 px-1">
        <div>
          <h2 className="font-display text-xl text-foreground md:text-2xl">{title}</h2>
          {subtitle && (
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {action}
      </div>
      <div className="scrollbar-none -mx-1 flex gap-4 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {children}
      </div>
    </section>
  );
}

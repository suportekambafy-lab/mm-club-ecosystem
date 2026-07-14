import { cn } from "@/lib/utils";

export function MMLogo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div
        className="flex h-8 w-8 items-center justify-center rounded-md"
        style={{
          background:
            "linear-gradient(135deg, oklch(0.82 0.13 82), oklch(0.55 0.12 60))",
        }}
        aria-hidden
      >
        <span className="font-display text-[13px] font-semibold text-black">
          MM
        </span>
      </div>
      <div className="flex flex-col leading-none">
        <span className="font-display text-[15px] tracking-tight text-foreground">
          MM Club
        </span>
        <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          Marca Milionária
        </span>
      </div>
    </div>
  );
}

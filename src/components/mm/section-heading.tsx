import { cn } from "@/lib/utils";

interface Props {
  eyebrow?: string;
  title: string;
  description?: string;
  className?: string;
}

export function SectionHeading({ eyebrow, title, description, className }: Props) {
  return (
    <div className={cn("space-y-2", className)}>
      {eyebrow && (
        <p className="text-xs font-medium uppercase tracking-[0.24em] text-primary">
          {eyebrow}
        </p>
      )}
      <h1 className="font-display text-3xl leading-tight text-foreground md:text-4xl">
        {title}
      </h1>
      {description && (
        <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
          {description}
        </p>
      )}
    </div>
  );
}

import { cn } from "@/lib/utils";

interface AlertProps {
  variant: "amber" | "mint" | "sky" | "coral";
  icon: string;
  children: React.ReactNode;
  className?: string;
}

const variantStyles = {
  amber: "bg-amber/[0.07] border-amber/[0.18] text-amber",
  mint: "bg-mint/[0.07] border-mint/[0.18] text-mint",
  sky: "bg-sky/[0.07] border-sky/[0.18] text-sky",
  coral: "bg-coral/[0.07] border-coral/[0.18] text-coral",
};

export function Alert({ variant, icon, children, className }: AlertProps) {
  return (
    <div
      className={cn(
        "p-3 px-4 rounded-[10px] text-[0.82rem] leading-relaxed flex gap-2.5 items-start border",
        variantStyles[variant],
        className,
      )}
    >
      <span>{icon}</span>
      <span>{children}</span>
    </div>
  );
}

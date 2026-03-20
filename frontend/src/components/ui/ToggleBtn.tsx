import { cn } from "@/lib/utils";

interface ToggleBtnProps {
  label: string;
  selected?: boolean;
  onClick?: () => void;
  variant?: "default" | "sky";
}

export function ToggleBtn({
  label,
  selected,
  onClick,
  variant = "default",
}: ToggleBtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-4 py-2 rounded-lg bg-ink-3 border-[1.5px] border-rim text-fg-3 text-[0.8rem] font-medium transition-all select-none hover:border-rim-2 hover:text-fg-2",
        selected &&
          variant === "default" &&
          "border-sky/50 text-sky bg-sky/[0.08]",
        selected &&
          variant === "sky" &&
          "border-sky/50 text-sky bg-sky/[0.08]",
      )}
    >
      {label}
    </button>
  );
}

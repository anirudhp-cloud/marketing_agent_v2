import { cn } from "@/lib/utils";

interface ChipProps {
  label: string;
  selected?: boolean;
  onClick?: () => void;
}

export function Chip({ label, selected, onClick }: ChipProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-4 py-[7px] rounded-lg bg-ink-3 border-[1.5px] border-rim text-fg-2 text-[0.8rem] font-medium transition-all select-none hover:border-rim-2 hover:text-fg",
        selected && "bg-coral/10 border-coral/[0.45] text-coral",
      )}
    >
      {selected && "✓ "}
      {label}
    </button>
  );
}

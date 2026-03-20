import { cn } from "@/lib/utils";

interface OptionCardProps {
  icon: string;
  name: string;
  hint: string;
  selected?: boolean;
  onClick?: () => void;
  mini?: boolean;
}

export function OptionCard({
  icon,
  name,
  hint,
  selected,
  onClick,
  mini,
}: OptionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative overflow-hidden text-left bg-ink-3 border-[1.5px] border-rim rounded-r p-[18px] cursor-pointer transition-all hover:border-rim-2 hover:-translate-y-0.5",
        selected && "border-coral/50 bg-coral/[0.06]",
        mini && "p-3.5",
      )}
    >
      {selected && (
        <div className="absolute top-2.5 right-2.5 w-[18px] h-[18px] rounded-full bg-coral flex items-center justify-center text-[0.6rem] text-white shadow-[0_2px_8px_var(--accent-glow)]">
          ✓
        </div>
      )}
      <div className={cn("text-2xl mb-2.5", mini && "text-xl mb-1.5")}>
        {icon}
      </div>
      <div className={cn("text-sm font-bold mb-1", mini && "text-[0.8rem]")}>
        {name}
      </div>
      <div className="text-[0.72rem] text-fg-3 leading-snug">{hint}</div>
    </button>
  );
}

interface SectionBreakProps {
  label: string;
}

export function SectionBreak({ label }: SectionBreakProps) {
  return (
    <div className="flex items-center gap-3.5 my-7 mb-5">
      <div className="flex-1 h-px bg-rim" />
      <span className="text-[0.68rem] uppercase tracking-[2.5px] text-fg-3 font-semibold whitespace-nowrap">
        {label}
      </span>
      <div className="flex-1 h-px bg-rim" />
    </div>
  );
}

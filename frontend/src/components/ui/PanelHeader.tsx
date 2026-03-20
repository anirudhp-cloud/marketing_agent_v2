interface PanelHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
}

export function PanelHeader({ eyebrow, title, description }: PanelHeaderProps) {
  return (
    <div className="mb-8">
      <div className="text-[0.68rem] uppercase tracking-[3px] font-bold text-coral mb-2">
        {eyebrow}
      </div>
      <h1 className="font-display text-[2rem] font-bold tracking-tight leading-tight mb-2 bg-gradient-to-br from-fg to-fg-2 bg-clip-text text-transparent">
        {title}
      </h1>
      <p className="text-sm text-fg-2 leading-relaxed max-w-[560px]">
        {description}
      </p>
    </div>
  );
}

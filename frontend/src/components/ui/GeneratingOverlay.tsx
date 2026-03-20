import { cn } from "@/lib/utils";

interface GeneratingOverlayProps {
  show: boolean;
  steps: { icon: string; label: string; status: "pending" | "active" | "done" }[];
  progress: number;
}

export function GeneratingOverlay({
  show,
  steps,
  progress,
}: GeneratingOverlayProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-ink/[0.92] backdrop-blur-2xl flex items-center justify-center flex-col gap-5">
      <div className="w-16 h-16 rounded-[18px] bg-gradient-to-br from-coral to-lilac dark:to-amber flex items-center justify-center text-3xl shadow-[0_0_40px_var(--accent-glow)] animate-pulse_glow">
        🚀
      </div>
      <div className="font-display text-2xl font-bold text-center">
        Building Your Campaign
      </div>
      <div className="text-sm text-fg-2 text-center">
        Analysing your brand, audience, and goals…
      </div>
      <div className="flex flex-col gap-2.5 w-80">
        {steps.map((s, i) => (
          <div
            key={i}
            className={cn(
              "flex items-center gap-3 p-3 px-4 rounded-[10px] bg-ink-3 border border-rim text-[0.83rem] text-fg-3 transition-all",
              s.status === "active" && "border-coral/35 text-fg-2",
              s.status === "done" && "border-mint/25 text-mint",
            )}
          >
            <span className="text-base">{s.icon}</span>
            {s.label}
          </div>
        ))}
      </div>
      <div className="w-80 h-1 bg-rim rounded-sm overflow-hidden">
        <div
          className="h-full rounded-sm bg-gradient-to-r from-coral to-lilac transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

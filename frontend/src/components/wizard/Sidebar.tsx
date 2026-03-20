import { useNavigate } from "react-router-dom";
import { useWizard } from "@/context/WizardContext";
import { cn } from "@/lib/utils";

const TOTAL = 9;

const ITEMS = [
  { icon: "🏢", title: "Business Profile", sub: "Company & brand assets", path: "/setup", section: "Setup" },
  { icon: "🎯", title: "Audience Config", sub: "Segments & demographics", path: "/audience" },
  { icon: "📊", title: "Campaign Goals", sub: "Objective, budget & channel", path: "/goals" },
  { icon: "🎨", title: "Creative Config", sub: "Style, images & hashtags", path: "/creative" },
  { icon: "✅", title: "Review & Approve", sub: "Confirm before generation", path: "/review" },
  { icon: "⚡", title: "Campaign Variants", sub: "Select & refine", path: "/variants", section: "Output" },
  { icon: "📅", title: "30-Day Calendar", sub: "Day-by-day schedule", path: "/calendar" },
  { icon: "🔗", title: "Scheduling", sub: "Connect & publish", path: "/schedule" },
  { icon: "💬", title: "Engagement Mgmt", sub: "Auto-reply suggestions", path: "/engage" },
];

export function Sidebar() {
  const { state, dispatch } = useWizard();
  const navigate = useNavigate();
  const pct = Math.round((state.currentStep / TOTAL) * 100);

  const goTo = (idx: number) => {
    if (idx + 1 > state.currentStep + 1) return;
    dispatch({ type: "SET_STEP", step: idx + 1 });
    navigate(ITEMS[idx].path);
  };

  return (
    <aside className="hidden lg:flex w-[260px] flex-shrink-0 flex-col gap-0.5 p-7 px-5 border-r border-rim bg-ink-2/50 sticky top-[63px] h-[calc(100vh-63px)] overflow-y-auto">
      {ITEMS.map((item, i) => {
        const isDone = i + 1 < state.currentStep;
        const isActive = i + 1 === state.currentStep;
        const isLocked = i + 1 > state.currentStep + 1;

        return (
          <div key={item.title}>
            {item.section && (
              <div className="text-[0.65rem] uppercase tracking-[2.5px] text-fg-3 font-semibold px-2.5 py-1.5 mt-3 first:mt-0">
                {item.section}
              </div>
            )}
            <button
              onClick={() => goTo(i)}
              disabled={isLocked}
              className={cn(
                "w-full flex items-center gap-3 px-2.5 py-2.5 rounded-[10px] transition-all border border-transparent text-left",
                isActive && "bg-coral/[0.08] border-coral/[0.18]",
                isDone && "opacity-70",
                isLocked && "opacity-35 cursor-not-allowed",
                !isActive && !isLocked && "hover:bg-glass-2",
              )}
            >
              <div
                className={cn(
                  "w-[30px] h-[30px] rounded-lg flex items-center justify-center text-sm flex-shrink-0 bg-glass-2 border border-rim transition-all",
                  isActive &&
                    "bg-coral/[0.15] border-coral/30 shadow-[0_0_12px_var(--accent-glow-sm)]",
                  isDone && "bg-mint/10 border-mint/20",
                )}
              >
                {item.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className={cn(
                    "text-[0.82rem] font-semibold text-fg-2 leading-none",
                    isActive && "text-coral",
                    isDone && "text-mint",
                  )}
                >
                  {item.title}
                </div>
                <div className="text-[0.7rem] text-fg-3 mt-0.5">
                  {item.sub}
                </div>
              </div>
              {isDone && <span className="text-[0.7rem] text-mint">✓</span>}
            </button>
          </div>
        );
      })}

      <div className="mt-auto pt-5 border-t border-rim">
        <div className="flex justify-between text-[0.75rem] text-fg-3 mb-2">
          <span>Progress</span>
          <span className="text-fg-2 font-semibold">{pct}%</span>
        </div>
        <div className="h-[5px] bg-ink-3 rounded-sm overflow-hidden mb-4">
          <div
            className="h-full rounded-sm bg-gradient-to-r from-coral to-lilac dark:to-amber transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between text-[0.75rem] text-fg-3 mb-2">
          <span>Steps completed</span>
          <span className="text-fg-2 font-semibold">
            {state.currentStep - 1} / {TOTAL}
          </span>
        </div>
        <div className="flex justify-between text-[0.75rem] text-fg-3">
          <span>Channel</span>
          <span className="text-mint font-semibold">Instagram</span>
        </div>
      </div>
    </aside>
  );
}

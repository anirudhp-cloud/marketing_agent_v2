import { useNavigate } from "react-router-dom";
import { useWizard } from "@/context/WizardContext";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";

const STEPS = [
  { label: "Profile", path: "/setup" },
  { label: "Audience", path: "/audience" },
  { label: "Goals", path: "/goals" },
  { label: "Creative", path: "/creative" },
  { label: "Review", path: "/review" },
  { label: "Variants", path: "/variants" },
  { label: "Calendar", path: "/calendar" },
  { label: "Schedule", path: "/schedule" },
  { label: "Engage", path: "/engage" },
];

export function WizardNav() {
  const { state, dispatch } = useWizard();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const goTo = (idx: number) => {
    if (idx + 1 > state.currentStep + 1) return;
    dispatch({ type: "SET_STEP", step: idx + 1 });
    navigate(STEPS[idx].path);
  };

  return (
    <nav className="sticky top-0 z-[100] flex items-center justify-between px-8 h-[60px] bg-ink/85 backdrop-blur-xl border-b border-rim">
      <div className="font-extrabold text-[1.05rem] tracking-tight flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-coral to-lilac dark:to-amber flex items-center justify-center text-sm shadow-[0_4px_14px_var(--accent-glow)]">
          ⚡
        </div>
        CampaignAI
      </div>

      <div className="hidden md:flex items-center gap-1">
        {STEPS.map((s, i) => {
          const isDone = i + 1 < state.currentStep;
          const isActive = i + 1 === state.currentStep;
          return (
            <button
              key={s.label}
              onClick={() => goTo(i)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[0.72rem] font-semibold tracking-wide transition-all",
                isDone && "text-mint bg-mint/10",
                isActive && "text-coral bg-coral/10",
                !isDone && !isActive && "text-fg-3",
              )}
            >
              <span
                className={cn(
                  "w-1.5 h-1.5 rounded-full bg-current",
                  isDone && "shadow-[0_0_6px_theme(colors.mint)]",
                  isActive && "shadow-[0_0_8px_theme(colors.coral)]",
                )}
              />
              {s.label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2.5">
        <button
          onClick={toggleTheme}
          className="flex items-center gap-1 px-3 py-1.5 rounded-full text-[0.72rem] font-semibold border transition-all select-none bg-ink-3 border-rim text-fg-2 hover:border-rim-2"
        >
          {theme === "dark" ? "☀️" : "🌙"}
          {theme === "dark" ? "Light" : "Dark"}
        </button>
        <div className="text-[0.72rem] px-3 py-1.5 rounded-full bg-amber/10 text-amber border border-amber/20 font-semibold">
          📸 Instagram MVP
        </div>
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#667eea] to-[#764ba2] flex items-center justify-center text-xs font-bold cursor-pointer">
          SW
        </div>
      </div>
    </nav>
  );
}

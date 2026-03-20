import { useNavigate } from "react-router-dom";
import { useWizard } from "@/context/WizardContext";
import { cn } from "@/lib/utils";

interface NavBarProps {
  step: number;
  label: string;
  backPath?: string;
  nextPath: string;
  nextLabel: string;
  onNext?: () => void;
  disabled?: boolean;
  nextVariant?: "primary" | "mint";
}

const TOTAL = 9;

export function NavBar({
  step,
  label,
  backPath,
  nextPath,
  nextLabel,
  onNext,
  disabled,
  nextVariant = "primary",
}: NavBarProps) {
  const { dispatch } = useWizard();
  const navigate = useNavigate();

  const handleBack = () => {
    if (!backPath) return;
    dispatch({ type: "SET_STEP", step: step - 1 });
    navigate(backPath);
  };

  const handleNext = () => {
    if (onNext) {
      onNext();
      return;
    }
    dispatch({ type: "SET_STEP", step: step + 1 });
    navigate(nextPath);
  };

  return (
    <div className="flex items-center justify-between mt-12 pt-6 border-t border-rim">
      {backPath ? (
        <button
          type="button"
          onClick={handleBack}
          className="px-6 py-3 rounded-[10px] bg-transparent border-[1.5px] border-rim text-fg-3 font-bold text-sm hover:border-rim-2 hover:text-fg-2 transition-all"
        >
          ← Back
        </button>
      ) : (
        <div />
      )}
      <span className="text-[0.78rem] text-fg-3">
        Step {step} of {TOTAL} · {label}
      </span>
      <button
        type="button"
        onClick={handleNext}
        disabled={disabled}
        className={cn(
          "px-7 py-3 rounded-[10px] font-bold text-sm flex items-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed",
          nextVariant === "primary" &&
            "bg-gradient-to-br from-coral to-[var(--btn-gradient-to)] text-white shadow-[0_4px_20px_var(--accent-glow-md)] hover:translate-y-[-2px] hover:shadow-[0_8px_28px_var(--accent-glow-lg)]",
          nextVariant === "mint" &&
            "bg-gradient-to-br from-mint to-[var(--btn-mint-to)] text-white shadow-[0_4px_20px_var(--mint-glow)] hover:translate-y-[-2px]",
        )}
      >
        {nextLabel}
      </button>
    </div>
  );
}

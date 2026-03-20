import { useWizard } from "@/context/WizardContext";

const TOTAL = 9;

export function StepIndicator() {
  const { state } = useWizard();
  const pct = Math.round((state.currentStep / TOTAL) * 100);

  return (
    <div className="h-[3px] bg-ink-3 relative overflow-hidden">
      <div
        className="h-full bg-gradient-to-r from-coral via-lilac dark:via-amber to-mint rounded-sm transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

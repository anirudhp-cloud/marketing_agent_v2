import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { NavBar } from "@/components/ui/NavBar";
import { OptionCard } from "@/components/ui/OptionCard";
import { SectionBreak } from "@/components/ui/SectionBreak";
import { Alert } from "@/components/ui/Alert";
import { useWizard } from "@/context/WizardContext";
import { wizardApi } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import type { GoalType } from "@/context/types";
import { useSessionDict } from "@/context/SessionContext";
import { sessionLogger } from "@/lib/sessionLogger";

const GOALS: { emoji: string; name: string; sub: string; value: GoalType }[] = [
  { emoji: "📣", name: "Brand Awareness", sub: "Reach new audiences at scale", value: "brand_awareness" },
  { emoji: "👥", name: "Follower Growth", sub: "Grow your community fast", value: "follower_growth" },
  { emoji: "❤️", name: "Engagement", sub: "Likes, comments, saves, shares", value: "engagement" },
  { emoji: "🔗", name: "Traffic", sub: "Drive clicks to your website", value: "traffic" },
  { emoji: "💰", name: "Conversion", sub: "Direct sales & sign-ups", value: "conversion" },
  { emoji: "🎁", name: "Promotional", sub: "Product launch or sale event", value: "promotional" },
];

const FORMATS = [
  { icon: "🖼️", name: "Feed Post", hint: "Image + caption · highest shelf-life" },
  { icon: "🎬", name: "Reel", hint: "Short video · highest organic reach" },
  { icon: "⏱️", name: "Story", hint: "24h · swipe-up links · urgency" },
  { icon: "🎭", name: "Carousel", hint: "Multi-image · product showcases" },
];

const TIERS = [
  { label: "Starter", value: 5000 },
  { label: "Growth", value: 21000 },
  { label: "Scale", value: 50000 },
  { label: "Accelerate", value: 100000 },
  { label: "Dominate", value: 200000 },
];

function getBudgetInsight(val: number) {
  const perDay = Math.round(val / 30);
  if (val < 10000) return `💡 Starter budget — best for 1–2 posts/week. Focus on your top 1 city.`;
  if (val < 30000) return `💡 ${formatCurrency(val)}/30 days = ~${formatCurrency(perDay)}/day. Good for awareness in Tier-1 cities.`;
  if (val < 75000) return `💡 Growth budget — expect 2–5x reach boost. Run A/B variants simultaneously.`;
  return `💡 Scale budget — consider adding Reels + Stories for maximum format coverage.`;
}

const DURATIONS = [
  { label: "7 days", value: 7 },
  { label: "14 days", value: 14 },
  { label: "30 days (Recommended)", value: 30 },
  { label: "60 days", value: 60 },
  { label: "90 days", value: 90 },
];

export default function GoalsPage() {
  const navigate = useNavigate();
  const { dispatch } = useWizard();
  const session = useSessionDict();
  const [goalType, setGoalType] = useState<GoalType | null>((session.data.goal_type as GoalType) || "brand_awareness");
  const [budget, setBudget] = useState(session.data.budget || 21000);
  const [durationDays, setDurationDays] = useState(session.data.duration_days || 30);
  const [startDate, setStartDate] = useState(session.data.start_date || "");
  const [formats, setFormats] = useState<string[]>(session.data.formats.length ? session.data.formats : ["Feed Post", "Reel"]);

  // Sync → SessionContext
  useEffect(() => {
    session.set({
      goal_type: goalType ?? "",
      budget,
      duration_days: durationDays,
      start_date: startDate,
      formats,
      current_step: 3,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goalType, budget, durationDays, startDate, formats]);

  const toggleFormat = (name: string) => {
    setFormats((prev) => prev.includes(name) ? prev.filter((f) => f !== name) : [...prev, name]);
  };

  const handleNext = async () => {
    const sid = session.data.session_id || session.ensureSessionId();
    sessionLogger.nav(3, 4, sid);
    sessionLogger.dump("GoalsPage → submit", session.snapshot() as unknown as Record<string, unknown>);
    try {
      await wizardApi.submitStep(sid, 3, { goalType, budget, formats, durationDays, startDate });
    } catch (err) {
      console.error("Failed to save step 3:", err);
    }
    dispatch({ type: "SET_STEP", step: 4 });
    navigate("/creative");
  };

  const pct = ((budget - 5000) / (200000 - 5000) * 100).toFixed(1);

  return (
    <div className="animate-slide-up">
      <PanelHeader
        eyebrow="Step 3 of 9 · Setup"
        title="Campaign Goals & Budget"
        description="Your goal shapes the AI's entire content strategy. Budget guidance is provided based on your selected objective and audience size."
      />

      <label className="block text-[0.78rem] font-semibold text-fg-2 mb-3">Primary Campaign Goal</label>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3.5 mb-8">
        {GOALS.map((g) => (
          <button
            key={g.value}
            onClick={() => setGoalType(g.value)}
            className={`relative bg-ink-3 border-[1.5px] rounded-r p-5 px-4 text-center cursor-pointer transition-all hover:border-rim-2 hover:-translate-y-0.5 ${
              goalType === g.value ? "border-coral/50 bg-coral/[0.06]" : "border-rim"
            }`}
          >
            <div className="text-3xl mb-2.5">{g.emoji}</div>
            <div className="text-[0.85rem] font-bold mb-1">{g.name}</div>
            <div className="text-[0.7rem] text-fg-3">{g.sub}</div>
            {goalType === g.value && (
              <span className="mt-2 inline-block text-[0.65rem] font-bold text-coral bg-coral/10 px-2.5 py-0.5 rounded-full tracking-wider uppercase">
                SELECTED
              </span>
            )}
          </button>
        ))}
      </div>

      <SectionBreak label="Budget & Duration" />
      <div className="bg-ink-3 border border-rim rounded-r p-6 mb-4">
        <div className="font-display text-5xl font-bold bg-gradient-to-br from-coral to-lilac bg-clip-text text-transparent mb-1">
          {formatCurrency(budget)}
        </div>
        <div className="text-[0.78rem] text-fg-3 mb-4">Total campaign budget · 30-day period</div>
        <input
          type="range"
          min={5000}
          max={200000}
          step={1000}
          value={budget}
          onChange={(e) => setBudget(Number(e.target.value))}
          className="w-full appearance-none h-[5px] bg-rim rounded-sm cursor-pointer accent-coral"
          style={{ background: `linear-gradient(90deg, rgb(var(--coral)) ${pct}%, var(--rim) ${pct}%)` }}
        />
        <div className="flex justify-between mt-2.5">
          {TIERS.map((t) => (
            <button key={t.value} onClick={() => setBudget(t.value)} className="text-center text-[0.7rem] text-fg-3 hover:text-fg-2 transition-colors">
              <strong className="block text-[0.78rem] text-fg-2 font-semibold">{formatCurrency(t.value)}</strong>
              {t.label}
            </button>
          ))}
        </div>
        <div className="mt-3.5 p-2.5 px-3.5 bg-amber/[0.07] border border-amber/[0.15] rounded-lg text-[0.78rem] text-amber leading-relaxed">
          {getBudgetInsight(budget)}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="flex flex-col gap-1.5">
          <label className="text-[0.78rem] font-semibold text-fg-2">Campaign Duration</label>
          <select
            value={durationDays}
            onChange={(e) => setDurationDays(Number(e.target.value))}
            className="bg-ink-3 border border-rim rounded-r2 px-3.5 py-2.5 text-fg text-sm outline-none cursor-pointer focus:border-coral/45 transition-all appearance-none"
          >
            {DURATIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[0.78rem] font-semibold text-fg-2">Start Date & Time</label>
          <input
            type="datetime-local"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-ink-3 border border-rim rounded-r2 px-3.5 py-2.5 text-fg text-sm outline-none focus:border-coral/45 transition-all [color-scheme:dark]"
          />
        </div>
      </div>

      <SectionBreak label="Channel" />
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] bg-mint/[0.08] border border-mint/20 text-mint text-[0.8rem] font-semibold mb-4">
        ✓ Instagram — Active MVP Channel
      </div>
      <Alert variant="mint" icon="🗓️" className="mb-6">
        Future phases will add Google Ads, Meta Ads, Amazon Ads, Email, and Influencer collaboration. Architecture is built to expand without rebuilding.
      </Alert>

      <SectionBreak label="Content Format Mix" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {FORMATS.map((f) => (
          <OptionCard
            key={f.name}
            icon={f.icon}
            name={f.name}
            hint={f.hint}
            selected={formats.includes(f.name)}
            onClick={() => toggleFormat(f.name)}
          />
        ))}
      </div>

      <NavBar step={3} label="Goals & Budget" backPath="/audience" nextPath="/creative" nextLabel="Continue to Creative →" onNext={handleNext} />
    </div>
  );
}

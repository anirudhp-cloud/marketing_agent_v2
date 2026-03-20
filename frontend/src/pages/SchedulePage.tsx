import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { NavBar } from "@/components/ui/NavBar";
import { SectionBreak } from "@/components/ui/SectionBreak";
import { useWizard } from "@/context/WizardContext";
import { cn } from "@/lib/utils";
import { useSessionDict } from "@/context/SessionContext";
import { sessionLogger } from "@/lib/sessionLogger";

const METHODS = [
  { icon: "📸", name: "Native Instagram", hint: "Post directly via Instagram API. No third-party needed." },
  { icon: "📊", name: "Buffer", hint: "Connect your Buffer workspace. Push entire calendar in one click." },
  { icon: "🦉", name: "Hootsuite", hint: "Sync with Hootsuite for team collaboration & scheduling." },
  { icon: "⏰", name: "Later", hint: "Visual calendar planning with auto-publish support." },
  { icon: "📤", name: "Manual Export", hint: "Download calendar as CSV + all images as ZIP." },
  { icon: "🔗", name: "Webhook / API", hint: "Custom integration via REST API or webhook endpoint." },
];

export default function SchedulePage() {
  const navigate = useNavigate();
  const { dispatch } = useWizard();
  const session = useSessionDict();
  const [method, setMethod] = useState(session.data.scheduling_method || "Native Instagram");

  // Sync → SessionContext
  useEffect(() => {
    session.set({ scheduling_method: method, current_step: 8 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method]);

  const handleNext = () => {
    sessionLogger.nav(8, 9, session.data.session_id);
    dispatch({ type: "SET_STEP", step: 9 });
    navigate("/engage");
  };

  return (
    <div className="animate-slide-up">
      <PanelHeader
        eyebrow="Step 8 of 9 · Publish"
        title="Scheduling & Publishing"
        description="Connect your scheduling tool or publish natively via Instagram. Your 30-day calendar will be pushed directly with optimal posting times."
      />

      <SectionBreak label="Choose Scheduling Method" />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
        {METHODS.map((m) => (
          <button
            key={m.name}
            onClick={() => setMethod(m.name)}
            className={cn(
              "bg-ink-3 border-[1.5px] border-rim rounded-r p-4 text-center cursor-pointer transition-all hover:border-rim-2",
              method === m.name && "border-lilac/50 bg-lilac/[0.07]",
            )}
          >
            <div className="text-2xl mb-2">{m.icon}</div>
            <div className="text-[0.85rem] font-bold mb-1">{m.name}</div>
            <div className="text-[0.7rem] text-fg-3">{m.hint}</div>
          </button>
        ))}
      </div>

      <SectionBreak label="Instagram Connection" />
      <div className="bg-ink-3 border border-rim rounded-r p-5 mb-6">
        <div className="text-[0.67rem] uppercase tracking-[2.5px] text-fg-3 font-bold mb-3.5">Connect Instagram Account</div>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="text-sm font-semibold mb-1">@smartwheels.india</div>
            <div className="text-[0.78rem] text-fg-3">Instagram Business · 12.4K followers · Connected via Meta Business Suite</div>
          </div>
          <button className="px-5 py-2.5 rounded-[10px] text-sm font-bold bg-glass-2 border-[1.5px] border-rim text-fg-2 whitespace-nowrap hover:border-rim-2 hover:text-fg transition-all">
            Reconnect →
          </button>
        </div>
      </div>

      <SectionBreak label="Budget Pause Controls" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="flex flex-col gap-1.5">
          <label className="text-[0.78rem] font-semibold text-fg-2">If budget is exhausted early</label>
          <select className="bg-ink-3 border border-rim rounded-r2 px-3.5 py-2.5 text-fg text-sm outline-none cursor-pointer focus:border-coral/45 transition-all appearance-none">
            <option>Pause remaining calendar & notify me</option>
            <option>Continue with organic-only posts</option>
            <option>Auto-extend with additional budget</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[0.78rem] font-semibold text-fg-2">Low budget alert threshold</label>
          <select className="bg-ink-3 border border-rim rounded-r2 px-3.5 py-2.5 text-fg text-sm outline-none cursor-pointer focus:border-coral/45 transition-all appearance-none">
            <option>Alert when 20% budget remains</option>
            <option>Alert when 10% budget remains</option>
            <option>Alert when 5 days remain</option>
            <option>No alerts</option>
          </select>
        </div>
      </div>

      <NavBar step={8} label="Scheduling" backPath="/calendar" nextPath="/engage" nextLabel="Set Up Engagement →" onNext={handleNext} />
    </div>
  );
}

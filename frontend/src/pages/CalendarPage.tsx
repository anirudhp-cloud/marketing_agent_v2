import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { NavBar } from "@/components/ui/NavBar";
import { Alert } from "@/components/ui/Alert";
import { useWizard } from "@/context/WizardContext";
import { cn } from "@/lib/utils";
import { useSessionDict } from "@/context/SessionContext";
import { sessionLogger } from "@/lib/sessionLogger";

type PostType = "post" | "reel" | "story";

interface CalDay {
  day: string;
  type?: PostType;
  text?: string;
  empty?: boolean;
}

const HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const CAL_DATA: CalDay[] = [
  { day: "", empty: true }, { day: "", empty: true }, { day: "", empty: true },
  { day: "", empty: true }, { day: "", empty: true }, { day: "", empty: true },
  { day: "15", type: "post", text: "Lifestyle — Upgrade your drive. 9:00 AM" },
  { day: "16" }, { day: "17", type: "reel", text: "Stop guessing. Know your car. 7:00 PM" },
  { day: "18" }, { day: "19", type: "story", text: "Product spotlight — OBD Scanner. 6:00 PM" },
  { day: "20" }, { day: "21", type: "post", text: "10K drivers trust SmartWheels. 10:00 AM" },
  { day: "22", type: "reel", text: "Before & After — car transformation. 4:00 PM" },
  { day: "23" }, { day: "24", type: "post", text: "Dashcam feature spotlight. 9:00 AM" },
  { day: "25" }, { day: "26", type: "story", text: "Poll: What's your #1 car pain point? 7:00 PM" },
  { day: "27", type: "post", text: "Value comparison — us vs dealership. 12:00 PM" },
  { day: "28" }, { day: "29", type: "reel", text: "Weekend drive essentials. 11:00 AM" },
  { day: "30" }, { day: "31", type: "post", text: "End-of-month roundup & offer. 9:00 AM" },
  { day: "Apr 1", type: "story", text: "Customer review spotlight. 6:00 PM" },
  { day: "2" }, { day: "3", type: "reel", text: "How-to: Install dashcam in 5 min. 7:00 PM" },
  { day: "4" }, { day: "5", type: "post", text: "SmartWheels lifestyle shoot. 10:00 AM" },
  { day: "6", type: "reel", text: "Top 5 accessories under ₹2000. 4:00 PM" },
  { day: "7" }, { day: "8", type: "post", text: "Brand story — why SmartWheels. 9:00 AM" },
  { day: "9" }, { day: "10", type: "story", text: "Flash offer — 15% off this week. 6:00 PM" },
  { day: "11", type: "reel", text: "Campaign wrap — community thank you. 12:00 PM" },
  { day: "12", type: "post", text: "Month 2 teaser — what's coming. 10:00 AM" },
  { day: "13" },
];

const TYPE_STYLES: Record<PostType, { bg: string; text: string; label: string }> = {
  post: { bg: "bg-coral/[0.15]", text: "text-coral", label: "POST" },
  reel: { bg: "bg-mint/[0.15]", text: "text-mint", label: "REEL" },
  story: { bg: "bg-sky/[0.15]", text: "text-sky", label: "STORY" },
};

export default function CalendarPage() {
  const navigate = useNavigate();
  const { dispatch } = useWizard();
  const session = useSessionDict();
  const [selectedDay, setSelectedDay] = useState("15");

  const handleNext = () => {
    session.set({ current_step: 8 });
    sessionLogger.nav(7, 8, session.data.session_id);
    dispatch({ type: "SET_STEP", step: 8 });
    navigate("/schedule");
  };

  return (
    <div className="animate-slide-up">
      <PanelHeader
        eyebrow="Step 7 of 9 · Output"
        title="30-Day Campaign Calendar"
        description="Your full content plan, day by day. Click any date to edit: swap content, change format, add a post, or mark as rest day."
      />

      <Alert variant="mint" icon="📅" className="mb-4">
        Campaign runs <strong>15 March – 13 April 2026</strong> · 30 posts planned · Budget: <strong>₹700/day</strong> · Posting times optimised for Delhi, Mumbai, Bangalore audience peak hours.
      </Alert>

      <div className="flex flex-wrap gap-4 mb-3.5">
        {[
          { color: "bg-coral/50", label: "Feed Post" },
          { color: "bg-mint/50", label: "Reel" },
          { color: "bg-sky/50", label: "Story" },
          { color: "bg-rim", label: "Rest Day" },
        ].map((l) => (
          <div key={l.label} className="flex items-center gap-1.5 text-[0.75rem] text-fg-2">
            <div className={`w-2 h-2 rounded-sm ${l.color}`} />
            {l.label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5 mb-6">
        {HEADERS.map((h) => (
          <div key={h} className="text-center text-[0.68rem] font-bold uppercase tracking-[1.5px] text-fg-3 py-2">
            {h}
          </div>
        ))}
        {CAL_DATA.map((d, i) => (
          <button
            key={i}
            onClick={() => !d.empty && setSelectedDay(d.day)}
            disabled={d.empty}
            className={cn(
              "bg-ink-3 border border-rim rounded-lg p-2 min-h-[70px] text-[0.68rem] text-left cursor-pointer transition-all hover:border-rim-2 hover:bg-glass-2 relative",
              d.empty && "opacity-30 cursor-default pointer-events-none",
              d.type && "border-coral/25",
              selectedDay === d.day && "border-coral shadow-[0_0_0_2px_var(--accent-glow-border)]",
            )}
          >
            <div className="text-[0.7rem] font-bold text-fg-3 mb-1">{d.day}</div>
            {d.type && (
              <>
                <span className={`text-[0.6rem] font-bold tracking-wider px-1.5 py-0.5 rounded ${TYPE_STYLES[d.type].bg} ${TYPE_STYLES[d.type].text} inline-block mb-0.5`}>
                  {TYPE_STYLES[d.type].label}
                </span>
                <div className="text-[0.6rem] text-fg-3 leading-snug line-clamp-2">{d.text}</div>
              </>
            )}
          </button>
        ))}
      </div>

      <Alert variant="amber" icon="📆" className="mb-6">
        Plan your next month before this campaign ends. The system keeps your calendar <strong>always 30 days ahead</strong>. You'll receive a reminder 5 days before the current campaign ends.
      </Alert>

      <NavBar step={7} label="Calendar" backPath="/variants" nextPath="/schedule" nextLabel="Set Up Scheduling →" onNext={handleNext} />
    </div>
  );
}

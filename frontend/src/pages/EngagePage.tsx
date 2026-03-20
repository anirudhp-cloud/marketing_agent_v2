import { useState, useEffect } from "react";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { NavBar } from "@/components/ui/NavBar";
import { Chip } from "@/components/ui/Chip";
import { SectionBreak } from "@/components/ui/SectionBreak";
import { Alert } from "@/components/ui/Alert";
import { useSessionDict } from "@/context/SessionContext";
import { sessionLogger } from "@/lib/sessionLogger";

const MOCK_COMMENTS: {
  id: string; initials: string; gradient: string;
  comment: string; meta: string; escalate: boolean; replies: string[];
}[] = [
  {
    id: "c1",
    initials: "RK",
    gradient: "from-coral to-amber",
    comment: "Just ordered the dashcam! How long does shipping take to Pune? 🚗",
    meta: "Rahul K. · 2 hours ago · Post: Lifestyle — Upgrade your drive",
    escalate: false,
    replies: [
      "Hey Rahul! 🙌 Pune orders usually arrive in 3–5 business days. You'll get a tracking link within 24 hours. Drive safe!",
      "Thanks for choosing SmartWheels, Rahul! Shipping to Pune is typically 3–5 days. We'll send tracking details soon 📦",
    ],
  },
  {
    id: "c2",
    initials: "NP",
    gradient: "from-sky to-mint",
    comment: "I got a defective product last time and no one responded to my email for 2 weeks. Very disappointed.",
    meta: "Neha P. · 5 hours ago · Post: 10K drivers trust SmartWheels",
    escalate: true,
    replies: [
      "Hi Neha, we're really sorry about this experience. We're escalating this to our support lead right away. Expect a call within 4 hours.",
      "Neha, this isn't the SmartWheels standard. We've flagged your case as priority — our team will reach out directly today.",
    ],
  },
  {
    id: "c3",
    initials: "AP",
    gradient: "from-lilac to-coral",
    comment: "Love the OBD scanner! Works perfectly with my Hyundai Creta. Best purchase this year 💯",
    meta: "Amit P. · 1 day ago · Reel: Stop guessing. Know your car.",
    escalate: false,
    replies: [
      "Amit, that's amazing to hear! 🔥 The OBD scanner + Creta is a killer combo. Mind sharing a quick review? We'd love to feature you!",
      "Thanks Amit! Glad the OBD scanner is working great with your Creta 🙌 Tag us in your stories for a chance to be featured!",
    ],
  },
];

const ESCALATION_RULES = [
  "Complaint / refund", "Legal threat", "Negative review", "Complex question", "Competitor mention", "Media enquiry",
];

export default function EngagePage() {
  const session = useSessionDict();
  const [activeRules, setActiveRules] = useState<string[]>(session.data.engagement_rules.length ? session.data.engagement_rules : ["Complaint / refund", "Legal threat", "Negative review", "Complex question"]);

  // Sync → SessionContext
  useEffect(() => {
    session.set({ engagement_rules: activeRules, current_step: 9 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRules]);

  const toggle = (rule: string) => {
    setActiveRules((prev) => prev.includes(rule) ? prev.filter((r) => r !== rule) : [...prev, rule]);
  };

  return (
    <div className="animate-slide-up">
      <PanelHeader
        eyebrow="Step 9 of 9 · Engagement"
        title="Engagement Management"
        description="AI monitors your post comments and suggests personalised, brand-tone-consistent replies. You review and approve before anything goes live."
      />

      <Alert variant="mint" icon="🤖" className="mb-6">
        Auto-reply suggestions are based on your <strong>Bold & Direct</strong> brand tone and the SmartWheels campaign context. Human escalation rules flag sensitive or complex comments automatically.
      </Alert>

      <SectionBreak label="Brand Tone Training" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="flex flex-col gap-1.5">
          <label className="text-[0.78rem] font-semibold text-fg-2">Existing Communication Examples</label>
          <textarea
            defaultValue="SmartWheels is about smart choices for your car — practical, reliable, and affordable. We talk like a knowledgeable friend, not a salesperson. Tone: Bold & Direct. We use emojis sparingly and always sign off positively."
            placeholder="Describe your brand's communication style and tone..."
            className="bg-ink-3 border border-rim rounded-r2 px-3.5 py-2.5 text-fg text-sm outline-none resize-y min-h-[80px] leading-relaxed focus:border-coral/45 transition-all"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[0.78rem] font-semibold text-fg-2">
            Reference URLs <span className="text-fg-3 font-normal">(Instagram posts, podcast, blog)</span>
          </label>
          <textarea
            placeholder="https://instagram.com/p/… one per line"
            className="bg-ink-3 border border-rim rounded-r2 px-3.5 py-2.5 text-fg text-sm outline-none resize-y min-h-[80px] leading-relaxed focus:border-coral/45 transition-all"
          />
        </div>
      </div>

      <SectionBreak label="Live Comment Suggestions (Preview)" />
      {MOCK_COMMENTS.map((c) => (
        <div key={c.id} className="bg-ink-3 border border-rim rounded-r p-4.5 mb-3">
          <div className="flex items-start gap-3 mb-3">
            <div className={`w-[38px] h-[38px] rounded-full flex-shrink-0 bg-gradient-to-br ${c.gradient} flex items-center justify-center text-[0.82rem] font-bold`}>
              {c.initials}
            </div>
            <div>
              <div className="text-[0.85rem] leading-relaxed text-fg-2">{c.comment}</div>
              <div className="text-[0.7rem] text-fg-3 mt-1">{c.meta}</div>
            </div>
          </div>

          {c.escalate && (
            <div className="inline-flex items-center gap-1.5 text-[0.7rem] text-amber font-bold px-2.5 py-0.5 rounded-md bg-amber/10 border border-amber/20 mb-2.5">
              ⚠️ Human Escalation Required — Complaint
            </div>
          )}

          {!c.escalate && (
            <div className="text-[0.72rem] text-fg-3 font-semibold uppercase tracking-wider mb-2">
              AI Reply Suggestions
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            {c.replies.map((r, i) => (
              <div
                key={i}
                className={`p-2.5 px-3.5 rounded-lg bg-black/[0.02] border border-rim text-[0.8rem] text-fg-2 flex justify-between items-center gap-3 cursor-pointer transition-all hover:border-rim-2 hover:bg-glass-2 ${c.escalate ? "opacity-50" : ""}`}
              >
                <span>{r}</span>
                <span className="text-[0.7rem] text-coral font-bold px-2.5 py-1 rounded-md bg-coral/[0.08] border border-coral/20 flex-shrink-0 whitespace-nowrap">
                  {c.escalate ? "Draft Only" : "Use This"}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}

      <SectionBreak label="Escalation Rules" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="flex flex-col gap-1.5">
          <label className="text-[0.78rem] font-semibold text-fg-2">Auto-escalate when comment contains</label>
          <div className="flex flex-wrap gap-2 mt-1.5">
            {ESCALATION_RULES.map((r) => (
              <Chip key={r} label={r} selected={activeRules.includes(r)} onClick={() => toggle(r)} />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[0.78rem] font-semibold text-fg-2">Route escalations to</label>
            <select className="bg-ink-3 border border-rim rounded-r2 px-3.5 py-2.5 text-fg text-sm outline-none cursor-pointer focus:border-coral/45 transition-all appearance-none">
              <option>Team lead (email notification)</option>
              <option>Slack channel #support</option>
              <option>WhatsApp alert</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[0.78rem] font-semibold text-fg-2">Response time SLA</label>
            <select className="bg-ink-3 border border-rim rounded-r2 px-3.5 py-2.5 text-fg text-sm outline-none cursor-pointer focus:border-coral/45 transition-all appearance-none">
              <option>Reply within 2 hours</option>
              <option>Reply within 4 hours</option>
              <option>Reply within 24 hours</option>
            </select>
          </div>
        </div>
      </div>

      {/* Campaign complete banner */}
      <div className="bg-gradient-to-br from-coral/[0.08] to-lilac/[0.05] border border-coral/20 rounded-r p-5 px-6 flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h3 className="text-base font-bold text-coral mb-1">🎉 Campaign Setup Complete!</h3>
          <p className="text-[0.82rem] text-fg-2">Your SmartWheels campaign is configured, generated, and ready to publish. <strong>30 posts</strong> scheduled from <strong>15 March – 13 April 2026</strong>. Activate to start posting.</p>
        </div>
        <button
          onClick={() => {
            sessionLogger.dump("EngagePage → ACTIVATE", session.snapshot() as unknown as Record<string, unknown>);
            sessionLogger.session("CAMPAIGN_ACTIVATED", { session_id: session.data.session_id });
            alert("🚀 Campaign Activated!");
          }}
          className="px-6 py-3 rounded-[9px] text-sm font-bold bg-gradient-to-br from-coral to-[var(--btn-gradient-to)] text-white shadow-[0_4px_20px_var(--accent-glow)] hover:translate-y-[-1px] transition-all whitespace-nowrap"
        >
          Activate Campaign 🚀
        </button>
      </div>

      <NavBar
        step={9}
        label="Engagement Management"
        backPath="/schedule"
        nextPath="/engage"
        nextLabel="Activate Campaign ✓"
        nextVariant="mint"
        onNext={() => {
          sessionLogger.dump("EngagePage → final", session.snapshot() as unknown as Record<string, unknown>);
          sessionLogger.session("CAMPAIGN_ACTIVATED", { session_id: session.data.session_id });
          alert("🚀 Campaign Activated!");
        }}
      />
    </div>
  );
}

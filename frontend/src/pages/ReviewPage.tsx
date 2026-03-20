import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { NavBar } from "@/components/ui/NavBar";
import { Alert } from "@/components/ui/Alert";
import { GeneratingOverlay } from "@/components/ui/GeneratingOverlay";
import { useWizard } from "@/context/WizardContext";
import { wizardApi, campaignApi } from "@/lib/api";
import { useSessionDict } from "@/context/SessionContext";
import { sessionLogger } from "@/lib/sessionLogger";
import { formatCurrency } from "@/lib/utils";

const STEP_MAP: Record<string, { icon: string; label: string; index: number }> = {
  composing_context:   { icon: "🧠", label: "Analysing brand inputs", index: 0 },
  calling_gpt:         { icon: "✍️", label: "Generating campaign copy variants", index: 1 },
  parsing_response:    { icon: "🔍", label: "Parsing AI response", index: 2 },
  saving_variants:     { icon: "💾", label: "Saving variant data", index: 3 },
  generating_videos:   { icon: "🎬", label: "Generating Reel videos via Sora", index: 4 },
  generating_images:   { icon: "🎨", label: "Generating AI images via FLUX", index: 5 },
  images_done:         { icon: "✅", label: "Generation complete!", index: 6 },
};

const INITIAL_STEPS = [
  { icon: "🧠", label: "Analysing brand inputs", status: "pending" as const },
  { icon: "✍️", label: "Generating campaign copy variants", status: "pending" as const },
  { icon: "🔍", label: "Parsing AI response", status: "pending" as const },
  { icon: "💾", label: "Saving variant data", status: "pending" as const },
  { icon: "🎬", label: "Generating Reel videos via Sora", status: "pending" as const },
  { icon: "🎨", label: "Generating AI images via FLUX", status: "pending" as const },
  { icon: "✅", label: "Generation complete!", status: "pending" as const },
];

const GOAL_LABELS: Record<string, string> = {
  brand_awareness: "Brand Awareness",
  follower_growth: "Follower Growth",
  engagement: "Engagement",
  traffic: "Traffic",
  conversion: "Conversion",
  promotional: "Promotional",
};

export default function ReviewPage() {
  const navigate = useNavigate();
  const { dispatch } = useWizard();
  const session = useSessionDict();
  const d = session.data;
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [genProgress, setGenProgress] = useState(0);
  type StepStatus = "pending" | "active" | "done";
  const [genSteps, setGenSteps] = useState<{ icon: string; label: string; status: StepStatus }[]>(
    INITIAL_STEPS.map((s) => ({ ...s })),
  );

  const formatDate = (iso: string) => {
    if (!iso) return "Not set";
    try {
      return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch { return iso; }
  };

  const startGenerate = async () => {
    setGenError(null);
    session.set({ current_step: 5 });
    const sid = d.session_id || session.ensureSessionId();
    sessionLogger.nav(5, 6, sid);
    sessionLogger.dump("ReviewPage → generate", session.snapshot() as unknown as Record<string, unknown>);

    // Preflight check
    try {
      const check = await campaignApi.preflight(sid);
      if (!check.ready) {
        setGenError(`Missing: ${check.missing.join(", ")}. Go back and complete all steps.`);
        return;
      }
    } catch (err: any) {
      setGenError(err.message || "Preflight check failed");
      return;
    }

    setGenerating(true);
    setGenSteps(INITIAL_STEPS.map((s) => ({ ...s })));
    setGenProgress(0);

    // Connect to SSE
    const es = campaignApi.generateStream(sid);

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const stepKey = data.step as string;

        if (stepKey === "error") {
          es.close();
          setGenerating(false);
          setGenError(data.message || "Generation failed");
          return;
        }

        // "done" from copy_generator is intermediate — keep SSE open for video + image generation
        if (stepKey === "done") {
          setGenSteps((prev) =>
            prev.map((s, idx) => ({
              ...s,
              status: idx <= 3 ? "done" : "pending",
            })),
          );
          setGenProgress((4 / INITIAL_STEPS.length) * 100);
          return;
        }

        // video_ready — update reel progress
        if (stepKey === "video_ready") {
          setGenSteps((prev) =>
            prev.map((s, idx) => ({
              ...s,
              status: idx < 4 ? "done" : idx === 4 ? "active" : "pending",
              label: idx === 4 ? `Generating Reel videos via Sora (variant ${data.variant_id})` : s.label,
            })),
          );
          setGenProgress((4.5 / INITIAL_STEPS.length) * 100);
          return;
        }

        // video_error — log but continue
        if (stepKey === "video_error") {
          console.warn(`Reel generation failed for variant ${data.variant_id}: ${data.message}`);
          return;
        }

        // videos_done — mark reel step complete, keep SSE open for images
        if (stepKey === "videos_done") {
          setGenSteps((prev) =>
            prev.map((s, idx) => ({
              ...s,
              status: idx <= 4 ? "done" : "pending",
              label: idx === 4 && data.skipped ? "Reel generation skipped" : s.label,
            })),
          );
          setGenProgress((5 / INITIAL_STEPS.length) * 100);
          return;
        }

        // image_ready — update progress label
        if (stepKey === "image_ready") {
          setGenSteps((prev) =>
            prev.map((s, idx) => ({
              ...s,
              status: idx < 5 ? "done" : idx === 5 ? "active" : "pending",
              label: idx === 5 ? `Generating AI images via FLUX (${data.size})` : s.label,
            })),
          );
          return;
        }

        // image_error — log but continue
        if (stepKey === "image_error") {
          console.warn(`Image generation failed for variant ${data.variant_id}: ${data.message}`);
          return;
        }

        // images_done — final event, navigate
        if (stepKey === "images_done") {
          es.close();
          setGenSteps((prev) => prev.map((s) => ({ ...s, status: "done" as const })));
          setGenProgress(100);
          setTimeout(async () => {
            try {
              await wizardApi.submitStep(sid, 5, { approved: true, variant_count: data.count });
            } catch (err) {
              console.error("Failed to save step 5:", err);
            }
            setGenerating(false);
            dispatch({ type: "SET_STEP", step: 6 });
            navigate("/variants");
          }, 800);
          return;
        }

        const mapped = STEP_MAP[stepKey];
        if (mapped) {
          setGenSteps((prev) =>
            prev.map((s, idx) => ({
              ...s,
              status: idx < mapped.index ? "done" : idx === mapped.index ? "active" : "pending",
            })),
          );
          setGenProgress(((mapped.index + 1) / INITIAL_STEPS.length) * 100);
        }
      } catch {
        // ignore parse errors in SSE
      }
    };

    es.onerror = () => {
      es.close();
      setGenerating(false);
      setGenError("Connection lost during generation. Please try again.");
    };
  };

  return (
    <div className="animate-slide-up">
      <GeneratingOverlay show={generating} steps={genSteps} progress={genProgress} />

      {genError && (
        <Alert variant="coral" icon="⚠️" className="mb-4">
          {genError}
        </Alert>
      )}

      <PanelHeader
        eyebrow="Step 5 of 9 · Review"
        title="Review & Approve Setup"
        description="Confirm every setting before the AI generates your campaign. You can still go back to change anything."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Business Profile */}
        <div className="bg-ink-3 border border-rim rounded-r p-5">
          <div className="text-[0.67rem] uppercase tracking-[2.5px] text-fg-3 font-bold mb-3.5">
            Business Profile
          </div>
          {([
            ["Company", d.company_name || "—"],
            ["Website", d.website_url || "—"],
            ["Category", d.product_category || "—"],
            ["Store Type", d.store_type ? d.store_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "—"],
            ["Brand Colours", d.brand_colours?.length ? d.brand_colours.join(" · ") : "Not set"],
          ] as [string, string][]).map(([k, v]) => (
            <div key={k} className="flex justify-between items-start mb-2.5 last:mb-0 text-[0.82rem] gap-3">
              <span className="text-fg-3">{k}</span>
              <span className="text-fg font-medium text-right">{v}</span>
            </div>
          ))}
          {d.target_market_location && (
            <>
              <div className="text-[0.67rem] uppercase tracking-[2.5px] text-fg-3 font-bold mt-3 mb-2">Target Market</div>
              <div className="flex flex-wrap gap-1.5">
                {d.target_market_location.split("|").map((loc) => loc.trim()).filter(Boolean).map((loc) => (
                  <span key={loc} className="px-2.5 py-0.5 rounded-md text-[0.72rem] font-semibold bg-lilac/[0.08] text-lilac border border-lilac/20">
                    {loc}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Audience */}
        <div className="bg-ink-3 border border-rim rounded-r p-5">
          <div className="text-[0.67rem] uppercase tracking-[2.5px] text-fg-3 font-bold mb-3.5">
            Audience
          </div>
          {([
            ["Primary", d.primary_segment || "—"],
            ["Age Range", d.age_range?.length ? d.age_range.join(", ") : "—"],
            ["Gender", d.gender_focus || "All"],
            ["Activity", d.activity_level || "—"],
          ] as [string, string][]).map(([k, v]) => (
            <div key={k} className="flex justify-between items-start mb-2.5 last:mb-0 text-[0.82rem] gap-3">
              <span className="text-fg-3">{k}</span>
              <span className="text-fg font-medium text-right">{v}</span>
            </div>
          ))}
          {d.geo_targeting && (
            <>
              <div className="text-[0.67rem] uppercase tracking-[2.5px] text-fg-3 font-bold mt-3 mb-2">Geography</div>
              <div className="flex flex-wrap gap-1.5">
                {d.geo_targeting.split("|").map((loc) => loc.trim()).filter(Boolean).map((loc) => (
                  <span key={loc} className="px-2.5 py-0.5 rounded-md text-[0.72rem] font-semibold bg-lilac/[0.08] text-lilac border border-lilac/20">
                    {loc}
                  </span>
                ))}
              </div>
            </>
          )}
          {d.audience_segments?.length > 0 && (
            <>
              <div className="text-[0.67rem] uppercase tracking-[2.5px] text-fg-3 font-bold mt-3 mb-2">Segments</div>
              <div className="flex flex-wrap gap-1.5">
                {d.audience_segments.map((s) => (
                  <span key={s} className="px-2.5 py-0.5 rounded-md text-[0.72rem] font-semibold bg-coral/[0.08] text-coral border border-coral/20">
                    {s}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Campaign */}
        <div className="bg-ink-3 border border-rim rounded-r p-5">
          <div className="text-[0.67rem] uppercase tracking-[2.5px] text-fg-3 font-bold mb-3.5">
            Campaign
          </div>
          {([
            ["Goal", GOAL_LABELS[d.goal_type] || d.goal_type || "—"],
            ["Budget", d.budget ? formatCurrency(d.budget) : "—"],
            ["Duration", d.duration_days ? `${d.duration_days} days` : "—"],
            ["Start", formatDate(d.start_date)],
            ["Channel", "Instagram"],
          ] as [string, string][]).map(([k, v]) => (
            <div key={k} className="flex justify-between items-start mb-2.5 last:mb-0 text-[0.82rem] gap-3">
              <span className="text-fg-3">{k}</span>
              <span className={`font-medium text-right ${k === "Channel" ? "text-mint" : "text-fg"}`}>{v}</span>
            </div>
          ))}
          {d.formats?.length > 0 && (
            <>
              <div className="text-[0.67rem] uppercase tracking-[2.5px] text-fg-3 font-bold mt-3 mb-2">Formats</div>
              <div className="flex flex-wrap gap-1.5">
                {d.formats.map((f) => (
                  <span key={f} className="px-2.5 py-0.5 rounded-md text-[0.72rem] font-semibold bg-mint/[0.08] text-mint border border-mint/20">
                    {f}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Creative */}
        <div className="bg-ink-3 border border-rim rounded-r p-5">
          <div className="text-[0.67rem] uppercase tracking-[2.5px] text-fg-3 font-bold mb-3.5">
            Creative
          </div>
          {([
            ["Image Style", d.image_style || "—"],
            ["Content Type", Array.isArray(d.content_type) && d.content_type.length ? d.content_type.map((t: string) => t.charAt(0).toUpperCase() + t.slice(1)).join(" · ") : "—"],
            ["Sizes", d.image_sizes?.length ? d.image_sizes.join(" · ") : "—"],
            ["Variants", d.variant_count ? String(d.variant_count) : "—"],
            ["Tone", d.tone_of_voice || "—"],
            ["Hashtag Count", d.hashtag_count || "—"],
            ["Hashtag Mix", d.hashtag_mix || "—"],
          ] as [string, string][]).map(([k, v]) => (
            <div key={k} className="flex justify-between items-start mb-2.5 last:mb-0 text-[0.82rem] gap-3">
              <span className="text-fg-3">{k}</span>
              <span className="text-fg font-medium text-right">{v}</span>
            </div>
          ))}
          {d.seed_hashtags && (
            <>
              <div className="text-[0.67rem] uppercase tracking-[2.5px] text-fg-3 font-bold mt-3 mb-2">Seed Hashtags</div>
              <div className="flex flex-wrap gap-1.5">
                {d.seed_hashtags.split(/\s+/).filter(Boolean).map((h) => (
                  <span key={h} className="px-2.5 py-0.5 rounded-md text-[0.72rem] font-semibold bg-sky/[0.08] text-sky border border-sky/20">
                    {h}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* What AI will generate */}
      <div className="bg-ink-3 border border-rim rounded-r p-5 mb-6">
        <div className="text-[0.67rem] uppercase tracking-[2.5px] text-fg-3 font-bold mb-3">What the AI Will Generate</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
          {[
            { color: "bg-coral", text: `${d.variant_count || 4} campaign copy variants with distinct angles & CTAs` },
            { color: "bg-sky", text: `Hashtag sets per post (${d.hashtag_count || "10–15"}, ${d.hashtag_mix || "mixed strategy"})` },
            { color: "bg-mint", text: "Image generation prompts for each variant" },
            { color: "bg-lilac", text: "Recommended variant flagged based on your goal" },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-[0.8rem] text-fg-2">
              <div className={`w-1.5 h-1.5 rounded-full ${item.color} shadow-[0_0_6px_currentColor] flex-shrink-0`} />
              {item.text}
            </div>
          ))}
        </div>
      </div>

      <Alert variant="coral" icon="⚡" className="mb-6">
        Copy variants ready in ~30 seconds · Hashtags + image prompts included · All powered by GPT-4o.
      </Alert>

      <NavBar
        step={5}
        label="Review"
        backPath="/creative"
        nextPath="/variants"
        nextLabel="🚀  Generate Campaign"
        onNext={startGenerate}
      />
    </div>
  );
}

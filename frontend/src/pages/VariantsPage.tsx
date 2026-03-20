import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { NavBar } from "@/components/ui/NavBar";
import { SectionBreak } from "@/components/ui/SectionBreak";
import { Alert } from "@/components/ui/Alert";
import { useWizard } from "@/context/WizardContext";
import { cn } from "@/lib/utils";
import { useSessionDict } from "@/context/SessionContext";
import { sessionLogger } from "@/lib/sessionLogger";
import { variantsApi, campaignApi, API_BASE } from "@/lib/api";

interface Variant {
  id: number;
  angle: string;
  headline: string;
  copy: string;
  cta: string;
  target_segment: string | null;
  imagery_style: string | null;
  image_url: string | null;
  video_url: string | null;
  image_prompt: string | null;
  hashtags: string[];
  score: number | null;
  recommended: boolean;
  compliance_status: string;
}

/* ── Swipable Media Carousel (video first, image second) ── */
function MediaCarousel({ videoUrl, imageUrl, alt }: { videoUrl: string | null; imageUrl: string | null; alt: string }) {
  const base = API_BASE;
  const slides: { type: "video" | "image"; src: string }[] = [];
  if (videoUrl) slides.push({ type: "video", src: `${base}${videoUrl}` });
  if (imageUrl) slides.push({ type: "image", src: `${base}${imageUrl}` });
  if (slides.length === 0) return null;

  const [idx, setIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);

  const handlePointerDown = (e: React.PointerEvent) => { startX.current = e.clientX; };
  const handlePointerUp = (e: React.PointerEvent) => {
    const dx = e.clientX - startX.current;
    if (Math.abs(dx) > 40) {
      if (dx < 0 && idx < slides.length - 1) setIdx(idx + 1);
      if (dx > 0 && idx > 0) setIdx(idx - 1);
    }
  };

  const current = slides[idx];

  return (
    <div className="mb-3 rounded-lg overflow-hidden border border-rim relative select-none" ref={containerRef}>
      {/* Slide */}
      <div
        className="w-full"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        style={{ touchAction: "pan-y" }}
      >
        {current.type === "video" ? (
          <video
            key={current.src}
            src={current.src}
            className="w-full h-auto object-cover max-h-[340px]"
            autoPlay
            muted
            loop
            playsInline
          />
        ) : (
          <img
            key={current.src}
            src={current.src}
            alt={alt}
            className="w-full h-auto object-cover max-h-[300px]"
            loading="lazy"
          />
        )}
      </div>

      {/* Dots indicator */}
      {slides.length > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
          {slides.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={(e) => { e.stopPropagation(); setIdx(i); }}
              className={cn(
                "w-2 h-2 rounded-full transition-all",
                i === idx ? "bg-coral scale-125" : "bg-white/50",
              )}
              aria-label={`Show ${s.type}`}
            />
          ))}
        </div>
      )}

      {/* Label badge */}
      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md text-[0.65rem] font-bold uppercase tracking-wider bg-black/60 text-white">
        {current.type === "video" ? "🎬 Reel" : "🖼️ Image"}
      </div>
    </div>
  );
}

export default function VariantsPage() {
  const navigate = useNavigate();
  const { dispatch } = useWizard();
  const session = useSessionDict();
  const [variants, setVariants] = useState<Variant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(session.data.selected_variant_id ?? null);
  const [removedTags, setRemovedTags] = useState<string[]>([]);
  const [regenText, setRegenText] = useState("");
  const [regenerating, setRegenerating] = useState(false);

  // Load variants from backend on mount
  useEffect(() => {
    const sid = session.data.session_id;
    if (!sid) {
      setError("No session found. Please start from Step 1.");
      setLoading(false);
      return;
    }

    variantsApi.list(sid).then((res) => {
      setVariants(res.variants);
      if (res.variants.length > 0 && selected === null) {
        const rec = res.variants.find((v) => v.recommended);
        setSelected(rec ? rec.id : res.variants[0].id);
      }
      setLoading(false);
    }).catch((err) => {
      setError(err.message || "Failed to load variants");
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync selected → SessionContext
  useEffect(() => {
    if (selected !== null) {
      session.set({ selected_variant_id: selected, current_step: 6 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  // Collect all unique hashtags across variants
  const allHashtags = Array.from(
    new Set(variants.flatMap((v) => v.hashtags)),
  );

  const handleRegenerate = async () => {
    const sid = session.data.session_id;
    if (!sid || regenerating) return;

    setRegenerating(true);
    setError(null);

    const es = campaignApi.regenerate(sid, regenText);

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.step === "error") {
          es.close();
          setRegenerating(false);
          setError(data.message);
          return;
        }
        if (data.step === "done") {
          es.close();
          variantsApi.list(sid).then((res) => {
            setVariants(res.variants);
            if (res.variants.length > 0) {
              const rec = res.variants.find((v) => v.recommended);
              setSelected(rec ? rec.id : res.variants[0].id);
            }
            setRemovedTags([]);
            setRegenText("");
            setRegenerating(false);
          }).catch(() => {
            setRegenerating(false);
          });
        }
      } catch {
        // ignore
      }
    };

    es.onerror = () => {
      es.close();
      setRegenerating(false);
      setError("Regeneration connection lost. Please try again.");
    };
  };

  const handleNext = () => {
    sessionLogger.nav(6, 7, session.data.session_id);
    dispatch({ type: "SET_STEP", step: 7 });
    navigate("/calendar");
  };

  if (loading) {
    return (
      <div className="animate-slide-up flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-12 h-12 rounded-[14px] bg-gradient-to-br from-coral to-lilac flex items-center justify-center text-2xl animate-pulse_glow">
          ✨
        </div>
        <div className="text-fg-2 text-sm">Loading campaign variants…</div>
      </div>
    );
  }

  if (error && variants.length === 0) {
    return (
      <div className="animate-slide-up">
        <PanelHeader
          eyebrow="Step 6 of 9 · Output"
          title="Campaign Variants"
          description="Something went wrong loading your variants."
        />
        <Alert variant="coral" icon="⚠️" className="mb-6">{error}</Alert>
        <NavBar step={6} label="Variants" backPath="/review" nextPath="/calendar" nextLabel="Proceed to Calendar →" />
      </div>
    );
  }

  return (
    <div className="animate-slide-up">
      <PanelHeader
        eyebrow="Step 6 of 9 · Output"
        title="Campaign Variants"
        description={`${variants.length} distinct variants generated. Each has a different angle, CTA, and content strategy. Select one to proceed, or refine using the prompt below.`}
      />

      {error && (
        <Alert variant="coral" icon="⚠️" className="mb-4">{error}</Alert>
      )}

      {/* Variant cards */}
      {variants.map((v) => (
        <button
          key={v.id}
          type="button"
          onClick={() => setSelected(v.id)}
          className={cn(
            "block w-full text-left bg-ink-3 border-[1.5px] border-rim rounded-r p-5 mb-3.5 cursor-pointer transition-all relative hover:border-rim-2 hover:translate-x-[3px]",
            selected === v.id && "border-coral/50 bg-coral/[0.04]",
            v.recommended && "before:content-['⭐_RECOMMENDED'] before:absolute before:-top-px before:right-5 before:bg-gradient-to-br before:from-coral before:to-amber before:text-white before:text-[0.6rem] before:font-extrabold before:tracking-[1.5px] before:px-2.5 before:py-0.5 before:rounded-b-lg",
          )}
        >
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <div className="text-[0.7rem] font-bold uppercase tracking-[1.5px] text-coral mb-1">{v.angle}</div>
              <div className="text-base font-bold leading-snug">{v.headline}</div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={cn("text-[0.78rem] font-bold", selected === v.id ? "text-coral" : "text-fg-3")}>
                {selected === v.id ? "✓ Selected" : "○ Select"}
              </span>
              {v.score != null && (
                <div className={cn(
                  "w-8 h-8 rounded-lg bg-glass-2 border border-rim flex items-center justify-center text-[0.72rem] font-extrabold text-fg-3",
                  selected === v.id && "bg-coral/[0.15] border-coral/30 text-coral",
                )}>
                  {Math.round(v.score)}
                </div>
              )}
            </div>
          </div>
          <div className="text-[0.82rem] text-fg-2 leading-relaxed mb-3 whitespace-pre-line">{v.copy}</div>
          {v.hashtags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {v.hashtags.map((h) => (
                <span key={h} className="text-[0.76rem] font-semibold text-lilac">{h}</span>
              ))}
            </div>
          )}
          <MediaCarousel videoUrl={v.video_url} imageUrl={v.image_url} alt={v.headline} />
          <div className="flex gap-2 flex-wrap">
            {[
              v.target_segment && `🎯 ${v.target_segment}`,
              `CTA: ${v.cta}`,
              v.imagery_style && `🎨 ${v.imagery_style}`,
            ].filter(Boolean).map((tag) => (
              <span key={tag} className="px-2.5 py-0.5 rounded-md text-[0.7rem] font-semibold bg-black/[0.03] text-fg-3 border border-rim">
                {tag}
              </span>
            ))}
          </div>
        </button>
      ))}

      {/* Regen bar */}
      <div className="bg-ink-3 border border-rim rounded-r p-4 px-4.5 flex gap-3 items-center mt-2">
        <span className="text-base flex-shrink-0">✏️</span>
        <input
          value={regenText}
          onChange={(e) => setRegenText(e.target.value)}
          placeholder='Refine with AI — e.g. "Make it more playful" or "Change CTA to Follow Us"'
          className="flex-1 bg-transparent border-none text-sm text-fg outline-none placeholder:text-fg-3"
        />
        <button
          type="button"
          onClick={handleRegenerate}
          disabled={regenerating}
          className={cn(
            "px-4 py-2 rounded-lg bg-coral/10 border border-coral/25 text-coral text-[0.8rem] font-bold whitespace-nowrap hover:bg-coral/[0.18] hover:border-coral/45 transition-all",
            regenerating && "opacity-50 cursor-not-allowed",
          )}
        >
          {regenerating ? "Regenerating…" : "Regenerate →"}
        </button>
      </div>

      <SectionBreak label="Generated Hashtags (click to remove)" />
      <div className="flex flex-wrap gap-2 mb-8">
        {allHashtags.length > 0 ? (
          allHashtags.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => setRemovedTags((prev) => prev.includes(h) ? prev.filter((t) => t !== h) : [...prev, h])}
              className={cn(
                "px-3 py-1.5 rounded-md bg-sky/[0.07] border border-sky/[0.18] text-sky text-[0.78rem] font-medium cursor-pointer transition-all hover:bg-sky/[0.12]",
                removedTags.includes(h) && "opacity-35 line-through",
              )}
            >
              {h}
            </button>
          ))
        ) : (
          <span className="text-fg-3 text-sm">No hashtags generated</span>
        )}
      </div>

      <NavBar step={6} label="Variants" backPath="/review" nextPath="/calendar" nextLabel="Proceed to Calendar →" onNext={handleNext} />
    </div>
  );
}

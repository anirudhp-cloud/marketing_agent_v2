import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { NavBar } from "@/components/ui/NavBar";
import { OptionCard } from "@/components/ui/OptionCard";
import { ToggleBtn } from "@/components/ui/ToggleBtn";
import { SectionBreak } from "@/components/ui/SectionBreak";
import { Alert } from "@/components/ui/Alert";
import { useWizard } from "@/context/WizardContext";
import { wizardApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useSessionDict } from "@/context/SessionContext";
import { sessionLogger } from "@/lib/sessionLogger";

const IMAGE_STYLES = [
  { emoji: "🌇", name: "Lifestyle" },
  { emoji: "🔧", name: "Functional" },
  { emoji: "😄", name: "Humorous" },
  { emoji: "🎯", name: "Promotional" },
  { emoji: "📦", name: "Product-Only" },
];

const CONTENT_TYPES = [
  { icon: "�", name: "Post", hint: "Caption-only — text, hashtags & CTA", value: "post" as const },
  { icon: "🖼️", name: "Image", hint: "AI-generated static images via FLUX", value: "image" as const },
  { icon: "🎬", name: "Reel", hint: "Video scripts & storyboards", value: "reel" as const },
];

const SIZE_FORMATS = [
  { icon: "◼️", name: "Square", hint: "1080 × 1080 — Feed standard" },
  { icon: "▬", name: "Portrait", hint: "1080 × 1350 — More feed space" },
  { icon: "▭", name: "Landscape", hint: "1080 × 566 — Cinematic feel" },
];

const HASHTAG_COUNTS = [
  "5–8 (Focused)",
  "10–15 (Balanced) — Recommended",
  "20–25 (Maximum reach)",
  "30 (Aggressive)",
];

const HASHTAG_MIXES = [
  "Broad + Niche + Brand (Recommended)",
  "All Niche (high intent)",
  "All Broad (maximum reach)",
  "Brand-only",
];

const TONES = ["Bold & Direct", "Friendly", "Premium", "Playful", "Informative"];

export default function CreativePage() {
  const navigate = useNavigate();
  const { dispatch } = useWizard();
  const session = useSessionDict();
  const [imageStyle, setImageStyle] = useState(session.data.image_style || "Lifestyle");
  const [contentType, setContentType] = useState<string[]>(
    Array.isArray(session.data.content_type) && session.data.content_type.length
      ? session.data.content_type as string[]
      : ["post"],
  );
  const [imageSizes, setImageSizes] = useState<string[]>(session.data.image_sizes.length ? session.data.image_sizes : ["Square", "Portrait"]);
  const [hashtagCount, setHashtagCount] = useState(session.data.hashtag_count || "10–15 (Balanced) — Recommended");
  const [hashtagMix, setHashtagMix] = useState(session.data.hashtag_mix || "Broad + Niche + Brand (Recommended)");
  const [variantCount, setVariantCount] = useState(session.data.variant_count || 4);
  const [tone, setTone] = useState(session.data.tone_of_voice || "Bold & Direct");
  const [hashtagSeed, setHashtagSeed] = useState(session.data.seed_hashtags || "");

  // Sync → SessionContext
  useEffect(() => {
    session.set({
      image_style: imageStyle,
      content_type: contentType,
      image_sizes: imageSizes,
      hashtag_count: hashtagCount,
      hashtag_mix: hashtagMix,
      variant_count: variantCount,
      tone_of_voice: tone,
      seed_hashtags: hashtagSeed,
      current_step: 4,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageStyle, contentType, imageSizes, hashtagCount, hashtagMix, variantCount, tone, hashtagSeed]);

  const toggleSize = (name: string) => {
    setImageSizes((prev) => prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name]);
  };

  const toggleContentType = (value: string) => {
    setContentType((prev) => prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]);
  };

  const handleNext = async () => {
    const sid = session.data.session_id || session.ensureSessionId();
    sessionLogger.nav(4, 5, sid);
    sessionLogger.dump("CreativePage → submit", session.snapshot() as unknown as Record<string, unknown>);
    try {
      await wizardApi.submitStep(sid, 4, {
        imageStyle,
        contentType,
        imageSizes,
        seedHashtags: hashtagSeed,
        variantCount,
        toneOfVoice: tone,
        hashtagCount,
        hashtagMix,
      });
    } catch (err) {
      console.error("Failed to save step 4:", err);
    }
    dispatch({ type: "SET_STEP", step: 5 });
    navigate("/review");
  };

  return (
    <div className="animate-slide-up">
      <PanelHeader
        eyebrow="Step 4 of 9 · Setup"
        title="Creative Configuration"
        description="Define the visual and content direction. The more specific you are, the more on-brand your AI-generated images and copy will be."
      />

      <SectionBreak label="Image Style" />
      <div className="grid grid-cols-3 md:grid-cols-5 gap-2.5 mb-8">
        {IMAGE_STYLES.map((s) => (
          <button
            key={s.name}
            onClick={() => setImageStyle(s.name)}
            className={cn(
              "bg-ink-3 border-[1.5px] border-rim rounded-r2 p-3.5 px-2 text-center cursor-pointer transition-all hover:border-rim-2",
              imageStyle === s.name && "border-lilac/50 bg-lilac/[0.08]",
            )}
          >
            <div className="text-2xl mb-1.5">{s.emoji}</div>
            <div className={cn("text-[0.72rem] font-semibold text-fg-2", imageStyle === s.name && "text-lilac")}>{s.name}</div>
          </button>
        ))}
      </div>

      <SectionBreak label="Content Type for AI Generation" />
      <Alert variant="sky" icon="💡" className="mb-4">
        Select one or more: post (caption only), image (FLUX AI), reel (video). Combine freely.
      </Alert>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mb-8">
        {CONTENT_TYPES.map((c) => (
          <OptionCard
            key={c.value}
            icon={c.icon}
            name={c.name}
            hint={c.hint}
            selected={contentType.includes(c.value)}
            onClick={() => toggleContentType(c.value)}
          />
        ))}
      </div>

      <SectionBreak label="Image Size Format" />
      <Alert variant="sky" icon="📐" className="mb-4">
        All generated images are validated against Instagram's size requirements before you see them.
      </Alert>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mb-8">
        {SIZE_FORMATS.map((s) => (
          <OptionCard
            key={s.name}
            icon={s.icon}
            name={s.name}
            hint={s.hint}
            selected={imageSizes.includes(s.name)}
            onClick={() => toggleSize(s.name)}
          />
        ))}
      </div>

      <SectionBreak label="Hashtag Strategy" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-[0.78rem] font-semibold text-fg-2">Hashtag Count per Post</label>
          <select
            value={hashtagCount}
            onChange={(e) => setHashtagCount(e.target.value)}
            className="bg-ink-3 border border-rim rounded-r2 px-3.5 py-2.5 text-fg text-sm outline-none cursor-pointer focus:border-coral/45 transition-all appearance-none"
          >
            {HASHTAG_COUNTS.map((h) => <option key={h}>{h}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[0.78rem] font-semibold text-fg-2">Hashtag Mix Strategy</label>
          <select
            value={hashtagMix}
            onChange={(e) => setHashtagMix(e.target.value)}
            className="bg-ink-3 border border-rim rounded-r2 px-3.5 py-2.5 text-fg text-sm outline-none cursor-pointer focus:border-coral/45 transition-all appearance-none"
          >
            {HASHTAG_MIXES.map((h) => <option key={h}>{h}</option>)}
          </select>
        </div>
      </div>
      <div className="flex flex-col gap-1.5 mb-8">
        <label className="text-[0.78rem] font-semibold text-fg-2">
          Seed Hashtags <span className="text-fg-3 font-normal">(AI will expand from these)</span>
        </label>
        <input value={hashtagSeed} onChange={(e) => setHashtagSeed(e.target.value)} placeholder="#yourbrand #yourproduct #yourniche" className="bg-ink-3 border border-rim rounded-r2 px-3.5 py-2.5 text-fg text-sm outline-none focus:border-coral/45 transition-all" />
      </div>

      <SectionBreak label="Variant Generation" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="flex flex-col gap-1.5">
          <label className="text-[0.78rem] font-semibold text-fg-2">Number of Campaign Variants</label>
          <div className="flex gap-2">
            {[3, 4, 5].map((n) => (
              <ToggleBtn key={n} label={String(n)} selected={variantCount === n} onClick={() => setVariantCount(n)} />
            ))}
          </div>
          <span className="text-[0.7rem] text-fg-3 mt-1">AI will generate distinct variants with different angles, CTAs, and positioning.</span>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[0.78rem] font-semibold text-fg-2">Tone of Voice</label>
          <div className="flex flex-wrap gap-2">
            {TONES.map((t) => (
              <ToggleBtn key={t} label={t} selected={tone === t} onClick={() => setTone(t)} />
            ))}
          </div>
        </div>
      </div>

      <NavBar step={4} label="Creative Config" backPath="/goals" nextPath="/review" nextLabel="Review Setup →" onNext={handleNext} />
    </div>
  );
}

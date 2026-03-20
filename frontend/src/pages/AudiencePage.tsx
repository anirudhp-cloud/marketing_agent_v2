import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { NavBar } from "@/components/ui/NavBar";
import { Chip } from "@/components/ui/Chip";
import { ToggleBtn } from "@/components/ui/ToggleBtn";
import { SectionBreak } from "@/components/ui/SectionBreak";
import { Alert } from "@/components/ui/Alert";
import { LocationAutocomplete } from "@/components/ui/LocationAutocomplete";
import { useWizard } from "@/context/WizardContext";
import { wizardApi } from "@/lib/api";
import { useSessionDict } from "@/context/SessionContext";
import { sessionLogger } from "@/lib/sessionLogger";

const SEGMENTS = [
  "Young Professionals (25–35)", "Families with Teenagers", "Budget-Conscious Shoppers",
  "Premium Buyers", "Tech-Savvy Millennials", "Older Parents (45–60)",
  "First-Time Buyers", "Repeat Customers", "Daily Commuters", "Weekend Shoppers",
  "Health & Wellness Enthusiasts", "Eco-Conscious Consumers", "Students & Gen-Z",
  "Small Business Owners", "Corporate / B2B Buyers",
];
const ACTIVITY_LEVELS = ["Daily active users", "2–3x per week", "Occasional browsers"];
const AGE_RANGES = ["18–24", "25–34", "35–44", "45–54", "55+"];
const GENDERS = ["All", "Male-skewed", "Female-skewed"];

export default function AudiencePage() {
  const navigate = useNavigate();
  const { dispatch } = useWizard();
  const session = useSessionDict();

  const [segments, setSegments] = useState<string[]>(
    session.data.audience_segments.length ? session.data.audience_segments : []
  );
  const [ageRange, setAgeRange] = useState<string[]>(
    session.data.age_range.length ? session.data.age_range : []
  );
  const [gender, setGender] = useState(session.data.gender_focus || "All");
  const [activityLevel, setActivityLevel] = useState(session.data.activity_level || "Daily active users");
  const [description, setDescription] = useState(session.data.audience_description || "");
  const [geo, setGeo] = useState(
    session.data.geo_targeting || session.data.target_market_location || ""
  );
  const [primarySegment, setPrimarySegment] = useState(session.data.primary_segment || "");
  const [secondarySegment, setSecondarySegment] = useState(session.data.secondary_segment || "");
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Auto-set primary/secondary when segments change
  useEffect(() => {
    if (segments.length && !segments.includes(primarySegment)) {
      setPrimarySegment(segments[0]);
    }
    if (secondarySegment && !segments.includes(secondarySegment)) {
      setSecondarySegment("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments]);

  // Sync local state → SessionContext
  useEffect(() => {
    session.set({
      audience_segments: segments,
      audience_description: description,
      geo_targeting: geo,
      age_range: ageRange,
      gender_focus: gender,
      activity_level: activityLevel,
      primary_segment: primarySegment,
      secondary_segment: secondarySegment,
      current_step: 2,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments, description, geo, ageRange, gender, activityLevel, primarySegment, secondarySegment]);

  const toggle = (arr: string[], val: string, setter: (v: string[]) => void) => {
    setter(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  };

  const validate = (): string[] => {
    const errs: string[] = [];
    if (!segments.length) errs.push("Select at least one audience segment.");
    if (!description.trim() || description.trim().length < 10) errs.push("Provide a brief audience description (at least 10 characters).");
    if (!geo.trim()) errs.push("Geographic targeting is required.");
    if (!ageRange.length) errs.push("Select at least one age range.");
    if (!primarySegment) errs.push("Select a primary segment.");
    return errs;
  };

  const handleNext = async () => {
    const errs = validate();
    if (errs.length) {
      setValidationErrors(errs);
      return;
    }
    setValidationErrors([]);

    const sid = session.data.session_id || session.ensureSessionId();
    sessionLogger.nav(2, 3, sid);
    sessionLogger.dump("AudiencePage → submit", session.snapshot() as unknown as Record<string, unknown>);

    try {
      await wizardApi.submitStep(sid, 2, {
        segments,
        description,
        geoTargeting: geo,
        ageRange,
        genderFocus: gender,
        activityLevel,
        primarySegment,
        secondarySegment,
      });
    } catch (err) {
      console.error("Failed to save step 2:", err);
    }
    dispatch({ type: "SET_STEP", step: 3 });
    navigate("/goals");
  };

  return (
    <div className="animate-slide-up">
      <PanelHeader
        eyebrow="Step 2 of 9 · Setup"
        title="Audience Configuration"
        description="Your audience drives everything — tone, imagery, hashtags, and posting times. Be specific and the AI will be precise."
      />

      {validationErrors.length > 0 && (
        <div className="mb-6 p-3 rounded-r bg-red-500/10 border border-red-500/30 text-sm text-red-400">
          {validationErrors.map((e) => <div key={e}>• {e}</div>)}
        </div>
      )}

      <label className="block text-[0.78rem] font-semibold text-fg-2 mb-2.5">
        Target Audience Segments <span className="text-fg-3 font-normal">(select all that apply)</span>
      </label>
      <div className="flex flex-wrap gap-2 mb-8">
        {SEGMENTS.map((s) => (
          <Chip key={s} label={s} selected={segments.includes(s)} onClick={() => toggle(segments, s, setSegments)} />
        ))}
      </div>

      <div className="flex flex-col gap-1.5 mb-6">
        <label className="text-[0.78rem] font-semibold text-fg-2">Describe Your Ideal Customer</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe their lifestyle, pain points, what they value, how they shop…"
          className="bg-ink-3 border border-rim rounded-r2 px-3.5 py-2.5 text-fg text-sm outline-none resize-y min-h-[90px] leading-relaxed focus:border-coral/45 focus:shadow-[0_0_0_3px_var(--accent-glow-xs)] transition-all"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="flex flex-col gap-1.5">
          <label className="text-[0.78rem] font-semibold text-fg-2">Geographic Targeting</label>
          <LocationAutocomplete
            value={geo}
            onChange={(val) => setGeo(val)}
            placeholder="e.g. Delhi, Mumbai, Bangalore"
          />
          <span className="text-[0.7rem] text-fg-3">Where your marketing budget is directed (can differ from company location).</span>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[0.78rem] font-semibold text-fg-2">Age Range</label>
          <div className="flex flex-wrap gap-2">
            {AGE_RANGES.map((a) => (
              <ToggleBtn key={a} label={a} selected={ageRange.includes(a)} onClick={() => toggle(ageRange, a, setAgeRange)} />
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="flex flex-col gap-1.5">
          <label className="text-[0.78rem] font-semibold text-fg-2">Gender Focus</label>
          <div className="flex flex-wrap gap-2">
            {GENDERS.map((g) => (
              <ToggleBtn key={g} label={g} selected={gender === g} onClick={() => setGender(g)} />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[0.78rem] font-semibold text-fg-2">Instagram Activity Level</label>
          <select
            value={activityLevel}
            onChange={(e) => setActivityLevel(e.target.value)}
            className="bg-ink-3 border border-rim rounded-r2 px-3.5 py-2.5 text-fg text-sm outline-none cursor-pointer focus:border-coral/45 transition-all appearance-none"
          >
            {ACTIVITY_LEVELS.map((a) => <option key={a}>{a}</option>)}
          </select>
        </div>
      </div>

      <SectionBreak label="Primary vs Secondary Segments" />
      <Alert variant="sky" icon="🎯" className="mb-6">
        Campaign copy and creative direction will be optimised for your <strong>primary segment</strong>. Secondary segments are considered supporting audiences.
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="flex flex-col gap-1.5">
          <label className="text-[0.78rem] font-semibold text-fg-2">Primary Segment</label>
          <select
            value={primarySegment}
            onChange={(e) => setPrimarySegment(e.target.value)}
            className="bg-ink-3 border border-rim rounded-r2 px-3.5 py-2.5 text-fg text-sm outline-none cursor-pointer focus:border-coral/45 transition-all appearance-none"
          >
            {!segments.length && <option value="">— Select segments above first —</option>}
            {segments.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[0.78rem] font-semibold text-fg-2">
            Secondary Segment <span className="text-fg-3 font-normal">(optional)</span>
          </label>
          <select
            value={secondarySegment}
            onChange={(e) => setSecondarySegment(e.target.value)}
            className="bg-ink-3 border border-rim rounded-r2 px-3.5 py-2.5 text-fg text-sm outline-none cursor-pointer focus:border-coral/45 transition-all appearance-none"
          >
            <option value="">— None —</option>
            {segments.filter((s) => s !== primarySegment).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <NavBar step={2} label="Audience" backPath="/setup" nextPath="/goals" nextLabel="Continue to Goals →" onNext={handleNext} />
    </div>
  );
}

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { NavBar } from "@/components/ui/NavBar";
import { OptionCard } from "@/components/ui/OptionCard";
import { SectionBreak } from "@/components/ui/SectionBreak";
import { Alert } from "@/components/ui/Alert";
import { UploadZone } from "@/components/ui/UploadZone";
import { ToggleBtn } from "@/components/ui/ToggleBtn";
import { LocationAutocomplete } from "@/components/ui/LocationAutocomplete";
import { businessProfileSchema, type BusinessProfileForm } from "@/lib/schemas";
import { useWizard } from "@/context/WizardContext";
import { brandApi, wizardApi, API_BASE } from "@/lib/api";
import { useSessionDict } from "@/context/SessionContext";
import { sessionLogger } from "@/lib/sessionLogger";

const STORE_TYPES = [
  { icon: "🛒", name: "E-Commerce", hint: "Transactional website — campaigns drive direct purchases", value: "ecommerce" },
  { icon: "📦", name: "Amazon Seller", hint: "Campaigns drive traffic to Amazon product listings", value: "amazon_seller" },
  { icon: "🌐", name: "Static Website", hint: "Brand awareness focus — no direct transaction", value: "static_website" },
] as const;

const TYPO_OPTIONS = [
  "Modern Sans-Serif (clean, minimal)",
  "Bold Display (strong, impactful)",
  "Humanist (friendly, approachable)",
  "Geometric (precise, tech-forward)",
  "Serif (premium, established)",
  "Slab Serif (bold, sturdy)",
  "Script (elegant, personal)",
  "Handwritten (casual, authentic)",
  "Monospace (technical, developer)",
  "Rounded (soft, playful)",
  "Condensed (compact, editorial)",
  "Art Deco (retro, luxurious)",
  "Futuristic (sci-fi, innovative)",
  "Minimalist (ultra-clean, Scandinavian)",
  "Vintage (nostalgic, classic)",
  "Grotesk (Swiss, neutral)",
  "Brush (dynamic, energetic)",
  "Stencil (military, industrial)",
];

const LOGO_PLACEMENTS = [
  "Bottom-right corner",
  "Bottom-left corner",
  "Top-right corner",
  "Centred",
  "No logo on image",
];

export default function SetupPage() {
  const navigate = useNavigate();
  const { dispatch } = useWizard();
  const session = useSessionDict();

  const [storeType, setStoreType] = useState<string>(session.data.store_type || "ecommerce");
  const [logoPlacement, setLogoPlacement] = useState(session.data.logo_placement || "Bottom-right corner");
  const [typoStyle, setTypoStyle] = useState(session.data.typography_style || TYPO_OPTIONS[0]);
  const [brandFile, setBrandFile] = useState<string>(session.data.document_name || "");
  const [uploading, setUploading] = useState(false);
  const [brandInsights, setBrandInsights] = useState<Record<string, string> | null>(
    (session.data.brand_insights as Record<string, string>) ?? null
  );
  const [logoUrl, setLogoUrl] = useState<string | null>(
    session.data.extracted_logos?.length
      ? `${API_BASE}/static/uploads/${encodeURIComponent(session.data.extracted_logos[0])}`
      : null
  );
  const [brandColors, setBrandColors] = useState<string[]>(session.data.brand_colours?.length ? session.data.brand_colours : []);
  const [colorInput, setColorInput] = useState("");

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<BusinessProfileForm>({
    resolver: zodResolver(businessProfileSchema),
    defaultValues: {
      storeName: session.data.company_name || "",
      websiteUrl: session.data.website_url || "",
      productCategory: session.data.product_category || "",
      businessSize: (session.data.business_size as "Small" | "Medium" | "Enterprise") || "Small",
      targetMarketLocation: session.data.target_market_location || "",
      instagramUrl: session.data.instagram_url || "",
      storeType: (session.data.store_type as "ecommerce" | "amazon_seller" | "static_website") || "ecommerce",
    },
  });

  const targetLocation = watch("targetMarketLocation");



  // Sync form fields → SessionContext
  const watchedFields = watch();
  useEffect(() => {
    session.set({
      company_name: watchedFields.storeName,
      website_url: watchedFields.websiteUrl,
      product_category: watchedFields.productCategory,
      business_size: watchedFields.businessSize,
      target_market_location: watchedFields.targetMarketLocation,
      instagram_url: watchedFields.instagramUrl,
      current_step: 1,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedFields.storeName, watchedFields.websiteUrl, watchedFields.productCategory, watchedFields.businessSize, watchedFields.targetMarketLocation, watchedFields.instagramUrl]);

  // Sync local state → SessionContext
  useEffect(() => {
    session.set({ store_type: storeType, logo_placement: logoPlacement, typography_style: typoStyle });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeType, logoPlacement, typoStyle]);

  // Handle clear brand upload
  const handleClearBrand = () => {
    setBrandFile("");
    setBrandInsights(null);
    setLogoUrl(null);
    setBrandColors([]);
    session.set({ brand_insights: null, extracted_logos: [], brand_colours: [], document_name: "" });
  };

  // Handle add color
  const handleAddColor = () => {
    const hex = colorInput.trim();
    if (/^#[0-9A-Fa-f]{3,8}$/.test(hex) && !brandColors.includes(hex)) {
      const next = [...brandColors, hex];
      setBrandColors(next);
      session.set({ brand_colours: next });
      setColorInput("");
    }
  };

  const onSubmit = async (formData: BusinessProfileForm) => {
    const sid = session.ensureSessionId();
    sessionLogger.nav(1, 2, sid);
    sessionLogger.dump("SetupPage → submit", session.snapshot() as unknown as Record<string, unknown>);
    dispatch({ type: "INIT_SESSION", sessionId: sid });

    try {
      await wizardApi.submitStep(sid, 1, {
        storeName: formData.storeName,
        websiteUrl: formData.websiteUrl,
        productCategory: formData.productCategory,
        businessSize: formData.businessSize,
        targetMarketLocation: formData.targetMarketLocation,
        instagramUrl: formData.instagramUrl,
        storeType: storeType,
        brandColors: brandColors,
        typographyStyle: typoStyle,
        logoPlacement: logoPlacement,
        brandBookUploaded: !!brandFile,
        brandInsights: brandInsights ? JSON.stringify(brandInsights) : "",
        logoUrl: logoUrl || "",
      });
    } catch (err) {
      console.error("Failed to save step 1:", err);
    }
    dispatch({ type: "SET_STEP", step: 2 });
    navigate("/audience");
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="animate-slide-up">
      <PanelHeader
        eyebrow="Step 1 of 9 · Setup"
        title="Business Profile"
        description="We'll use this to keep your campaigns brand-consistent. Every AI output will be anchored to the identity you define here."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="flex flex-col gap-1.5">
          <label className="text-[0.78rem] font-semibold text-fg-2">Company Name</label>
          <input {...register("storeName")} placeholder="e.g. SmartWheels" className="bg-ink-3 border border-rim rounded-r2 px-3.5 py-2.5 text-fg text-sm outline-none focus:border-coral/45 focus:shadow-[0_0_0_3px_var(--accent-glow-xs)] transition-all" />
          {errors.storeName && <span className="text-coral text-xs">{errors.storeName.message}</span>}
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[0.78rem] font-semibold text-fg-2">Website URL</label>
          <input {...register("websiteUrl")} placeholder="https://yourwebsite.com" className="bg-ink-3 border border-rim rounded-r2 px-3.5 py-2.5 text-fg text-sm outline-none focus:border-coral/45 focus:shadow-[0_0_0_3px_var(--accent-glow-xs)] transition-all" />
          {errors.websiteUrl && <span className="text-coral text-xs">{errors.websiteUrl.message}</span>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="flex flex-col gap-1.5">
          <label className="text-[0.78rem] font-semibold text-fg-2">Product Category</label>
          <input {...register("productCategory")} placeholder="e.g. Car Accessories" className="bg-ink-3 border border-rim rounded-r2 px-3.5 py-2.5 text-fg text-sm outline-none focus:border-coral/45 focus:shadow-[0_0_0_3px_var(--accent-glow-xs)] transition-all" />
          {errors.productCategory && <span className="text-coral text-xs">{errors.productCategory.message}</span>}
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[0.78rem] font-semibold text-fg-2">Business Size</label>
          <select {...register("businessSize")} className="bg-ink-3 border border-rim rounded-r2 px-3.5 py-2.5 text-fg text-sm outline-none cursor-pointer focus:border-coral/45 transition-all appearance-none">
            <option>Small</option>
            <option>Medium</option>
            <option>Enterprise</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="flex flex-col gap-1.5">
          <label className="text-[0.78rem] font-semibold text-fg-2">
            Target Market Location <span className="text-fg-3 font-normal">(where you market, not where you're based)</span>
          </label>
          <LocationAutocomplete
            value={targetLocation}
            onChange={(val) => setValue("targetMarketLocation", val, { shouldValidate: true })}
            placeholder="e.g. Delhi, Mumbai, Bangalore"
          />
          {errors.targetMarketLocation && <span className="text-coral text-xs">{errors.targetMarketLocation.message}</span>}
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[0.78rem] font-semibold text-fg-2">
            Instagram Profile URL <span className="text-fg-3 font-normal">(optional — AI learns your visual tone)</span>
          </label>
          <input {...register("instagramUrl")} placeholder="https://instagram.com/yourbrand" className="bg-ink-3 border border-rim rounded-r2 px-3.5 py-2.5 text-fg text-sm outline-none focus:border-coral/45 focus:shadow-[0_0_0_3px_var(--accent-glow-xs)] transition-all" />
        </div>
      </div>

      <SectionBreak label="Store Classification" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {STORE_TYPES.map((s) => (
          <OptionCard
            key={s.value}
            icon={s.icon}
            name={s.name}
            hint={s.hint}
            selected={storeType === s.value}
            onClick={() => setStoreType(s.value)}
          />
        ))}
      </div>

      <SectionBreak label="Brand Guidelines" />
      <Alert variant="amber" icon="💡" className="mb-4">
        Uploading your brand book or specifying guidelines ensures AI-generated images use your exact colours, font styles, and logo placement — every time.
      </Alert>

      {/* Upload + Logo */}
      <div className="grid grid-cols-[7fr_3fr] gap-x-4 gap-y-4 mb-4">
        <div className="min-w-0">
          <UploadZone
            id="brand-upload"
            label="Upload Brand Book"
            sublabel="Includes: colour palette · typography · logo usage · visual style"
            accept=".pdf,.docx,.pptx,.zip,.png,.jpg,.jpeg"
            fileName={uploading ? "Analysing document..." : brandFile}
            onClear={handleClearBrand}
            onFileChange={async (f) => {
              setBrandFile(f.name);
              setUploading(true);
              try {
                const result = await brandApi.uploadDocument(f);
                setBrandInsights(result.insights);
                const ins = result.insights as Record<string, string>;
                if (ins.company_name) setValue("storeName", ins.company_name, { shouldValidate: true });
                if (ins.product_category) setValue("productCategory", ins.product_category, { shouldValidate: true });
                const raw = (result.insights as Record<string, unknown>)?.brand_colours;
                const extractedColors = Array.isArray(raw) ? raw.filter((c): c is string => typeof c === 'string') : [];
                setBrandColors(extractedColors);
                session.set({
                  brand_insights: result.insights,
                  extracted_logos: result.extracted_images ?? [],
                  brand_colours: extractedColors,
                  document_name: f.name,
                });
                if (result.extracted_images?.length) {
                  setLogoUrl(`${API_BASE}/static/uploads/${encodeURIComponent(result.extracted_images[0])}`);
                }
                sessionLogger.session("BRAND_UPLOAD_COMPLETE", { insights_keys: Object.keys(result.insights), logo_count: result.extracted_images?.length ?? 0 });
              } catch (err) {
                console.error("Upload failed:", err);
              } finally {
                setUploading(false);
              }
            }}
          />
        </div>

        {/* Logo display */}
        <div className="min-w-0 border-2 border-dashed rounded-r p-4 flex flex-col items-center justify-center bg-glass border-rim">
          {logoUrl ? (
            <>
              <img
                src={logoUrl}
                alt="Extracted logo"
                className="max-h-28 max-w-[90%] object-contain mb-2 drop-shadow-md"
                onError={() => setLogoUrl(null)}
              />
              <span className="text-[0.72rem] text-mint font-medium">Primary Logo</span>
            </>
          ) : (
            <>
              <div className="text-2xl mb-1 opacity-40">🖼️</div>
              <span className="text-[0.72rem] text-fg-3 text-center leading-snug">
                Logo preview will appear here after upload
              </span>
            </>
          )}
        </div>
      </div>

      {brandInsights && (
        <div className="p-4 rounded-r bg-ink-3 border border-rim text-[0.8rem] text-fg-2 mb-4">
          <strong className="text-mint">✓ Brand insights extracted</strong>
          <div className="mt-2 grid grid-cols-2 gap-2 text-[0.75rem]">
            {brandInsights.company_name && <div><span className="text-fg-3">Company:</span> {brandInsights.company_name}</div>}
            {brandInsights.industry && <div><span className="text-fg-3">Industry:</span> {brandInsights.industry}</div>}
            {brandInsights.target_audience && <div><span className="text-fg-3">Audience:</span> {brandInsights.target_audience}</div>}
            {brandInsights.tone_of_voice && <div><span className="text-fg-3">Tone:</span> {brandInsights.tone_of_voice}</div>}
          </div>
        </div>
      )}

      {/* Brand Colours + Typography */}
      <div className="grid grid-cols-[7fr_3fr] gap-x-4 mb-6">
        <div className="grid grid-cols-2 gap-4">
          {/* Brand Colours */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[0.78rem] font-semibold text-fg-2">Brand Colours</label>
            <div className="flex items-center gap-2 flex-wrap">
              {brandColors.map((c, i) => (
                <div
                  key={`${c}-${i}`}
                  className="w-7 h-7 shrink-0 rounded-md border-2 border-rim/40 cursor-pointer hover:scale-110 transition-all shadow-sm"
                  style={{ background: c }}
                  title={c}
                  onClick={() => setColorInput(c)}
                />
              ))}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="text"
                value={colorInput}
                onChange={(e) => setColorInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddColor(); } }}
                placeholder="#FF4D2E"
                className="flex-1 min-w-0 bg-ink-3 border border-rim rounded-r2 px-3.5 py-2 text-fg text-sm outline-none focus:border-coral/45 transition-all font-mono"
              />
              <button
                type="button"
                onClick={handleAddColor}
                className="px-3 py-2 text-xs font-semibold bg-coral/10 text-coral border border-coral/25 rounded-r2 hover:bg-coral/20 transition-all"
              >
                Add
              </button>
            </div>
          </div>
          {/* Typography */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[0.78rem] font-semibold text-fg-2">Typography Style</label>
            <select
              value={typoStyle}
              onChange={(e) => setTypoStyle(e.target.value)}
              className="bg-ink-3 border border-rim rounded-r2 px-3.5 py-2.5 text-fg text-sm outline-none cursor-pointer focus:border-coral/45 transition-all appearance-none"
            >
              {TYPO_OPTIONS.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div />
      </div>

      <div className="flex flex-col gap-1.5 mb-8">
        <label className="text-[0.78rem] font-semibold text-fg-2">Logo Placement Rules</label>
        <div className="flex flex-wrap gap-2">
          {LOGO_PLACEMENTS.map((p) => (
            <ToggleBtn key={p} label={p} selected={logoPlacement === p} onClick={() => setLogoPlacement(p)} />
          ))}
        </div>
      </div>

      <NavBar step={1} label="Business Profile" nextPath="/audience" nextLabel="Continue to Audience →" onNext={handleSubmit(onSubmit)} />
    </form>
  );
}

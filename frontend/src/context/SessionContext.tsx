/**
 * SessionContext — dynamic dictionary that captures every user input across all
 * wizard pages in real-time.  Persisted to localStorage so it survives refresh.
 *
 * session_id is generated on first "Next" click as: insta_<company_name>_<uuid>
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { sessionLogger as log } from "@/lib/sessionLogger";

/* ── Shape ─────────────────────────────────────────────────────────────── */

export interface SessionDict {
  /** Generated once on first page transition */
  session_id: string | null;

  /* ── Step 1 — Business Profile ── */
  company_name: string;
  website_url: string;
  product_category: string;
  business_size: string;
  target_market_location: string;
  instagram_url: string;
  store_type: string;
  brand_colours: string[];
  typography_style: string;
  logo_placement: string;
  brand_insights: Record<string, unknown> | null;
  extracted_logos: string[];
  document_name: string;

  /* ── Step 2 — Audience ── */
  audience_segments: string[];
  audience_description: string;
  geo_targeting: string;
  age_range: string[];
  gender_focus: string;
  activity_level: string;
  primary_segment: string;
  secondary_segment: string;

  /* ── Step 3 — Goals ── */
  goal_type: string;
  budget: number;
  duration_days: number;
  start_date: string;
  formats: string[];

  /* ── Step 4 — Creative ── */
  image_style: string;
  content_type: string[];
  image_sizes: string[];
  hashtag_count: string;
  hashtag_mix: string;
  seed_hashtags: string;
  variant_count: number;
  tone_of_voice: string;

  /* ── Step 5+ — downstream ── */
  selected_variant_id: number | null;
  scheduling_method: string;
  engagement_rules: string[];

  /* ── Meta ── */
  current_step: number;
  last_updated: string;
}

const STORAGE_KEY = "campaign_session_dict";

export const defaultSession: SessionDict = {
  session_id: null,

  company_name: "",
  website_url: "",
  product_category: "",
  business_size: "Small",
  target_market_location: "",
  instagram_url: "",
  store_type: "ecommerce",
  brand_colours: [],
  typography_style: "",
  logo_placement: "Bottom-right corner",
  brand_insights: null,
  extracted_logos: [],
  document_name: "",

  audience_segments: [],
  audience_description: "",
  geo_targeting: "",
  age_range: [],
  gender_focus: "All",
  activity_level: "Daily active users",
  primary_segment: "",
  secondary_segment: "",

  goal_type: "brand_awareness",
  budget: 21000,
  duration_days: 30,
  start_date: "",
  formats: [],

  image_style: "",
  content_type: [],
  image_sizes: [],
  hashtag_count: "",
  hashtag_mix: "",
  seed_hashtags: "",
  variant_count: 4,
  tone_of_voice: "",

  selected_variant_id: null,
  scheduling_method: "",
  engagement_rules: [],

  current_step: 1,
  last_updated: new Date().toISOString(),
};

/* ── Context value ─────────────────────────────────────────────────────── */

interface SessionContextValue {
  /** The live session dictionary */
  data: SessionDict;
  /** Update one or more keys — triggers re-render + localStorage persist */
  set: (partial: Partial<SessionDict>) => void;
  /** Generate session_id if not yet set.  Call on first "Next". */
  ensureSessionId: () => string;
  /** Reset the entire session */
  reset: () => void;
  /** Get a snapshot (for sending to backend) */
  snapshot: () => SessionDict;
}

const SessionContext = createContext<SessionContextValue | null>(null);

/* ── Provider ──────────────────────────────────────────────────────────── */

function loadFromStorage(): SessionDict {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaultSession, ...JSON.parse(raw) };
  } catch { /* corrupted — start fresh */ }
  return { ...defaultSession };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<SessionDict>(() => ({ ...defaultSession }));
  const dataRef = useRef(data);
  dataRef.current = data;

  // Persist to localStorage + dump JSON on every change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    console.log(
      "%c[SESSION JSON]",
      "color: #FF6B6B; font-weight: bold; font-size: 12px",
      "\n" + JSON.stringify(data, null, 2),
    );
  }, [data]);

  const set = useCallback((partial: Partial<SessionDict>) => {
    setData((prev) => {
      const next = { ...prev, ...partial, last_updated: new Date().toISOString() };
      // Log every field change
      for (const [key, val] of Object.entries(partial)) {
        if (key === "last_updated") continue;
        log.field(key, val, prev.session_id);
      }
      return next;
    });
  }, []);

  const ensureSessionId = useCallback((): string => {
    const current = dataRef.current;
    if (current.session_id) return current.session_id;

    const companySlug = (current.company_name || "unknown")
      .trim()
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9_]/g, "")
      .toLowerCase();
    const id = `insta_${companySlug}_${crypto.randomUUID()}`;

    setData((prev) => ({ ...prev, session_id: id, last_updated: new Date().toISOString() }));
    log.session("SESSION_CREATED", { session_id: id, company_name: current.company_name });
    return id;
  }, []);

  const reset = useCallback(() => {
    log.session("SESSION_RESET", { old_id: dataRef.current.session_id });
    const fresh = { ...defaultSession, last_updated: new Date().toISOString() };
    setData(fresh);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const snapshot = useCallback((): SessionDict => {
    return { ...dataRef.current };
  }, []);

  return (
    <SessionContext.Provider value={{ data, set, ensureSessionId, reset, snapshot }}>
      {children}
    </SessionContext.Provider>
  );
}

/* ── Hook ──────────────────────────────────────────────────────────────── */

export function useSessionDict(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSessionDict must be used within SessionProvider");
  return ctx;
}

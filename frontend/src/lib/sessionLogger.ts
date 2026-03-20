/**
 * Frontend session logger — structured console logs for tracking data flow.
 * All logs are prefixed with [SESSION] for easy filtering in DevTools.
 */

const PREFIX = "%c[SESSION]";
const STYLE_INFO = "color: #4FC3F7; font-weight: bold";
const STYLE_FIELD = "color: #81C784; font-weight: bold";
const STYLE_NAV = "color: #FFB74D; font-weight: bold";
const STYLE_API = "color: #CE93D8; font-weight: bold";
const STYLE_ERROR = "color: #EF5350; font-weight: bold";

export const sessionLogger = {
  /** Log a field change (keystroke-level) */
  field(key: string, value: unknown, sessionId: string | null) {
    const display = typeof value === "string" && value.length > 80
      ? value.slice(0, 80) + "…"
      : value;
    console.log(
      `${PREFIX} %c⟵ ${key}`,
      STYLE_FIELD,
      "color: #A5D6A7",
      display,
      sessionId ? `| sid=${sessionId.slice(0, 30)}…` : "| sid=pending",
    );
  },

  /** Log a page navigation / step change */
  nav(from: number, to: number, sessionId: string | null) {
    console.log(
      `${PREFIX} %c→ NAVIGATE step ${from} → ${to}`,
      STYLE_NAV,
      "color: #FFE0B2",
      `sid=${sessionId ?? "pending"}`,
    );
  },

  /** Log session lifecycle events */
  session(event: string, detail?: Record<string, unknown>) {
    console.log(`${PREFIX} %c★ ${event}`, STYLE_INFO, "color: #B3E5FC", detail ?? "");
  },

  /** Log API calls */
  api(method: string, url: string, sessionId: string | null, payload?: unknown) {
    console.log(
      `${PREFIX} %c⇅ ${method} ${url}`,
      STYLE_API,
      "color: #E1BEE7",
      `sid=${sessionId ?? "none"}`,
      payload ? { payload } : "",
    );
  },

  /** Log API response */
  apiResponse(url: string, status: number, data?: unknown) {
    console.log(
      `${PREFIX} %c⇅ RESPONSE ${status} ${url}`,
      STYLE_API,
      "color: #E1BEE7",
      data ?? "",
    );
  },

  /** Log errors */
  error(context: string, err: unknown) {
    console.error(`${PREFIX} %c✗ ${context}`, STYLE_ERROR, "color: #FFCDD2", err);
  },

  /** Dump full session dict */
  dump(label: string, dict: Record<string, unknown>) {
    console.groupCollapsed(`${PREFIX} %c📋 ${label}`, STYLE_INFO, "color: #B3E5FC");
    console.table(dict);
    console.groupEnd();
  },
};

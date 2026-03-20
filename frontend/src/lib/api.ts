const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export const API_BASE = API_URL;

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed: ${res.status}`);
  }
  return res.json();
}

/* ── Wizard API ── */
export const wizardApi = {
  getState: (sessionId: string) =>
    request(`/api/wizard/state/${sessionId}`),

  submitStep: (sessionId: string, step: number, data: unknown) =>
    request("/api/wizard/step", {
      method: "POST",
      body: JSON.stringify({ session_id: sessionId, step, data }),
    }),

  resume: (sessionId: string, approved: boolean) =>
    request("/api/wizard/resume", {
      method: "POST",
      body: JSON.stringify({ session_id: sessionId, human_approved: approved }),
    }),
};

/* ── Brand API ── */
export const brandApi = {
  uploadDocument: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_URL}/api/brand/upload`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || `Upload failed: ${res.status}`);
    }
    return res.json();
  },
};

/* ── Campaign API ── */
export const campaignApi = {
  preflight: (sessionId: string) =>
    request<{ ready: boolean; missing: string[] }>("/api/campaign/preflight", {
      method: "POST",
      body: JSON.stringify({ session_id: sessionId }),
    }),

  generateStream: (sessionId: string): EventSource =>
    new EventSource(`${API_URL}/api/campaign/generate?session_id=${encodeURIComponent(sessionId)}`),

  regenerate: (sessionId: string, instructions: string = ""): EventSource => {
    // POST-based SSE — use fetch + ReadableStream or just re-generate via GET
    // For simplicity, regenerate uses the same GET endpoint (it deletes old + recreates)
    return new EventSource(`${API_URL}/api/campaign/generate?session_id=${encodeURIComponent(sessionId)}`);
  },
};

/* ── Variants API ── */
export const variantsApi = {
  list: (sessionId: string) =>
    request<{ variants: CampaignVariant[] }>(`/api/variants/${encodeURIComponent(sessionId)}`),

  update: (variantId: number, data: Partial<CampaignVariant>) =>
    request(`/api/variants/${variantId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
};

interface CampaignVariant {
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

/* ── Budget API ── */
export const budgetApi = {
  estimate: (data: { goal_type: string; budget: number; audience_size: string }) =>
    request("/api/budget/estimate", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

/* ── Calendar API ── */
export const calendarApi = {
  generate: (sessionId: string) =>
    request("/api/calendar/generate", {
      method: "POST",
      body: JSON.stringify({ session_id: sessionId }),
    }),

  updatePost: (postId: string, data: unknown) =>
    request(`/api/calendar/${postId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
};

/* ── Execution API ── */
export const executionApi = {
  runStream: (sessionId: string): EventSource =>
    new EventSource(
      `${API_URL}/api/execution/run?session_id=${sessionId}`,
    ),
};

/* ── Engagement API ── */
export const engageApi = {
  getComments: (sessionId: string) =>
    request(`/api/engage/comments?session_id=${sessionId}`),

  sendReply: (commentId: string, reply: string) =>
    request("/api/engage/reply", {
      method: "POST",
      body: JSON.stringify({ comment_id: commentId, reply }),
    }),
};

/* ── Chat API ── */
export const chatApi = {
  sendStream: (sessionId: string, message: string): EventSource => {
    const params = new URLSearchParams({ session_id: sessionId, message });
    return new EventSource(`${API_URL}/api/chat/stream?${params}`);
  },
};

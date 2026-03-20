# Technical Design Document
## AI-Powered Marketing Campaign Generator — Instagram MVP
**Version:** 1.4  
**Date:** March 15, 2026  
**Status:** Final — Backend Workflow Added + 7 New Gaps Resolved

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture](#2-architecture)
3. [Technology Stack](#3-technology-stack)
4. [Frontend Design](#4-frontend-design)
5. [Backend Design](#5-backend-design)
6. [API Contract](#6-api-contract)
7. [Database Schema](#7-database-schema)
8. [Document Parsing & Logo Extraction](#8-document-parsing--logo-extraction)
9. [AI Generation Pipeline](#9-ai-generation-pipeline)
10. [State Management](#10-state-management)
11. [Human-in-the-Loop Design](#11-human-in-the-loop-design)
12. [SSE Streaming Protocol](#12-sse-streaming-protocol)
13. [Compliance & Validation](#13-compliance--validation)
14. [Environment Configuration](#14-environment-configuration)
15. [Deployment](#15-deployment)
16. [Frontend Reality Assessment](#16-frontend-reality-assessment)
17. [Build Order (Corrected)](#17-build-order-corrected)
18. [BRD Traceability Matrix](#18-brd-traceability-matrix)
19. [Future-Proofing](#19-future-proofing)

---

## 1. System Overview

A wizard-based SPA that enables small-to-medium businesses to create, generate, and schedule AI-powered Instagram marketing campaigns. Users fill a 9-step wizard; the backend parses brand documents, generates campaign variants (copy + images + videos) using Azure AI services, builds a 30-day posting calendar, and supports scheduling + engagement management.

**Target user:** New/early-stage brand owner, solo marketer, limited budget, needs speed over perfection.

**Primary workflow:**
```
Business Profile → Audience → Goals → Creative Config → Review & Approve
    → AI Generation (copy + images + videos) → Variant Selection
    → 30-Day Calendar → Schedule → Engagement Management
```

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                         BROWSER                               │
│                                                               │
│  React 18 SPA (Vite + TypeScript + Tailwind)                 │
│  ├── SessionContext (localStorage persistence)                │
│  ├── WizardContext (useReducer — step/loading/streaming)      │
│  ├── ThemeContext (dark/light mode)                           │
│  ├── 9 Wizard Pages                                          │
│  ├── useStream hook (EventSource for SSE)                    │
│  └── react-query (server state caching)                      │
│                                                               │
└───────────────────────┬──────────────────────────────────────┘
                        │ HTTP (JSON) + SSE (EventSource)
                        │ Port 5173 (dev) / Port 80 (prod via Nginx)
                        │
┌───────────────────────▼──────────────────────────────────────┐
│                      NGINX (:80)                              │
│  Static files: /usr/share/nginx/html (built frontend)        │
│  Proxy: /api/* → http://backend:8000                         │
└───────────────────────┬──────────────────────────────────────┘
                        │
┌───────────────────────▼──────────────────────────────────────┐
│                   FastAPI (:8000)                              │
│                                                               │
│  api/          → Route handlers (thin)                       │
│  services/     → Business logic                              │
│  parsers/      → Document format parsers                     │
│  models/       → Pydantic request/response schemas           │
│  db/           → Database layer                              │
│  generators/   → Channel-specific logic (Instagram)          │
│                                                               │
└──────┬──────────────────┬────────────────────────────────────┘
       │                  │
┌──────▼──────┐   ┌──────▼──────────────────────────┐
│  Database    │   │   Azure AI Services              │
│  SQLite(dev) │   │   ├── Azure OpenAI GPT-4o        │
│  Postgres    │   │   ├── FLUX 1.1 Pro (images)      │
│  (prod)      │   │   └── Sora 2 (video/Reels)       │
└─────────────┘   └────────────────────────────────────┘
```

---

## 3. Technology Stack

### Frontend

| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 18.3.1 | UI framework |
| TypeScript | 5.5.3 | Type safety |
| Vite | 5.3.4 | Build tool, dev server, HMR |
| React Router | 6.25.1 | Client-side routing |
| Tailwind CSS | 3.4.6 | Utility-first styling |
| Radix UI | Various ^1.x–2.x | Accessible primitives (dialog, select, slider, tabs, toast, tooltip, dropdown, switch, label, slot) |
| Framer Motion | 11.3.2 | Animations |
| @tanstack/react-query | 5.51.1 | Server state management, caching |
| react-hook-form | 7.52.1 | Form state management |
| @hookform/resolvers | 3.9.0 | Zod integration for form validation |
| Zod | 3.23.8 | Schema validation (runtime + type inference) |
| Recharts | 2.12.7 | Charts |
| FullCalendar | 6.1.11 | Calendar UI (core, daygrid, interaction, react) |
| Lucide React | 0.408.0 | Icons |
| clsx + tailwind-merge | 2.1.1 / 2.4.0 | Conditional class composition |
| class-variance-authority | 0.7.0 | Component variant styling |
| tailwindcss-animate | 1.0.7 | Animation utilities |
| countries-states-cities-service | 1.3.4 | Location autocomplete data |

### Backend

| Technology | Purpose |
|-----------|---------|
| FastAPI | HTTP framework, SSE streaming, file uploads |
| uvicorn | ASGI server |
| OpenAI SDK (AzureOpenAI client) | GPT-4o text generation |
| FLUX 1.1 Pro (Azure AI Foundry) | Image generation |
| Sora 2 (Azure) | Video/Reels generation |
| PyMuPDF (fitz) | PDF parsing + image extraction |
| python-docx | DOCX parsing |
| python-pptx | PPTX parsing |
| Pillow | Image processing (resize, logo overlay, format conversion) |
| SQLite (dev) / PostgreSQL (prod) | Session state, variants, calendar, platform rules |
| Pydantic v2 | Request/response validation (bundled with FastAPI) |
| python-multipart | File upload handling |

### Infrastructure

| Technology | Purpose |
|-----------|---------|
| Docker | Multi-stage builds (frontend + backend) |
| Nginx | Static file serving, API reverse proxy |
| Azure AI Services | GPT-4o, FLUX 1.1 Pro, Sora 2 |

---

## 4. Frontend Design

### 4.1 Routing Structure

All routes are children of `<WizardLayout />` which provides the shared sidebar, navigation, and step indicators.

| Step | Route | Page Component | Section |
|------|-------|---------------|---------|
| 1 | `/setup` | SetupPage | Input |
| 2 | `/audience` | AudiencePage | Input |
| 3 | `/goals` | GoalsPage | Input |
| 4 | `/creative` | CreativePage | Input |
| 5 | `/review` | ReviewPage | Review |
| 6 | `/variants` | VariantsPage | Output |
| 7 | `/calendar` | CalendarPage | Output |
| 8 | `/schedule` | SchedulePage | Execute |
| 9 | `/engage` | EngagePage | Execute |

Default route: `*` → redirects to `/setup`

### 4.2 State Architecture

**Three independent React Contexts:**

#### SessionContext (Primary Data Store)
- **Storage key:** `campaign_session_dict` in `localStorage`
- **Persists across refresh:** Yes
- **Contains:** All user input from every wizard page + AI-generated results metadata

```
SessionDict {
  session_id: string | null               // Generated: insta_<company>_<uuid>

  // Step 1 — Business Profile
  company_name: string
  website_url: string
  product_category: string
  business_size: string                   // "Small" | "Medium" | "Enterprise"
  target_market_location: string
  instagram_url: string
  store_type: string                      // "ecommerce" | "static"
  brand_colours: string[]
  typography_style: string
  logo_placement: string                  // Default: "Bottom-right corner"
  brand_insights: Record<string, unknown> | null
  extracted_logos: string[]

  // Step 2 — Audience
  audience_segments: string[]
  audience_description: string
  geo_targeting: string
  age_range: string[]
  gender_focus: string                    // Default: "All"
  activity_level: string                  // Default: "Daily active users"
  primary_segment: string
  secondary_segment: string

  // Step 3 — Goals
  goal_type: string                       // "brand_awareness" | "follower_growth" | "engagement" | "traffic" | "conversion" | "promotional"
  budget: number                          // Default: 21000 (₹)
  duration_days: number                   // Default: 30
  start_date: string
  formats: string[]                       // ["post", "image", "reel", "story"]

  // Step 4 — Creative
  image_style: string                     // "Lifestyle" | "Functional" | "Humorous" | "Promotional" | "Product-only"
  content_type: string                    // "Image" | "Reel" | "Both"
  image_sizes: string[]                   // ["1080x1080", "1080x1350", "1080x566"]
  hashtag_count: string
  hashtag_mix: string                     // branded/trending/niche ratio
  seed_hashtags: string
  variant_count: number                   // Default: 4
  tone_of_voice: string

  // Steps 5+ — Downstream
  selected_variant_id: number | null
  scheduling_method: string
  engagement_rules: string[]

  // Meta
  current_step: number
  last_updated: string                    // ISO 8601
}
```

**Methods:**
- `set(partial)` — Update one or more keys, triggers re-render + localStorage persist
- `ensureSessionId()` — Generate session_id on first "Next" click: `insta_<company_slug>_<uuid>`
- `reset()` — Clear entire session + localStorage
- `snapshot()` — Return full SessionDict for backend submission

#### WizardContext (Navigation State)

```
WizardState {
  currentStep: number          // 1-9
  isLoading: boolean
  isStreaming: boolean
  error: string | null
  sessionId: string | null
}

Actions:
  SET_STEP     { step: number }
  SET_LOADING  { loading: boolean }
  SET_STREAMING { streaming: boolean }
  SET_ERROR    { error: string | null }
  INIT_SESSION { sessionId: string }
```

#### ThemeContext (UI Theme)
- **Storage key:** `campaign-ai-theme` in `localStorage` (separate from session)
- **Values:** `"light"` | `"dark"`
- **Method:** `toggleTheme()`
- **Effect:** Adds/removes `dark` class on `<html>` element

### 4.3 Form Validation (Zod Schemas)

```
businessProfileSchema:
  storeName         — required string
  websiteUrl        — required string (URL format)
  productCategory   — required string
  businessSize      — "Small" | "Medium" | "Enterprise"
  targetMarketLocation — required string
  instagramUrl      — optional string
  storeType         — required string
  brandColors       — string array
  typographyStyle   — optional string
  logoPlacement     — required string

audienceSchema:
  segments          — non-empty string array
  description       — required string
  geoTargeting      — required string
  ageRange          — non-empty string array
  genderFocus       — required string
  activityLevel     — required string
  primarySegment    — required string
  secondarySegment  — optional string

goalsSchema:
  goalType          — required GoalType enum
  budget            — number (min/max constrained)
  durationDays      — number
  startDate         — required string
  formats           — non-empty string array

creativeSchema:
  imageStyle        — required string
  contentType       — required string
  imageSizes        — non-empty string array
  hashtagCount      — required string
  hashtagMix        — required string
  seedHashtags      — optional string
  variantCount      — number
  toneOfVoice       — required string
```

### 4.4 TypeScript Types (context/types.ts)

```ts
BusinessSize: "Small" | "Medium" | "Enterprise"
GoalType: "brand_awareness" | "follower_growth" | "engagement" | "traffic" | "conversion" | "promotional"

BusinessProfile { storeName, websiteUrl, productCategory, businessSize, targetMarketLocation, instagramUrl, isEcommerce, storeType, brandColors, typographyStyle, logoPlacement, brandBookUploaded }
AudienceConfig { segments, description, geoTargeting, ageRange, genderFocus, activityLevel, primarySegment, secondarySegment }
CampaignGoals { goalType, budget, durationDays, startDate, formats }
CreativeConfig { imageStyle, contentType, imageSizes, hashtagCount, hashtagMix, seedHashtags, variantCount, toneOfVoice }
CampaignVariant { id, angle, headline, copy, cta, targetSegment, imageryStyle, imageUrl?, score?, recommended? }
CalendarPost { id, date, type, caption, hashtags, bestTime, imageUrl? }
EngagementComment { id, author, avatar, comment, timeAgo, postRef, sentiment, needsEscalation, replySuggestions }
AgentState { businessProfile, audience, goals, creative, compliancePassed, humanApproved, variants, selectedVariant, calendarPosts, executionResults, pendingReplies, currentStep, error }
```

### 4.5 Custom Hooks

| Hook | Purpose | Implementation |
|------|---------|---------------|
| `useStream()` | Manages EventSource for SSE. Returns `{ events, isStreaming, connect, disconnect }` | Opens EventSource to given URL, parses events, handles `"done"` event type, manages error/reconnect |
| `useAgentState(sessionId)` | Fetches server-side agent state via react-query | `useQuery(["agentState", sessionId], () => wizardApi.getState(sessionId))`, enabled when sessionId is truthy, retry: false |
| `useCampaign()` | Handles step submission + approval via mutations | `useMutation` for `submitStep` and `approve`, invalidates `"agentState"` query on success |
| `useSession()` | Syncs sessionId between SessionContext and WizardContext | Bidirectional sync on mount/change |

### 4.6 UI Component Library

| Component | Location | Purpose |
|-----------|----------|---------|
| WizardLayout | components/wizard/ | Shared layout: sidebar + nav + page outlet |
| Sidebar | components/wizard/ | Step navigation, progress indicators, section headers |
| WizardNav | components/wizard/ | Top navigation bar, step indicators, theme toggle |
| StepIndicator | components/wizard/ | Step number + status indicator |
| NavBar | components/ui/ | Per-step back/next navigation |
| PanelHeader | components/ui/ | Section header with title + description |
| OptionCard | components/ui/ | Selectable card for choices (goals, styles) |
| SectionBreak | components/ui/ | Visual divider between form sections |
| Alert | components/ui/ | Status/error messages |
| Chip | components/ui/ | Tag-style labels (segments, hashtags) |
| ToggleBtn | components/ui/ | Toggle button for binary options |
| UploadZone | components/ui/ | File drag-and-drop upload area |
| GeneratingOverlay | components/ui/ | Full-screen loading overlay during AI generation |
| LocationAutocomplete | components/ui/ | Location search with country/city data |

### 4.7 Tailwind Theme Configuration

- **Dark mode:** Class-based (`"class"`)
- **Custom colors:** ink (primary dark), coral (accent), amber, mint, sky, lilac, fg (foreground), rim (borders), glass (backgrounds)
- **Fonts:** `--font-sans` (body), `--font-display` (headings)
- **Border radius:** r: 14px, r2: 10px
- **Animations:** pulse_glow, slide-up
- **Plugin:** tailwindcss-animate

### 4.8 Utility Functions

- `cn(...inputs)` — Merges Tailwind classes using clsx + tailwind-merge (deduplication)
- `formatCurrency(value)` — Returns `"₹" + value` formatted as Indian currency

### 4.9 Session Logger

Structured console logging with color-coded categories:
- `field(key, value, sessionId)` — logs individual field changes
- `nav(from, to)` — logs page navigation
- `session(event, data)` — logs session lifecycle events
- `api(method, url, body)` — logs outgoing API calls
- `apiResponse(url, status, data)` — logs API responses
- `error(message, error)` — logs errors
- `dump(data)` — full session dump

---

## 5. Backend Design

### 5.1 Folder Structure

```
backend/
├── app/
│   ├── main.py                     ← FastAPI app, CORS, lifespan, mount routes
│   ├── config.py                   ← .env loader (Azure keys, DB URL, debug flag)
│   │
│   ├── api/                        ← Thin route handlers
│   │   ├── brand.py                ← POST /api/brand/upload
│   │   ├── wizard.py               ← POST /api/wizard/step, GET /state/{id}, POST /resume
│   │   ├── campaign.py             ← POST /api/campaign/preflight, GET /generate (SSE), POST /regenerate, PATCH /variants/{id}
│   │   ├── calendar.py             ← POST /api/calendar/generate, PATCH /{postId}
│   │   ├── budget.py               ← POST /api/budget/estimate
│   │   ├── execution.py            ← GET /api/execution/run (SSE)  ← [ADDED: was missing from your tree]
│   │   ├── engage.py               ← GET /api/engage/comments, POST /reply
│   │   ├── chat.py                 ← GET /api/chat/stream (SSE)  ← [ADDED: was missing from your tree]
│   │   └── compliance.py           ← POST /api/compliance/check (on-demand)  ← [CHANGED: was "Internal" in your tree]
│   │
│   ├── services/                   ← All business logic lives here
│   │   ├── context_composer.py     ← THE KEY FILE: builds full AI prompt from session
│   │   ├── brand_parser.py         ← Detects format, delegates to parsers/
│   │   ├── logo_extractor.py       ← Image extraction + candidate filtering
│   │   ├── insight_extractor.py    ← GPT-4o: derive guidelines from extracted text
│   │   ├── copy_generator.py       ← GPT-4o: captions + CTAs + hashtags
│   │   ├── image_generator.py      ← FLUX 1.1 Pro: generate + Pillow: logo overlay + resize
│   │   ├── video_generator.py      ← Sora 2: generate Reels
│   │   ├── calendar_builder.py     ← 30-day plan logic (dates, slots, variant assignment)
│   │   ├── budget_estimator.py     ← Reach/CPM math
│   │   ├── compliance_checker.py   ← Instagram size specs, character limits, policy rules
│   │   └── engagement.py           ← GPT-4o: reply suggestions
│   │
│   ├── parsers/                    ← Format-specific document parsers
│   │   ├── pdf_parser.py           ← PyMuPDF: text + images + vector rendering
│   │   ├── docx_parser.py          ← python-docx: text + embedded images
│   │   ├── pptx_parser.py          ← python-pptx: text + slide images
│   │   ├── zip_parser.py           ← Unpack → recursive delegation
│   │   └── image_parser.py         ← Direct JPG/PNG → treat as logo candidate
│   │
│   ├── models/                     ← Pydantic schemas (request/response)
│   │   ├── brand.py
│   │   ├── session.py              ← Mirrors frontend SessionDict
│   │   ├── campaign.py
│   │   ├── calendar.py
│   │   └── engagement.py
│   │
│   ├── db/                         ← Database layer
│   │   ├── database.py             ← Connection pool, session factory
│   │   ├── tables.py               ← Table definitions
│   │   └── queries.py              ← CRUD operations
│   │
│   └── generators/                 ← Channel-specific logic (multi-channel ready)
│       └── instagram.py            ← Instagram prompt templates, rules, format specs
│
├── static/                         ← Uploaded files + generated assets
│   └── uploads/{session_id}/       ← Brand books, logos, generated images, videos
├── Dockerfile
├── requirements.txt
└── .env
```

### 5.2 What Was Missing From Your Proposed Tree (and Why)

Your tree had 7 api files. After verification against frontend `api.ts`, BRD, and the 9 wizard pages, **5 corrections** were needed:

#### Gap 1: Missing `api/execution.py`

| | Detail |
|---|--------|
| **Your tree** | Not present |
| **Frontend** | `executionApi.runStream()` → `new EventSource(…/api/execution/run)` (api.ts line 96) |
| **BRD** | CC-03 "Scheduling Integration" — **Medium priority, but inside MVP scope** (BRD Table 13 Phase 1 says "scheduling integration") |
| **Page** | SchedulePage — currently 100% hardcoded mock |
| **Why needed** | Without this endpoint, SchedulePage has no way to trigger actual publish/schedule. The frontend already defines the EventSource SSE call. BRD Phase 1 explicitly includes "scheduling integration." |
| **Build phase** | Phase E |

#### Gap 2: Missing `api/chat.py`

| | Detail |
|---|--------|
| **Your tree** | Not present |
| **Frontend** | `chatApi.sendStream()` → `new EventSource(…/api/chat/stream)` (api.ts line 108) |
| **BRD** | CV-03 "Edit & Regenerate" is **High priority**. While `POST /campaign/regenerate` handles structured regeneration, the chat endpoint enables natural language conversational editing across the entire wizard |
| **Page** | Chat sidebar (not yet built — Phase F new component) |
| **Why needed** | BRD Table 2 defines "Performance Marketer" who needs to interact conversationally. The frontend already defines the API. This is the only SSE-based conversational channel. Without it, the user has no freeform way to refine outputs. |
| **Build phase** | Phase F (last — not MVP-blocking) |

#### Gap 3: `campaign.py` missing `preflight` endpoint

| | Detail |
|---|--------|
| **Your annotation** | `POST /api/campaign/generate (SSE), POST /regenerate` |
| **Frontend** | `campaignApi.preflight()` → `POST /api/campaign/preflight` (api.ts line 63) |
| **BRD** | Section 13.1 — validates all required fields before expensive AI generation |
| **Why needed** | Without preflight, generation could fail midway through a 60-second pipeline because a required field is missing. Preflight catches this in <100ms and shows user exactly what's missing. The frontend already defines the call. |
| **Fix** | Add `POST /api/campaign/preflight` to campaign.py annotation |

#### Gap 4: `campaign.py` missing `PATCH /variants/{id}`

| | Detail |
|---|--------|
| **Your annotation** | `POST /api/campaign/generate (SSE), POST /regenerate` |
| **Frontend** | Not yet in api.ts — but required by Section 11.2 (Human-in-the-Loop) |
| **BRD** | CV-01 "Multi-Variant Generation" + CV-03 "Edit & Regenerate" — both **High priority** |
| **Why needed** | VariantsPage needs to: select a preferred variant, edit captions inline, update CTAs. Without PATCH, variants are read-only after generation — user can't approve or customize. This breaks the human-in-the-loop design. |
| **Fix** | Add `PATCH /variants/{id}` to campaign.py annotation |

#### Gap 5: `campaign.py` uses POST for generate — should be GET

| | Detail |
|---|--------|
| **Your annotation** | `POST /api/campaign/generate (SSE)` |
| **Frontend** | `new EventSource(…/api/campaign/generate?session_id=xxx)` — EventSource is **GET only** |
| **Why wrong** | The browser's `EventSource` API only supports GET requests. A POST SSE endpoint would require a custom fetch-based SSE reader, which the frontend doesn't implement. The existing `useStream` hook uses native EventSource. |
| **Fix** | Change to `GET /api/campaign/generate (SSE)` |

#### Gap 6: `compliance.py` labeled "Internal" — needs HTTP endpoint

| | Detail |
|---|--------|
| **Your annotation** | `Internal: size + policy validation` |
| **BRD** | IG-05 "Instagram Size Compliance" (High) + Table 14 ">90% compliance pass rate" + Table 11 "Policy Compliance" |
| **Why needed** | After user edits a variant caption on VariantsPage or swaps a variant on CalendarPage, the frontend needs to re-validate. Without an HTTP endpoint, the frontend can't check compliance on-demand — it can only hope the original generation was compliant. Section 13.3 defines the endpoint. |
| **Fix** | Change to `POST /api/compliance/check (on-demand validation)` |

### 5.3 Verification: services/, parsers/, models/, db/, generators/

These folders are **identical** between your tree and the document. No changes needed:

| Folder | Your Tree | Document | Status |
|--------|----------|----------|--------|
| services/ (11 files) | ✅ Match | ✅ Match | **Aligned** |
| parsers/ (5 files) | ✅ Match | ✅ Match | **Aligned** |
| models/ (5 files) | ✅ Match | ✅ Match | **Aligned** |
| db/ (3 files) | ✅ Match | ✅ Match | **Aligned** |
| generators/ (1 file) | ✅ Match | ✅ Match | **Aligned** |
| main.py + config.py | ✅ Match | ✅ Match | **Aligned** |
| static/ + Dockerfile + requirements.txt + .env | ✅ Match | ✅ Match | **Aligned** |

### 5.4 Design Principles

1. **Routes are thin, services are fat.** Route handlers validate input → call service → return response. All logic lives in `services/`.

2. **`context_composer.py` is the backbone.** Every AI call goes through it. It takes the full session state and produces structured prompt context (system prompt, brand context, audience context, goal context, creative context). This prevents BRD Gap G-01: disconnected outputs that ignore campaign context.

3. **Parsers share one interface.** Every parser returns `{ text: str, images: list[bytes] }`. The caller (`brand_parser.py`) detects file format and delegates — never knows format internals.

4. **Generation streams progress.** The generation endpoint returns SSE, yielding events as each step completes. User sees real-time progress, not a blank screen.

5. **Compliance is a gate, not a step.** Check before returning to user. Never surface non-compliant content.

### 5.5 Complete Backend Route Workflows

Every endpoint's internal flow — route handler → service(s) → DB → response.

#### Route 1: `POST /api/brand/upload` → `api/brand.py`

```
Request: multipart/form-data (file)
│
├── Validate file extension (pdf/docx/pptx/zip/jpg/png)
│   └── 400 if unsupported format
│
├── Save raw file → static/uploads/{session_id}/originals/
│
├── brand_parser.py → detect format → delegate to parsers/
│   ├── pdf_parser.py   → { text, images }
│   ├── docx_parser.py  → { text, images }
│   ├── pptx_parser.py  → { text, images }
│   ├── zip_parser.py   → unpack → recursive parse → { text, images }
│   └── image_parser.py → { text: "", images: [bytes] }
│
├── logo_extractor.py → filter images (>50×50, reasonable aspect ratio)
│   └── Save candidates → static/uploads/{session_id}/logos/
│
├── insight_extractor.py → Azure OpenAI GPT-4o
│   ├── Prompt: "Extract brand guidelines: colours, tone, typography,
│   │            target audience, positioning, do's and don'ts"
│   └── Return: structured JSON { colours, tone, typography, ... }
│
├── DB: UPDATE sessions SET brand_insights = {json} WHERE session_id = ?
│
└── Response 200: {
      insights: { colours, tone, typography, audience, positioning },
      extracted_images: ["/static/uploads/{sid}/logos/img_0.png", ...]
    }
```

**Error cases:**
- File too large → 413
- Parse failure → 422 with `{ detail: "Could not parse file" }`
- GPT-4o timeout → 200 with `{ insights: null, extracted_images: [...] }` + warning flag

#### Route 2: `POST /api/wizard/step` → `api/wizard.py`

```
Request: { session_id, step: number, data: {} }
│
├── Validate: session_id exists in DB (or create if step=1)
├── Validate: step number is sequential (can't skip)
├── Validate: data against Pydantic model for that step
│
├── DB: UPSERT sessions SET state = jsonb_set(state, data), updated_at = now()
│
├── If step == 4 (last input step):
│   └── DB: UPDATE sessions SET status = 'review'
│
├── Optional enrichments:
│   ├── Step 2 (audience): Could return suggested segments based on product_category
│   └── Step 3 (goals): Could return budget guidance based on business_size
│
└── Response 200: { status: "ok", enrichments?: {} }
```

#### Route 3: `GET /api/wizard/state/{sessionId}` → `api/wizard.py`

```
Request: path param sessionId
│
├── DB: SELECT * FROM sessions WHERE session_id = ?
├── DB: SELECT * FROM variants WHERE session_id = ?
├── DB: SELECT * FROM calendar_posts WHERE session_id = ?
│
├── Transform to AgentState shape:
│   {
│     businessProfile: { from sessions.state },
│     audience: { from sessions.state },
│     goals: { from sessions.state },
│     creative: { from sessions.state },
│     compliancePassed: derived from variants.compliance_status,
│     humanApproved: sessions.status in ['generating','generated','approved','scheduled'],
│     variants: [ mapped from variants table → CampaignVariant shape ],
│     selectedVariant: variant WHERE selected = true,
│     calendarPosts: [ mapped from calendar_posts JOIN variants → CalendarPost shape ],
│     executionResults: from sessions.state,
│     pendingReplies: from sessions.state,
│     currentStep: sessions.state.current_step,
│     error: null
│   }
│
└── Response 200: AgentState (matches frontend types.ts)
```

> **Key:** This is where flat DB rows get transformed into the nested `AgentState` shape that the frontend `useAgentState` hook expects. The `variants` table rows are mapped to include `targetSegment` (from session audience data) and `imageryStyle` (from session creative data). Calendar posts are JOINed with variants to include `caption`, `hashtags`, `imageUrl`.

#### Route 4: `POST /api/wizard/resume` → `api/wizard.py`

```
Request: { session_id, human_approved: bool }
│
├── DB: SELECT status FROM sessions WHERE session_id = ?
│
├── If status == 'review' and approved:
│   └── DB: UPDATE sessions SET status = 'generating' → Response 200
│
├── If status == 'review' and NOT approved:
│   └── Stay 'review' → Response 200 (user goes back to edit)
│
├── If status == 'generated' and approved (calendar approval):
│   └── DB: UPDATE sessions SET status = 'approved' → Response 200
│
├── If status doesn't match expected transition:
│   └── 409 Conflict: { detail: "Cannot resume from status '{current}'" }
│
└── Response 200: { status: "ok" }
```

#### Route 5: `POST /api/campaign/preflight` → `api/campaign.py`

```
Request: { session_id }
│
├── DB: SELECT state FROM sessions WHERE session_id = ?
│
├── compliance_checker.check_session(state):
│   ├── Required fields present? (company_name, goal_type, formats, etc.)
│   ├── Budget > 0?
│   ├── At least one format selected?
│   ├── start_date in the future?
│   └── Collect all missing/invalid fields
│
└── Response 200: { ready: bool, missing_fields: ["budget", "formats"] }
```

#### Route 6: `GET /api/campaign/generate` (SSE) → `api/campaign.py`

```
Request: ?session_id=xxx (EventSource)
│
├── DB: SELECT * FROM sessions WHERE session_id = ?
├── Verify status == 'generating' (set by wizard/resume)
│
├── Check pipeline_state for resume (if reconnecting mid-generation):
│   └── Skip already-completed steps
│
├── StreamingResponse(media_type="text/event-stream"):
│   │
│   ├── Step 1: VALIDATE
│   │   └── yield event: status {"message": "Analyzing campaign brief..."}
│   │
│   ├── Step 2: COMPOSE_CONTEXT
│   │   └── context_composer.py → build full prompt context from session
│   │   └── DB: UPDATE pipeline_state
│   │
│   ├── Step 3: GENERATE_COPY
│   │   └── copy_generator.py → Azure OpenAI GPT-4o
│   │   └── yield event: status {"message": "Generating variants..."}
│   │   └── For each variant:
│   │       ├── DB: INSERT INTO variants (session_id, angle, copy_text, cta, hashtags, is_recommended)
│   │       ├── compliance_checker.check_text(copy, hashtags)
│   │       ├── DB: UPDATE variants SET compliance_status
│   │       └── yield event: variant_ready {variant_id, angle, copy, cta, hashtags, recommended}
│   │       └── yield event: compliance {variant_id, status, issues?}
│   │
│   ├── Step 4: GENERATE_IMAGES (if "image" in formats)
│   │   └── yield event: status {"message": "Creating brand images..."}
│   │   └── For each variant (PARALLEL):
│   │       ├── image_generator.py → FLUX 1.1 Pro
│   │       ├── Pillow → resize to Instagram spec
│   │       ├── Pillow → overlay logo per logo_placement
│   │       ├── compliance_checker.check_image(path)
│   │       ├── Save → static/uploads/{session_id}/
│   │       ├── DB: UPDATE variants SET image_url, compliance_status
│   │       └── yield event: image_ready {variant_id, image_url}
│   │
│   ├── Step 5: GENERATE_VIDEOS (if "reel" in formats)
│   │   └── yield event: status {"message": "Generating Reels..."}
│   │   └── For each variant:
│   │       ├── video_generator.py → Sora 2
│   │       ├── If timeout > 60s → yield event: video_timeout {variant_id}
│   │       ├── compliance_checker.check_video(path)
│   │       ├── DB: UPDATE variants SET video_url
│   │       └── yield event: video_ready {variant_id, video_url}
│   │
│   ├── Step 6: BUILD_CALENDAR
│   │   └── calendar_builder.py → distribute variants across 30 days
│   │   └── DB: INSERT INTO calendar_posts (30 rows)
│   │   └── yield event: calendar_ready {posts: [...]}
│   │
│   ├── Step 7: COMPLETE
│   │   └── DB: UPDATE sessions SET status = 'generated'
│   │   └── yield event: done {}
│   │
│   └── On error at any step:
│       └── DB: UPDATE pipeline_state SET errors = [...]
│       └── yield event: error {message, step}
│       └── (stream stays open for retry — or frontend closes)
```

#### Route 7: `POST /api/budget/estimate` → `api/budget.py`

```
Request: { goal_type, budget, audience_size }
│
├── budget_estimator.py:
│   ├── CPM lookup by goal_type (awareness=₹50, engagement=₹30, traffic=₹80, conversion=₹120)
│   ├── Reach = (budget / CPM) × 1000
│   ├── Daily budget = budget / 30
│   ├── Format split recommendation based on goal (e.g., awareness → 60% reels, 40% posts)
│   └── No DB write (stateless calculation)
│
└── Response 200: { reach: 420000, cpm: 50, daily_budget: 700, format_split: { reel: 0.6, post: 0.4 } }
```

#### Route 8: `POST /api/calendar/generate` → `api/calendar.py`

```
Request: { session_id }
│
├── DB: SELECT variants WHERE session_id = ? AND compliance_status = 'passed'
├── DB: SELECT state FROM sessions (for duration_days, start_date, goal_type, budget)
│
├── calendar_builder.py:
│   ├── Calculate posting frequency (budget ÷ CPM → posts/day)
│   ├── Distribute variants across 30 days (rotate angles)
│   ├── Assign optimal posting times for target geo timezone
│   ├── Assign format_type per day (rotate post/image/reel)
│   └── Return: CalendarPost[] (denormalized for frontend)
│
├── DB: DELETE FROM calendar_posts WHERE session_id = ? (clear old)
├── DB: INSERT INTO calendar_posts (30 rows)
│
└── Response 200: {
      posts: [{
        id, date, type, caption, hashtags, bestTime, imageUrl
      }, ...30 items]
    }
```

> **Note:** Response is denormalized — includes `caption`, `hashtags`, `imageUrl` from joined variants. Frontend `CalendarPost` type expects this flat shape.

#### Route 9: `PATCH /api/calendar/{postId}` → `api/calendar.py`

```
Request: { scheduled_date?, variant_id?, status? }
│
├── DB: SELECT * FROM calendar_posts WHERE post_id = ?
├── Validate: post belongs to active session
│
├── If variant_id changed:
│   └── compliance_checker.check_all(new_variant) — validate new variant fits the slot
│
├── DB: UPDATE calendar_posts SET [changed fields], updated_at = now()
│
└── Response 200: { status: "ok" }
```

#### Route 10: `GET /api/execution/run` (SSE) → `api/execution.py`

```
Request: ?session_id=xxx (EventSource)
│
├── DB: SELECT * FROM sessions WHERE session_id = ? AND status = 'approved'
├── DB: SELECT * FROM calendar_posts WHERE session_id = ? AND status = 'approved'
│
├── StreamingResponse:
│   │
│   ├── yield event: status {"message": "Preparing content for scheduling..."}
│   │
│   ├── For MVP (no Instagram API):
│   │   ├── Generate export package:
│   │   │   ├── CSV with all posts (date, time, caption, hashtags, image_path)
│   │   │   ├── ICal (.ics) with posting reminders
│   │   │   └── Buffer/Hootsuite-compatible JSON
│   │   ├── Save → static/uploads/{session_id}/export/
│   │   ├── yield event: export_ready {format: "csv", url: "/static/..."}
│   │   ├── yield event: export_ready {format: "ical", url: "/static/..."}
│   │   └── yield event: export_ready {format: "buffer", url: "/static/..."}
│   │
│   ├── DB: UPDATE sessions SET status = 'scheduled'
│   ├── DB: UPDATE calendar_posts SET status = 'published' (or 'scheduled')
│   │
│   └── yield event: done {}
│
│ Future (with Instagram Graph API):
│   ├── For each post by scheduled_date:
│   │   ├── Upload media → Instagram Content Publishing API
│   │   ├── Create scheduled container
│   │   ├── yield event: post_scheduled {post_id, ig_media_id}
│   │   └── yield event: post_failed {post_id, error}
│   └── yield event: done {}
```

#### Route 11: `GET /api/engage/comments` → `api/engage.py`

```
Request: ?session_id=xxx
│
├── MVP (no Instagram API access):
│   └── Return demo/seed comments for UI testing
│       OR return empty array with { source: "demo" } flag
│
│ Future (with Instagram Graph API):
│   ├── Fetch comments via Instagram Graph API for published posts
│   ├── engagement.py → GPT-4o:
│   │   ├── Analyze sentiment (positive/neutral/negative)
│   │   ├── Flag needsEscalation (complaints, complex questions)
│   │   └── Generate replySuggestions (2-3 per comment, brand-tone-consistent)
│   ├── DB: Cache results for session
│   └── Return: EngagementComment[] with sentiment + suggestions
│
└── Response 200: { comments: EngagementComment[], source: "demo" | "instagram" }
```

#### Route 12: `POST /api/engage/reply` → `api/engage.py`

```
Request: { comment_id, reply }
│
├── MVP: Log reply intent (no actual posting)
│   └── DB: Store reply in session state for audit trail
│
│ Future: Post reply via Instagram Graph API
│   └── engagement.py → post comment reply
│
└── Response 200: { status: "ok" }
```

#### Route 13: `GET /api/chat/stream` (SSE) → `api/chat.py`

```
Request: ?session_id=xxx&message=xxx (EventSource)
│
├── DB: SELECT state FROM sessions WHERE session_id = ?
│
├── context_composer.py → build chat context (full session state + conversation history)
│
├── Azure OpenAI GPT-4o (streaming):
│   ├── System prompt: "You are a marketing assistant for {company}. Help refine their campaign."
│   ├── User message: {message}
│   ├── Context: full session state (brand, audience, goals, creative, variants)
│   └── Stream tokens as SSE events
│
├── StreamingResponse:
│   ├── yield event: token {text: "Here's"} (per chunk)
│   ├── yield event: token {text: " how you"}
│   ├── ...
│   └── yield event: done {}
│
└── If AI suggests changes → frontend can trigger regenerate or variant edit
```

#### Route 14: `PATCH /api/variants/{id}` → `api/campaign.py`

```
Request: { selected?, copy_text?, cta?, hashtags? }
│
├── DB: SELECT * FROM variants WHERE variant_id = ?
├── Validate: variant belongs to active session
│
├── If copy_text or hashtags changed:
│   └── compliance_checker.check_text(copy_text, hashtags)
│       └── If critical failure → 422: { detail: "Caption exceeds 2200 chars" }
│
├── If selected = true:
│   └── DB: UPDATE variants SET selected = false WHERE session_id = ? (clear others)
│
├── DB: UPDATE variants SET [changed fields]
│
└── Response 200: { status: "ok", variant: { updated variant as CampaignVariant } }
```

#### Route 15: `POST /api/campaign/regenerate` → `api/campaign.py`

```
Request: { variant_id, instruction }
│
├── DB: SELECT * FROM variants WHERE variant_id = ?
├── DB: SELECT state FROM sessions
│
├── context_composer.py → build full context + add instruction
│
├── copy_generator.py → Azure OpenAI GPT-4o:
│   ├── Prompt includes: full context + original variant + user instruction
│   └── Returns: updated copy, CTA, hashtags
│
├── If variant has image_url and instruction mentions image:
│   └── image_generator.py → regenerate image with new instruction
│
├── compliance_checker.check_all(updated_variant)
├── DB: UPDATE variants SET [updated fields]
│
└── Response 200: { variant: CampaignVariant }
```

#### Route 16: `POST /api/compliance/check` → `api/compliance.py`

```
Request: { variant_id?, copy_text?, hashtags?, image_url?, platform? }
│
├── Load platform rules: DB: SELECT * FROM platform_rules WHERE platform = ?
│
├── If variant_id provided:
│   └── DB: SELECT * FROM variants WHERE variant_id = ? (merge with overrides)
│
├── compliance_checker.py:
│   ├── check_text(copy, hashtags) → caption length, hashtag count
│   ├── check_image(image_url) → dimensions, file size (if provided)
│   ├── check_video(video_url) → duration, file size (if provided)
│   └── Aggregate all issues
│
└── Response 200: { passed: bool, issues: ComplianceIssue[] }
```

### 5.6 Error Handling & Retry Pattern

All endpoints follow this pattern:

```
try:
    result = service.do_work(...)
    return JSONResponse(result)
except ValidationError as e:
    return 422: { detail: str(e) }
except FileNotFoundError:
    return 404: { detail: "Session not found" }
except ExternalServiceError (Azure OpenAI / FLUX / Sora):
    log error with session_id + step
    if SSE stream:
        yield event: error { message: "Image generation failed. You can retry.", step: "generate_images" }
    else:
        return 503: { detail: "AI service temporarily unavailable. Please retry." }
except Exception:
    log full traceback
    return 500: { detail: "Internal error" }
```

**Retry for generation pipeline:**
- `pipeline_state` tracks completed steps
- On retry (user opens SSE again), backend reads `pipeline_state`
- Completed steps are skipped; pipeline resumes from failure point
- Already-generated variants are included in resumed stream

**Retry for individual calls:**
- Frontend uses react-query retry (built-in exponential backoff)
- `useAgentState` has `retry: false` (one-shot)
- `useCampaign` mutations have `onError` → SET_ERROR → Alert component shows message

---

## 6. API Contract

### 6.1 Complete Endpoint Map

| # | Method | Path | Request | Response | Called By |
|---|--------|------|---------|----------|-----------|
| 1 | `POST` | `/api/brand/upload` | `multipart/form-data` (file) | `{ insights: {}, extracted_images: string[] }` | SetupPage UploadZone |
| 2 | `POST` | `/api/wizard/step` | `{ session_id, step, data }` | `{ status: "ok", enrichments?: {} }` | Every "Next" click |
| 3 | `GET` | `/api/wizard/state/{sessionId}` | — | `AgentState` (sessions + variants + calendar_posts joined) | Page refresh/resume, VariantsPage mount, CalendarPage mount |
| 4 | `POST` | `/api/wizard/resume` | `{ session_id, human_approved }` | `{ status: "ok" }` | ReviewPage approve/reject, CalendarPage calendar approval |
| 5 | `POST` | `/api/campaign/preflight` | `{ session_id }` | `{ ready: bool, missing_fields?: [] }` | ReviewPage before generate |
| 6 | `GET` | `/api/campaign/generate` | `?session_id=xxx` (SSE) | `text/event-stream` | ReviewPage → useStream |
| 7 | `POST` | `/api/budget/estimate` | `{ goal_type, budget, audience_size }` | `{ reach, cpm, daily_budget, format_split }` | GoalsPage |
| 8 | `POST` | `/api/calendar/generate` | `{ session_id }` | `{ posts: CalendarPost[] }` | CalendarPage |
| 9 | `PATCH` | `/api/calendar/{postId}` | `{ scheduled_date?, variant_id?, status? }` | `{ status: "ok" }` | CalendarPage edit |
| 10 | `GET` | `/api/execution/run` | `?session_id=xxx` (SSE) | `text/event-stream` (export_ready events) | SchedulePage |
| 11 | `GET` | `/api/engage/comments` | `?session_id=xxx` | `{ comments: EngagementComment[], source: "demo"\|"instagram" }` | EngagePage |
| 12 | `POST` | `/api/engage/reply` | `{ comment_id, reply }` | `{ status: "ok" }` | EngagePage |
| 13 | `GET` | `/api/chat/stream` | `?session_id=xxx&message=xxx` (SSE) | `text/event-stream` | Chat sidebar |
| 14 | `PATCH` | `/api/variants/{id}` | `{ selected?, copy_text?, cta? }` | `{ status: "ok", variant }` | VariantsPage select/edit |
| 15 | `POST` | `/api/campaign/regenerate` | `{ variant_id, instruction }` | `{ variant }` | VariantsPage regenerate |
| 16 | `POST` | `/api/compliance/check` | `{ variant_id?, copy_text?, hashtags?, image_url? }` | `{ passed: bool, issues: ComplianceIssue[] }` | VariantsPage edit, CalendarPage swap |

> **Note:** Endpoints 14–16 are described in Sections 11.2 and 13 but are not yet defined in frontend `api.ts`. They must be added during Phase C.

### 6.2 API Flow Diagram

```
USER JOURNEY                              API CALLS
─────────────                             ─────────

SetupPage
  ├─ Upload brand book ──────────────────→ POST /api/brand/upload
  │   ◄── { insights, extracted_images }
  └─ Click "Next" ──────────────────────→ POST /api/wizard/step {step:1}  ⚠️ NOT WIRED YET (Phase A fix)

AudiencePage
  └─ Click "Next" ──────────────────────→ POST /api/wizard/step {step:2}

GoalsPage
  ├─ Budget input ──────────────────────→ POST /api/budget/estimate
  │   ◄── { reach, cpm, daily_budget }
  └─ Click "Next" ──────────────────────→ POST /api/wizard/step {step:3}

CreativePage
  └─ Click "Next" ──────────────────────→ POST /api/wizard/step {step:4}

ReviewPage
  ├─ Page load ─────────────────────────→ POST /api/campaign/preflight
  │   ◄── { ready: true }
  ├─ "Approve & Generate" ─────────────→ POST /api/wizard/resume {approved:true}
  └─ SSE connection opens ─────────────→ GET  /api/campaign/generate (SSE stream)
      ◄── variant_ready events
      ◄── image_ready events
      ◄── video_ready events (if Reels)
      ◄── calendar_ready event
      ◄── complete event

VariantsPage
  ├─ Page mount/refresh ────────────────→ GET  /api/wizard/state/{id} (includes variants)
  ├─ (or: variants received via SSE stream from ReviewPage)
  ├─ Select variant ────────────────────→ PATCH /api/variants/{id} {selected:true}
  ├─ Edit caption ──────────────────────→ PATCH /api/variants/{id} {copy_text:"..."}
  │   └─ On save ───────────────────────→ POST /api/compliance/check {copy_text, hashtags}
  │       ◄── { passed: true/false, issues: [...] }
  ├─ "Regenerate" ──────────────────────→ POST  /api/campaign/regenerate {variant_id, instruction}
  └─ Click "Next" ──────────────────────→ (navigate to /calendar)

CalendarPage
  ├─ Page load ─────────────────────────→ POST /api/calendar/generate
  │   ◄── { posts: [...30 days] }
  ├─ Page refresh ──────────────────────→ GET  /api/wizard/state/{id} (includes calendar_posts)
  ├─ Edit a day ────────────────────────→ PATCH /api/calendar/{postId}
  └─ "Approve Calendar" ────────────────→ POST /api/wizard/resume {approved:true}  ← status → 'approved'

SchedulePage
  └─ "Schedule All" ───────────────────→ GET  /api/execution/run (SSE stream)

EngagePage
  ├─ Page load ─────────────────────────→ GET  /api/engage/comments
  └─ Send reply ────────────────────────→ POST /api/engage/reply

Chat Sidebar (any page)
  └─ Send message ─────────────────────→ GET  /api/chat/stream (SSE)
```

---

## 7. Database Schema

### 7.1 Tables

#### `sessions`
| Column | Type | Notes |
|--------|------|-------|
| session_id | TEXT PK | `insta_<company_slug>_<uuid>` |
| state | JSONB | Full session dict from frontend |
| status | TEXT | `draft` → `review` → `generating` → `generated` → `approved` → `scheduled` → `paused` |
| pipeline_state | JSONB | Tracks generation progress: steps_completed, steps_pending, current_step, errors |
| brand_insights | JSONB | GPT-extracted brand guidelines |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

#### `variants`
| Column | Type | Notes |
|--------|------|-------|
| variant_id | INTEGER PK | Auto-increment |
| session_id | TEXT FK | → sessions.session_id |
| angle | TEXT | Campaign positioning angle |
| headline | TEXT | Short headline |
| copy_text | TEXT | Full caption (≤2200 chars for Instagram) |
| cta | TEXT | Call to action |
| hashtags | JSON | Array of hashtag strings |
| image_url | TEXT | Nullable — path to generated image |
| video_url | TEXT | Nullable — path to generated video |
| is_recommended | BOOLEAN | System-flagged best variant |
| compliance_status | TEXT | `passed` / `failed` / `pending` |
| created_at | TIMESTAMP | |

> **DB → Frontend type mapping:** Backend returns `CampaignVariant` shape per frontend `types.ts`. Transformation in `GET /wizard/state` and SSE events:
> | DB column | Frontend field | Notes |
> |-----------|---------------|-------|
> | `variant_id` | `id` | Rename |
> | `copy_text` | `copy` | Rename |
> | `is_recommended` | `recommended` | Rename |
> | `image_url` | `imageUrl` | snake_case → camelCase |
> | `video_url` | `videoUrl` | snake_case → camelCase (add to frontend type in Phase C) |
> | `compliance_status` | `complianceStatus` | Add to frontend type in Phase C |
> | N/A | `targetSegment` | Derived from session audience data at query time |
> | N/A | `imageryStyle` | Derived from session creative data at query time |
> | N/A | `score` | Computed by copy_generator (confidence score) — store as column or compute |

#### `calendar_posts`
| Column | Type | Notes |
|--------|------|-------|
| post_id | INTEGER PK | Auto-increment |
| session_id | TEXT FK | → sessions.session_id |
| variant_id | INTEGER FK | → variants.variant_id |
| scheduled_date | DATE | |
| scheduled_time | TIME | Optimal posting time |
| format_type | TEXT | `post` / `image` / `reel` / `story` |
| status | TEXT | `draft` / `approved` / `published` / `paused` |
| updated_at | TIMESTAMP | |

> **DB → Frontend type mapping:** API responses denormalize by JOINing with `variants` table:
> | DB column | Frontend field | Notes |
> |-----------|---------------|-------|
> | `post_id` | `id` | Rename |
> | `scheduled_date` | `date` | Rename + format as ISO string |
> | `format_type` | `type` | Rename |
> | `scheduled_time` | `bestTime` | Rename + format as "HH:MM" |
> | N/A | `caption` | JOIN variants ON variant_id → copy_text |
> | N/A | `hashtags` | JOIN variants ON variant_id → hashtags |
> | N/A | `imageUrl` | JOIN variants ON variant_id → image_url |

#### `platform_rules`
| Column | Type | Notes |
|--------|------|-------|
| platform | TEXT | `instagram` (future: `google_ads`, `meta_ads`, `amazon_ads`) |
| rule_key | TEXT | `post_image_width`, `max_caption_chars`, `max_hashtags`, etc. |
| rule_value | TEXT | `1080`, `2200`, `30`, etc. |
| updated_at | TIMESTAMP | |

### 7.2 Instagram Platform Rules (seed data)

| rule_key | rule_value | Description |
|----------|-----------|-------------|
| post_image_square | 1080x1080 | Square post |
| post_image_portrait | 1080x1350 | Portrait post |
| post_image_landscape | 1080x566 | Landscape post |
| story_image | 1080x1920 | Story/Reel dimensions |
| max_caption_chars | 2200 | Caption character limit |
| max_hashtags | 30 | Hashtag limit per post |
| max_reel_duration_sec | 90 | Reel max duration |
| max_image_file_size_mb | 8 | Image upload limit |
| max_video_file_size_mb | 650 | Video upload limit |

### 7.3 State Transitions

```
draft ───(POST /wizard/step)──→ draft (step number increments through 1–3)
  │
  │  (POST /wizard/step, step=4)  ← last input step; backend auto-sets status
  ▼
review ──(POST /wizard/resume, approved=true)──→ generating
  │                                                  │
  │  (POST /wizard/resume, approved=false)           │ (pipeline completes)
  │      → stays "review"                            ▼
  │                                              generated
  │                                                  │
  │                                   (POST /wizard/resume, calendar approved)
  │                                                  ▼
  │                                              approved
  │                                                  │
  │                                       (POST /schedule)
  │                                                  ▼
  │                                              scheduled
  │
  │                          (budget exhausted — CC-04)
  └─────────────────────────────────────────→ paused
```

---

## 8. Document Parsing & Logo Extraction

### 8.1 Supported Formats

| Format | Parser | Library | Extracts |
|--------|--------|---------|----------|
| PDF | `pdf_parser.py` | PyMuPDF (fitz) | Text + raster images + vector renderings + soft-masked images |
| DOCX | `docx_parser.py` | python-docx | Text + embedded images from `word/media/` |
| PPTX | `pptx_parser.py` | python-pptx | Text + slide images from `ppt/media/` |
| ZIP | `zip_parser.py` | zipfile (stdlib) | Unpacks → delegates to other parsers by extension |
| JPG/PNG | `image_parser.py` | Pillow | Direct image → treated as logo candidate |

### 8.2 Parser Interface

Every parser returns the same shape:
```
{ text: str, images: list[bytes] }
```

`brand_parser.py` (orchestrator) detects file extension → delegates to appropriate parser → returns unified result.

### 8.3 Logo Extraction Strategy

**Phase 1 (MVP):**
1. Extract all raster images from documents via PyMuPDF / python-docx / python-pptx
2. Filter by: minimum size (>50×50px), reasonable aspect ratio (not ultra-thin banners)
3. Handle soft-masked images (combine base image + alpha mask into single RGBA PNG)
4. Present candidates to user for selection on SetupPage

**Phase 2 (if needed):**
5. For vector logos (PDF path operators): render page region at 300 DPI → crop
6. Use GPT-4o vision to identify which image region contains the logo

### 8.4 Logo Types in Documents (reference)

| Category | Types | Extraction Method |
|----------|-------|-------------------|
| Raster | JPEG, PNG, TIFF, BMP, JPEG2000, JBIG2, CCITT | `page.get_images()` → `fitz.Pixmap` → PNG |
| Vector | PDF path operators, SVG, EMF/WMF, EPS | Render page at 300 DPI → crop region |
| Composite | Soft-masked, base+overlay, Form XObjects | Combine base + mask → RGBA PNG |
| Text-as-logo | Custom embedded fonts | Render glyph to image |

### 8.5 Brand Insight Extraction Flow

```
Upload received → Detect format → Parse
  ├── Extract text → GPT-4o: "Extract brand guidelines: colors, tone, typography,
  │                           target audience, positioning, do's and don'ts"
  │                  → Return structured JSON
  │
  └── Extract images → Filter logo candidates → Return image array

→ Frontend receives: { insights: {...}, extracted_images: [...] }
→ SetupPage auto-populates: company_name, product_category from insights
→ User selects logo from extracted_images
→ All stored in SessionContext: brand_insights + extracted_logos
```

---

## 9. AI Generation Pipeline

### 9.1 Pipeline Sequence (triggered by "Approve & Generate")

```
Step 1: VALIDATE
  └── Load session from DB → Check all required fields → Guard against re-runs

Step 2: COMPOSE_CONTEXT (context_composer.py)
  └── Assemble full prompt context from session state:
      - System prompt (brand identity, role)
      - Brand context (colours, typography, tone, logo rules)
      - Audience context (segments, demographics, geo, age)
      - Goal context (objective, budget, duration, formats)
      - Creative context (style, content type, hashtag config)

Step 3: GENERATE_COPY (copy_generator.py → Azure OpenAI GPT-4o)
  └── Single API call → N variants (copy + CTA + hashtags per variant)
  └── Flag recommended variant based on goal type
  └── Stream each variant to frontend via SSE
  └── Persist to variants table

Step 4: ROUTE_BY_FORMAT (if/elif on formats[])
  │
  ├── "post" only → Done (copy + hashtags is the deliverable)
  │
  ├── "image" included → GENERATE_IMAGES
  │     └── For each variant (PARALLEL):
  │           ├── Compose image prompt (brand context + variant angle + style)
  │           ├── FLUX 1.1 Pro → generate image
  │           ├── Pillow → resize to Instagram spec
  │           ├── Pillow → overlay logo per logo_placement
  │           ├── Compliance check (size, format)
  │           ├── Save to static/uploads/{session_id}/
  │           └── Stream image_url via SSE
  │
  └── "reel" included → GENERATE_VIDEOS
        └── For each variant:
              ├── Compose video prompt
              ├── Sora 2 → generate video (30-120s)
              ├── If timeout → stream partial result + "still rendering" status
              ├── Compliance check
              └── Stream video_url via SSE

Step 5: BUILD_CALENDAR (calendar_builder.py)
  └── Distribute variants across 30 days
  └── Frequency based on budget + goal
  └── Assign optimal posting times for target geo
  └── Rotate content angles to avoid repetition
  └── Persist to calendar_posts table
  └── Stream calendar data via SSE

Step 6: COMPLETE
  └── Update session status to "generated"
  └── Stream "complete" event
```

### 9.2 AI Service Configuration

| Service | Endpoint | Model | Use |
|---------|----------|-------|-----|
| Azure OpenAI | `https://medisummarize-openai.cognitiveservices.azure.com` | `gpt-4o` (deployment) | Text: brand insights, captions, hashtags, CTAs, engagement replies |
| FLUX 1.1 Pro | Azure AI Foundry (Sweden Central) | `FLUX-1.1-pro` | Image generation |
| Sora 2 | Azure Cognitive Services (Sweden Central) | `sora-2` (deployment) | Video/Reels generation |

### 9.3 Context Composer Output Shape

```
{
  system_prompt: "You are a marketing campaign specialist for {company_name},
                  a {business_size} {store_type} business selling {product_category}.
                  Website: {website_url}. Instagram: {instagram_url}.",

  brand_context: "Brand colours: {brand_colours}. Typography: {typography_style}.
                  Logo placement: {logo_placement}. Tone: {tone_of_voice}.
                  Brand guidelines: {brand_insights}.",

  audience_context: "Target segments: {audience_segments}. Primary: {primary_segment}.
                     Age range: {age_range}. Gender: {gender_focus}.
                     Location: {geo_targeting}. Activity: {activity_level}.
                     Description: {audience_description}.",

  goal_context: "Campaign goal: {goal_type}. Budget: ₹{budget} over {duration_days} days.
                 Start date: {start_date}. Formats: {formats}.",

  creative_context: "Image style: {image_style}. Content type: {content_type}.
                     Sizes: {image_sizes}. Hashtag count: {hashtag_count}.
                     Hashtag mix: {hashtag_mix}. Seed hashtags: {seed_hashtags}.
                     Variant count: {variant_count}."
}
```

Every service that calls Azure OpenAI, FLUX, or Sora receives this full context. No partial prompts.

### 9.4 Performance Targets (from BRD)

| Operation | Target | Strategy |
|-----------|--------|----------|
| Variant generation (copy) | <30 seconds | Single GPT-4o batch call for all variants |
| Image generation | <60 seconds | Parallel FLUX calls (all variants simultaneously) |
| Full pipeline (copy + images) | <90 seconds | Pipeline architecture with streaming as each piece completes |
| Video generation | 30-120 seconds | Async with progress streaming; partial results returned if slow |

---

## 10. State Management

### 10.1 Three Levels of State

| Level | What | Where | Updated By |
|-------|------|-------|-----------|
| Wizard State | Where the user is (step + status) | `sessions.status` + `sessions.state.current_step` | `POST /wizard/step`, `POST /wizard/resume` |
| Session Data | All user inputs + generated outputs | `sessions.state` (JSONB) + `variants` + `calendar_posts` tables | Every endpoint |
| Pipeline Progress | Generation step tracking during active pipeline | `sessions.pipeline_state` (JSONB) | Updated after each pipeline step completes |

### 10.2 Pipeline State Shape

```json
{
  "steps_completed": ["validate", "compose_context", "generate_copy"],
  "steps_pending": ["generate_images", "compliance_check", "build_calendar"],
  "current_step": "generate_images",
  "variants_completed": [1, 2],
  "variants_pending": [3, 4],
  "errors": []
}
```

Used for:
- Resuming SSE stream after page refresh mid-generation
- Knowing which steps succeeded if a later step fails
- Retry logic: skip completed steps, restart from failure point

### 10.3 Frontend ↔ Backend State Sync

```
Frontend (SessionContext/localStorage)
  ── saves on every field change ──
  ── sends snapshot on "Next" ──→ POST /wizard/step ──→ DB (sessions.state)

Frontend (page refresh)
  ── GET /wizard/state/{id} ──→ DB read ──→ SessionContext hydrated

Frontend (SSE during generation)
  ── EventSource ──→ real-time updates from pipeline ──→ local state updated
```

---

## 11. Human-in-the-Loop Design

### 11.1 Decision Point 1: Campaign Approval (ReviewPage)

```
Frontend: User clicks "Approve & Generate"
  → POST /api/wizard/resume { session_id, human_approved: true }
  
Backend:
  1. Load session, verify status == "review"
  2. If approved → set status = "generating" → return 200
  3. Frontend opens SSE → pipeline starts
  
  If rejected → status stays "review" → user edits and re-submits
  
  If user closes browser → status stays "review" in DB
  → Returns hours/days later → GET /wizard/state → resumes from ReviewPage
```

### 11.2 Decision Point 2: Variant Selection (VariantsPage)

```
Pipeline completed → status = "generated" → user reviews variants

  User selects variant  → PATCH /api/variants/{id} { selected: true }
  User edits caption    → PATCH /api/variants/{id} { copy_text: "..." }
  User requests change  → POST /api/campaign/regenerate { variant_id, instruction: "..." }
                            → GPT-4o call with instruction + full context → return updated variant
  User rejects all      → GET /api/campaign/generate (new SSE → full regeneration)
```

### 11.3 Decision Point 3: Calendar Approval (CalendarPage → SchedulePage)

```
User edits calendar:
  Drag-drop            → PATCH /api/calendar/{postId} { scheduled_date: "..." }
  Swap variant         → PATCH /api/calendar/{postId} { variant_id: N }
  Skip a day           → PATCH /api/calendar/{postId} { status: "paused" }

User approves          → POST /api/wizard/resume { human_approved: true }
                            → status = "approved" → unlocks SchedulePage
```

### 11.4 Design Pattern

All human-in-the-loop is implemented as:
```
Pipeline runs → saves to DB → sets status to "waiting"
(time passes — hours/days, doesn't matter)
Human acts → POST → backend checks status → proceeds
```

No process suspension. No coroutine parking. The database is the checkpoint. Each phase is a separate HTTP request cycle.

---

## 12. SSE Streaming Protocol

### 12.1 Connection

Frontend opens EventSource:
```
GET /api/campaign/generate?session_id=insta_smartwheels_xxx
Accept: text/event-stream
```

Backend returns `StreamingResponse(media_type="text/event-stream")`.

### 12.2 Event Types

| Event | Data | When |
|-------|------|------|
| `status` | `{ message: "Analyzing campaign brief..." }` | Pipeline step starts |
| `variant_ready` | `{ variant_id, angle, copy, cta, hashtags, recommended }` | Each variant parsed from GPT response |
| `image_ready` | `{ variant_id, image_url }` | Each image generated + processed |
| `video_ready` | `{ variant_id, video_url }` | Each video generated |
| `video_timeout` | `{ variant_id, message }` | Video still rendering (>60s) |
| `calendar_ready` | `{ posts: [{date, variant_id, time, format}...] }` | Calendar built |
| `compliance` | `{ variant_id, status, issues? }` | Per-variant compliance result |
| `error` | `{ message, step }` | Step failure |
| `done` | `{}` | Pipeline complete (frontend closes EventSource) |

### 12.3 Typical Event Sequence

```
→ event: status        data: {"message": "Analyzing your campaign brief..."}
→ event: status        data: {"message": "Generating campaign variants..."}
→ event: variant_ready data: {"variant_id": 1, "copy": "...", "recommended": true}
→ event: variant_ready data: {"variant_id": 2, "copy": "..."}
→ event: variant_ready data: {"variant_id": 3, "copy": "..."}
→ event: variant_ready data: {"variant_id": 4, "copy": "..."}
→ event: status        data: {"message": "Creating brand images..."}
→ event: image_ready   data: {"variant_id": 1, "image_url": "/static/uploads/xxx/v1.png"}
→ event: image_ready   data: {"variant_id": 2, "image_url": "..."}
→ event: image_ready   data: {"variant_id": 3, "image_url": "..."}
→ event: image_ready   data: {"variant_id": 4, "image_url": "..."}
→ event: status        data: {"message": "Building your 30-day calendar..."}
→ event: calendar_ready data: {"posts": [...]}
→ event: done          data: {}
```

---

## 13. Compliance & Validation

Compliance runs at **three points** — before generation, during generation, and on-demand after user edits.

### 13.1 Pre-Generation Validation (Preflight)

**Endpoint:** `POST /api/campaign/preflight` (in `api/campaign.py`)

Called by ReviewPage before starting generation:
- All required session fields populated?
- Budget within realistic range?
- At least one format selected?
- Start date is in the future?

Returns `{ ready: bool, missing_fields: string[] }`. If not ready, frontend shows missing fields and blocks generation.

### 13.2 Automatic Post-Generation Compliance

**Called by:** Generation pipeline internally (Step 4 in Section 9.1)
**Results surfaced via:** SSE `compliance` event per variant (see Section 12.2)

Every generated variant is auto-checked before being streamed to the frontend. Non-compliant variants get flagged with specific issues.

| Check | Rule | Source |
|-------|------|--------|
| Image dimensions | Must match one of: 1080×1080, 1080×1350, 1080×566, 1080×1920 | `platform_rules` table |
| Caption length | ≤2200 characters | `platform_rules` table |
| Hashtag count | ≤30 per post | `platform_rules` table |
| Image file size | ≤8 MB | `platform_rules` table |
| Video file size | ≤650 MB | `platform_rules` table |
| Reel duration | ≤90 seconds | `platform_rules` table |
| Copyright | Best-effort AI-generated content check (no real-world image source) | Internal logic |

### 13.3 On-Demand Compliance Check

**Endpoint:** `POST /api/compliance/check` (in `api/compliance.py`)

Called by frontend after user edits a variant (VariantsPage) or swaps a variant on the calendar (CalendarPage). Validates the edited content against `platform_rules` without re-running the full pipeline.

**Request:**
```json
{
  "variant_id": 3,           // optional — loads existing variant data
  "copy_text": "edited...",  // optional — override for validation
  "hashtags": ["#sale"],     // optional — override for validation  
  "image_url": "/static/...", // optional — checks file size + dimensions
  "platform": "instagram"    // defaults to instagram for MVP
}
```

**Response:**
```json
{
  "passed": false,
  "issues": [
    { "field": "hashtags", "rule": "max_hashtags", "limit": 30, "actual": 35, "message": "Too many hashtags (35/30)" }
  ]
}
```

**Usage:**
- VariantsPage: call after user edits caption → show inline warning if issues found
- CalendarPage: call after variant swap → show compliance badge (✅/⚠️)
- PATCH `/api/variants/{id}` also calls `compliance_checker` internally before saving — rejects if critical rules fail

### 13.4 Compliance Architecture

```
services/compliance_checker.py    ← THE LOGIC (shared by all callers)
    ├── check_text(copy, hashtags, platform) → issues[]
    ├── check_image(image_path, platform)    → issues[]
    ├── check_video(video_path, platform)    → issues[]
    └── check_all(variant, platform)         → { passed, issues[] }

Callers:
  1. api/campaign.py (preflight)     → pre-generation session validation
  2. Generation pipeline (Step 4)    → auto-check each variant during SSE
  3. api/compliance.py (check)       → on-demand after user edits
  4. api/campaign.py (PATCH variant) → guard before saving edited variant
```

Rules are stored in `platform_rules` table — updatable via DB without code changes. Future platforms (Google Ads, Meta) add new rows to the same table.

---

## 14. Environment Configuration

### 14.1 Root `.env` (Backend)

```env
# Azure OpenAI — Text Generation
AZURE_OPENAI_API_KEY=<key>
AZURE_OPENAI_ENDPOINT=https://medisummarize-openai.cognitiveservices.azure.com
AZURE_OPENAI_DEPLOYMENT=gpt-4o
AZURE_API_VERSION=2024-02-15-preview

# FLUX 1.1 Pro — Image Generation (Azure AI Foundry)
FLUX_API_ENDPOINT=<endpoint>
FLUX_API_KEY=<key>
FLUX_MODEL=FLUX-1.1-pro

# Sora 2 — Video Generation (Azure)
SORA_API_ENDPOINT=<endpoint>
SORA_API_KEY=<key>
SORA_DEPLOYMENT_NAME=sora-2

# Database
DATABASE_URL=sqlite:///retail_marketing.db    # Dev
# DATABASE_URL=postgresql://user:pass@localhost:5432/marketing_agent  # Prod

# Application
DEBUG=true
LOG_LEVEL=INFO
```

### 14.2 Frontend `.env`

```env
VITE_API_URL=http://localhost:8000
VITE_APP_NAME=Retail Marketing Agent
```

### 14.3 Configuration Notes

- **Standard OpenAI keys:** Not used. All AI goes through Azure OpenAI.
- **STORE_NAME, STORE_TYPE, etc.:** Removed — these come from the wizard session data, not environment config.
- **Social media API keys:** Empty for MVP. Scheduling exports to third-party tools (Buffer/Hootsuite). Native Instagram API posting is Phase 2+.
- **SENDGRID_API_KEY:** Not needed for MVP (no email campaigns).
- **Security:** `.env` must be in `.gitignore`. If repo has been pushed, rotate all Azure keys immediately.

---

## 15. Deployment

### 15.1 Frontend Docker Build

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### 15.2 Nginx Configuration

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;     # SPA fallback
    }

    location /api/ {
        proxy_pass http://backend:8000;        # Backend container
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 15.3 Development Mode

| Service | Command | Port |
|---------|---------|------|
| Frontend | `npm run dev` (Vite) | 5173 |
| Backend | `uvicorn app.main:app --reload` | 8000 |
| Proxy | Vite dev server proxies `/api` → `localhost:8000` | — |

### 15.4 File Storage

| Phase | Strategy |
|-------|----------|
| Dev / MVP | Local filesystem: `backend/static/uploads/{session_id}/` served by FastAPI |
| Production | Azure Blob Storage or S3 — when CDN/redundancy/multi-instance is needed |

---

## 16. Frontend Reality Assessment

> **Critical finding from codebase re-analysis (March 15, 2026):** The frontend is partially built. Steps 1–5 make real API calls; Steps 6–9 use 100% hardcoded mock data. All API functions exist in `api.ts` but several are never called by any page. This section documents the exact reality.

### 16.1 What's Currently Wired (backend calls that actually fire)

| Page | API Call | When | Data Sent |
|------|----------|------|----------|
| **SetupPage** | `brandApi.uploadDocument(file)` → `POST /api/brand/upload` | User drops file in UploadZone | Multipart file |
| **SetupPage** | ❌ No `wizard/step` call on "Next" | — | Step 1 data **only saved to localStorage, never reaches backend** |
| **AudiencePage** | `useCampaign().submitStep` → `POST /api/wizard/step` | "Next" click | `{ session_id, step: 2, data: { segments, description, geoTargeting, ageRange, genderFocus, activityLevel, primarySegment, secondarySegment } }` |
| **GoalsPage** | `useCampaign().submitStep` → `POST /api/wizard/step` | "Next" click | `{ session_id, step: 3, data: { goalType, budget, formats, durationDays, startDate } }` |
| **CreativePage** | `useCampaign().submitStep` → `POST /api/wizard/step` | "Next" click | `{ session_id, step: 4, data: { imageStyle, contentType, imageSizes, seedHashtags, variantCount, toneOfVoice, hashtagCount, hashtagMix } }` |
| **ReviewPage** | `useCampaign().approve` → `POST /api/wizard/resume` | "Generate" click | `{ session_id, human_approved: true }` |

### 16.2 What's Defined in api.ts But Never Called By Any Page

| API Function | Endpoint | Intended Page | Status |
|-------------|----------|---------------|--------|
| `wizardApi.getState()` | `GET /api/wizard/state/{id}` | Page refresh / resume | **Orphaned** — `useAgentState` hook fetches it but no page reads the result |
| `campaignApi.preflight()` | `POST /api/campaign/preflight` | ReviewPage | **Never called** |
| `campaignApi.generateStream()` | `GET /api/campaign/generate` (SSE) | ReviewPage | **Never called** — ReviewPage uses a fake progress animation instead |
| `budgetApi.estimate()` | `POST /api/budget/estimate` | GoalsPage | **Never called** — budget insights are hardcoded |
| `calendarApi.generate()` | `POST /api/calendar/generate` | CalendarPage | **Never called** — calendar data is hardcoded |
| `calendarApi.updatePost()` | `PATCH /api/calendar/{postId}` | CalendarPage | **Never called** |
| `executionApi.runStream()` | `GET /api/execution/run` (SSE) | SchedulePage | **Never called** — scheduling methods are hardcoded |
| `engageApi.getComments()` | `GET /api/engage/comments` | EngagePage | **Never called** — comments are hardcoded |
| `engageApi.sendReply()` | `POST /api/engage/reply` | EngagePage | **Never called** |
| `chatApi.sendStream()` | `GET /api/chat/stream` (SSE) | Chat sidebar | **Never called** — no chat UI is wired |

> **Also missing from api.ts:** `PATCH /api/variants/{id}`, `POST /api/campaign/regenerate`, and `POST /api/compliance/check` (described in Sections 11.2 and 13.3) are not defined in `api.ts` at all. Must be added during Phase C alongside `variantsApi.update()`, `campaignApi.regenerate()`, and `complianceApi.check()`.

### 16.3 Hooks Status

| Hook | Status | Issue |
|------|--------|-------|
| `useStream` | **Functional but unused** | Manages EventSource correctly. No page calls `connect()` |
| `useCampaign` | **Working** | Used by AudiencePage, GoalsPage, CreativePage, ReviewPage |
| `useAgentState` | **Orphaned** | Fetches agent state via react-query but no page consumes the returned data |
| `useSession` | **Working** | Syncs sessionId between contexts |

### 16.4 Pages With 100% Mock Data

| Page | What's Hardcoded | What Should Come From Backend |
|------|-------------------|------------------------------|
| **VariantsPage** | All campaign variants (copy, hashtags, CTA, image URLs, scores) | `variants` table populated by generation SSE stream |
| **CalendarPage** | All 30-day calendar posts | `calendar_posts` table populated by `POST /api/calendar/generate` |
| **SchedulePage** | Scheduling methods, Instagram account info | Execution results from `GET /api/execution/run` SSE |
| **EngagePage** | Comments, replies, escalation rules, sentiment | `GET /api/engage/comments` + GPT-4o reply suggestions |
| **ReviewPage** | AI generation progress animation (simulated steps) | Real SSE stream from `GET /api/campaign/generate` |
| **GoalsPage** | Budget insights (reach, CPM estimates) | `POST /api/budget/estimate` |

### 16.5 Frontend Fixes Required Per Phase

Each backend phase requires a corresponding frontend fix to replace mock data with real API calls:

| Phase | Frontend Fix Required |
|-------|----------------------|
| Phase A | Add `submitStep.mutate({ step: 1, data })` to SetupPage "Next" click |
| Phase B | Already wired — `brandApi.uploadDocument()` works |
| Phase C | Rewire ReviewPage: replace fake progress with `campaignApi.generateStream()` + `useStream` hook. Wire VariantsPage to load data via `useAgentState` on mount + select/edit/regenerate + compliance check on edit. Add `variantsApi.update()`, `campaignApi.regenerate()`, and `complianceApi.check()` to api.ts |
| Phase D | Wire CalendarPage to `calendarApi.generate()` on mount + `useAgentState` for refresh. Add "Approve Calendar" button that calls `wizardApi.resume(sid, true)` before navigating to SchedulePage. Wire GoalsPage to `budgetApi.estimate()` |
| Phase E | Wire SchedulePage to `executionApi.runStream()` |
| Phase F | Wire EngagePage to `engageApi.getComments()` + `sendReply()`. Add chat sidebar UI wired to `chatApi.sendStream()` |

---

## 17. Build Order (Corrected)

> **Note:** Each phase includes both backend tasks and required frontend fixes. They ship as pairs.

### Phase A — Foundation (backend server + state persistence)

| # | Type | Task | Files |
|---|------|------|-------|
| A1 | Backend | FastAPI app skeleton, CORS, route mounting | `main.py`, `config.py` |
| A2 | Backend | Database setup + sessions table | `db/database.py`, `db/tables.py`, `db/queries.py` |
| A3 | Backend | Wizard routes (step save + state load + resume) | `api/wizard.py`, `models/session.py` |
| A4 | **Frontend fix** | Add `submitStep` call to SetupPage "Next" click | `pages/SetupPage.tsx` |

**Milestone:** Frontend saves ALL wizard steps (including Step 1) to the backend DB. Session resumes on page refresh.

### Phase B — Brand Upload (document parsing pipeline)

| # | Type | Task | Files |
|---|------|------|-------|
| B1 | Backend | Format-specific parsers | `parsers/pdf_parser.py`, `parsers/docx_parser.py`, `parsers/pptx_parser.py`, `parsers/zip_parser.py`, `parsers/image_parser.py` |
| B2 | Backend | Brand parser orchestrator | `services/brand_parser.py` |
| B3 | Backend | Logo extraction + filtering | `services/logo_extractor.py` |
| B4 | Backend | GPT-4o insight extraction | `services/insight_extractor.py` |
| B5 | Backend | Upload endpoint | `api/brand.py`, `models/brand.py` |

**Milestone:** User uploads brand book → gets insights + logos on SetupPage. (Frontend already wired — no fix needed.)

### Phase C — Generation Pipeline (replaces ReviewPage fake progress)

| # | Type | Task | Files |
|---|------|------|-------|
| C1 | Backend | Context composer | `services/context_composer.py` |
| C2 | Backend | Copy generator (GPT-4o) | `services/copy_generator.py` |
| C3 | Backend | Image generator (FLUX 1.1 Pro + Pillow) | `services/image_generator.py` |
| C4 | Backend | Compliance checker + Instagram rules | `services/compliance_checker.py`, `generators/instagram.py` |
| C5 | Backend | Campaign API: preflight + SSE generation + regenerate + variant CRUD | `api/campaign.py`, `models/campaign.py` |
| C6 | Backend | Variants table in DB | `db/tables.py` update |
| C7 | **Frontend fix** | Rewire ReviewPage: replace simulated progress with `campaignApi.generateStream()` + `useStream` hook | `pages/ReviewPage.tsx` |
| C8 | **Frontend fix** | Rewire VariantsPage: load variants via `useAgentState` on mount, add select/edit/regenerate | `pages/VariantsPage.tsx` |
| C9 | **Frontend fix** | Add `variantsApi.update()`, `campaignApi.regenerate()`, and `complianceApi.check()` to api.ts | `lib/api.ts` |
| C10 | Backend | Compliance check route (on-demand validation) | `api/compliance.py` |

**Milestone:** Real AI generation — variants + images streamed to frontend via SSE. VariantsPage shows backend-generated content.

### Phase D — Calendar + Budget (replaces CalendarPage and GoalsPage mocks)

| # | Type | Task | Files |
|---|------|------|-------|
| D1 | Backend | Calendar builder | `services/calendar_builder.py` |
| D2 | Backend | Calendar API | `api/calendar.py`, `models/calendar.py` |
| D3 | Backend | Calendar posts table in DB | `db/tables.py` update |
| D4 | Backend | Budget estimator | `services/budget_estimator.py`, `api/budget.py` |
| D5 | **Frontend fix** | Wire CalendarPage to `calendarApi.generate()` on mount + `calendarApi.updatePost()` for edits + `useAgentState` for refresh | `pages/CalendarPage.tsx` |
| D6 | **Frontend fix** | Wire GoalsPage to `budgetApi.estimate()` for real reach/CPM estimates | `pages/GoalsPage.tsx` |
| D7 | **Frontend fix** | Add "Approve Calendar" button to CalendarPage that calls `wizardApi.resume(sid, true)` before navigating to SchedulePage | `pages/CalendarPage.tsx` |

**Milestone:** 30-day calendar generated from real variants. Calendar approval gate works. Budget estimates are live. **MVP functionally complete.**

### Phase E — Video + Execution (replaces SchedulePage mock)

| # | Type | Task | Files |
|---|------|------|-------|
| E1 | Backend | Video generator (Sora 2) | `services/video_generator.py` |
| E2 | Backend | Execution API (SSE) | `api/execution.py` |
| E3 | **Frontend fix** | Wire SchedulePage to `executionApi.runStream()` for real publish/schedule | `pages/SchedulePage.tsx` |

**Milestone:** Reels generation works. Campaigns can be scheduled/published.

### Phase F — Engagement + Chat (replaces EngagePage mock, adds chat)

| # | Type | Task | Files |
|---|------|------|-------|
| F1 | Backend | Engagement service (GPT-4o reply suggestions) | `services/engagement.py`, `api/engage.py`, `models/engagement.py` |
| F2 | Backend | Chat streaming service | `api/chat.py` |
| F3 | **Frontend fix** | Wire EngagePage to `engageApi.getComments()` + `sendReply()` | `pages/EngagePage.tsx` |
| F4 | **Frontend fix** | Add chat sidebar UI wired to `chatApi.sendStream()` | New component + integration |

**Milestone:** Engagement management live. Natural language chat assistant functional. Full product complete.

### Phase Summary

| Phase | Backend Tasks | Backend Files | Frontend Fixes | Milestone |
|-------|--------------|---------------|----------------|----------|
| A | 3 tasks | 7 files (main, config, database, tables, queries, api/wizard, models/session) | 1 page fix (SetupPage) | Wizard state persists in DB |
| B | 5 tasks | 10 files (5 parsers + brand_parser, logo_extractor, insight_extractor, api/brand, models/brand) | None needed | Brand upload works end-to-end |
| C | 7 tasks | 8 new + 1 update (context_composer, copy/image generators, compliance_checker, instagram, api/campaign, api/compliance, models/campaign, tables update) | 2 page fixes + 3 api.ts additions (ReviewPage, VariantsPage, add variantsApi + campaignApi.regenerate + complianceApi.check) | Real AI generation via SSE |
| D | 4 tasks | 5 new + 1 update (calendar_builder, api/calendar, models/calendar, budget_estimator, api/budget, tables update) | 3 page fixes (CalendarPage ×2, GoalsPage) | Calendar + budget live, calendar approval gate — **MVP complete** |
| E | 2 tasks | 2 files (video_generator, api/execution) | 1 page fix (SchedulePage) | Video + scheduling |
| F | 2 tasks | 4 files (services/engagement, api/engage, models/engagement, api/chat) | 2 page fixes (EngagePage + chat sidebar) | Full product |
| **Total** | **24 tasks** | **36 Python files** | **9 frontend fixes + 3 api.ts additions** | |

### BRD Phase Scope Cross-Reference

BRD Table 13 defines 4 phases. Here's how our build phases (A–F) map to BRD scope:

| BRD Phase | BRD Scope | Our Build Phases | Coverage |
|-----------|-----------|------------------|----------|
| **Phase 1 — MVP** | Instagram: onboarding, audience, goal setting, variant generation, brand-guided image generation, compliance check, 30-day calendar, scheduling integration | **A + B + C + D + E** | A=onboarding/state, B=brand upload, C=variant+image+compliance, D=calendar+budget, E=video+scheduling |
| **Phase 2** | Meta Ads (Instagram + Facebook paid), engagement management / auto-reply | **F** (engagement + chat) + future `generators/meta_ads.py` | F covers engagement/auto-reply. Meta Ads generator is future work |
| **Phase 3** | Google Ads: Search, Display, PMax, Shopping. Platform policy live-sync | Future `generators/google_ads.py` | Not in current build scope |
| **Phase 4** | Amazon Ads, Email, Influencer, Multi-user/agency | Future generators + new services | Not in current build scope |

**Key insight:** Our Phases A–E = BRD Phase 1 (MVP). Our Phase F = start of BRD Phase 2.

---

## 18. BRD Traceability Matrix

| BRD ID | Requirement | Frontend | Backend | Frontend Wired? | Build Phase | Status |
|--------|------------|----------|---------|----------------|------------|--------|
| BP-01 | Business Size Selection | SetupPage (dropdown) | Validated in wizard/step | ⚠️ Step 1 data not sent to backend on "Next" | Phase A (fix A4) | Partially covered |
| BP-02 | Location Targeting | SetupPage (LocationAutocomplete) | Stored in session state | ⚠️ Same as BP-01 | Phase A (fix A4) | Partially covered |
| BP-03 | Online Store Classification | SetupPage (store_type field) | Used in context_composer | ⚠️ Same as BP-01 | Phase A (fix A4) | Partially covered |
| BP-04 | Company & Product Info | SetupPage (form fields) | Validated + persisted | ⚠️ Same as BP-01 | Phase A (fix A4) | Partially covered |
| BP-05 | Brand Guidelines Input | SetupPage (UploadZone) | brand_parser + insight_extractor | ✅ Upload call works | Phase B | Frontend wired |
| AU-01 | Audience Segment Selection | AudiencePage (chips) | Stored in session | ✅ `submitStep` fires | Phase A | Frontend wired |
| AU-02 | Audience Description | AudiencePage (textarea) | Used in context_composer | ✅ `submitStep` fires | Phase A | Frontend wired |
| AU-03 | Geographic Targeting | AudiencePage (location field) | Used in context_composer | ✅ `submitStep` fires | Phase A | Frontend wired |
| AU-04 | Primary vs Secondary Segments | AudiencePage (fields) | Used in context_composer | ✅ `submitStep` fires | Phase A | Frontend wired |
| CG-01 | Campaign Goal Selection | GoalsPage (OptionCards) | Used in copy_generator + recommended variant logic | ✅ `submitStep` fires | Phase A | Frontend wired |
| CG-02 | Time Frame | GoalsPage (duration_days) | Used in calendar_builder | ✅ `submitStep` fires | Phase A | Frontend wired |
| CG-03 | Budget Input | GoalsPage (slider/input) | budget_estimator + calendar frequency | ⚠️ `submitStep` fires but `budgetApi.estimate()` never called — estimates hardcoded | Phase D (fix D6) | Partially covered |
| CG-04 | Channel Selection | GoalsPage (Instagram fixed for MVP) | generators/instagram.py | ✅ Implicit (MVP is Instagram-only) | Phase C | Covered |
| CG-05 | Campaign Type Within Channel | GoalsPage + CreativePage (formats[]) | Routes pipeline to post/image/video | ✅ `submitStep` fires | Phase C | Frontend wired |
| CV-01 | Multi-Variant Generation | VariantsPage | copy_generator (batch N variants) | ❌ Page uses hardcoded mock data | Phase C (fix C8) | Mock only |
| CV-02 | Recommended Variant Flagging | VariantsPage (is_recommended badge) | Logic in copy_generator | ❌ Hardcoded recommendations | Phase C (fix C8) | Mock only |
| CV-03 | Edit & Regenerate | VariantsPage (regenerate button) | `POST /api/campaign/regenerate` + GPT-4o | ❌ Endpoint not in api.ts, no UI wired | Phase C (fix C8 + api.ts addition) | Not wired |
| CV-04 | Campaign Continuity | context_composer.py | All context flows into every AI call | N/A (backend design) | Phase C | Designed |
| CV-05 | Hashtag Suggestions | CreativePage config → VariantsPage output | Generated with copy, respects hashtag_count/mix/seeds | ❌ Hardcoded hashtags on VariantsPage | Phase C (fix C8) | Mock only |
| IG-01 | Image Style Selection | CreativePage (image_style) | Used in FLUX image prompt | ✅ `submitStep` fires | Phase C | Frontend wired |
| IG-02 | Content Type Selection | CreativePage (content_type) | Routes to image and/or video pipeline | ✅ `submitStep` fires | Phase C | Frontend wired |
| IG-03 | Brand-Guided Generation | brand_insights + brand_colours in session | Injected into image prompt via context_composer | ✅ Data available from upload | Phase C | Designed |
| IG-04 | Image Feedback & Regeneration | Not wired in frontend | POST /campaign/regenerate with image feedback | ❌ No feedback UI exists | Phase C + future frontend | Not wired |
| IG-05 | Instagram Size Compliance | CreativePage (image_sizes[]) | Pillow resize + platform_rules validation | ✅ Sizes collected | Phase C | Designed |
| IG-06 | Plagiarism / Copyright Check | — | compliance_checker (best-effort for AI-generated content) | N/A (backend only) | Phase C | Designed |
| IG-07 | Reference URL Input | instagram_url collected on SetupPage | Stored but not actively analyzed in MVP | ⚠️ URL collected but never sent for analysis | Deferred | Deferred |
| CC-01 | 30-Day Content Calendar | CalendarPage (FullCalendar UI exists) | calendar_builder.py | ❌ Calendar data is hardcoded | Phase D (fix D5) | Mock only |
| CC-02 | Calendar Editing | CalendarPage (drag/swap UI exists) | PATCH /calendar/{postId} | ❌ `calendarApi.updatePost()` never called | Phase D (fix D5) | Mock only |
| CC-03 | Scheduling Integration | SchedulePage | execution API + third-party tool export | ❌ `executionApi.runStream()` never called — methods hardcoded | Phase E (fix E3) | Mock only |
| CC-04 | Budget Pause Trigger | — | Budget tracking in calendar_builder → pause posts if exhausted | N/A (backend logic) | Phase D | Designed |
| CC-05 | Advance Planning | — | POST /calendar/generate can be called again for next month | N/A (backend logic) | Phase D | Designed |
| AW-01 | Campaign Approval Step | ReviewPage | POST /wizard/resume (human_approved) | ✅ `approve.mutate()` works | Phase A | Frontend wired |
| AW-02 | Sequential Navigation | WizardLayout + Sidebar + WizardNav | Step-based routing with guards | ✅ Fully functional | N/A | Complete |
| AW-03 | State Persistence | SessionContext (localStorage) | sessions table (DB) + GET /wizard/state | ⚠️ Frontend persists to localStorage. `useAgentState` fetches from backend but no page reads it | Phase A | Partially covered |
| EM-01 | Auto-Reply Suggestions | EngagePage | GPT-4o engagement reply suggestions | ❌ `engageApi.getComments()` never called — comments hardcoded | Phase F (fix F3) | Mock only |
| EM-02 | Human Escalation Rules | EngagePage (needsEscalation flag) | Sentiment analysis + escalation logic | ❌ Hardcoded escalation | Phase F (fix F3) | Mock only |
| EM-03 | Brand Tone Training | — | Future: few-shot from past posts stored as embeddings | N/A | Deferred | Deferred |

### Known Gaps (from BRD Section 8) — Resolution Status

| Gap | Issue | Resolution |
|-----|-------|-----------|
| G-01 | Context not carried into image generation | **Resolved**: context_composer.py ensures all context flows into every AI call |
| G-02 | No channel filter | **Resolved**: MVP is Instagram-only; channel_select field exists for future |
| G-03 | Default model when no brand guidelines | **Resolved**: If brand_insights is null, use sensible defaults in context_composer but warn user |
| G-04 | No content type selector | **Resolved**: content_type field in CreativePage (Image/Reel/Both) |
| G-05 | Image size validation not enforced | **Resolved**: Pillow resize + platform_rules compliance check |
| G-06 | No multi-step navigation | **Resolved**: WizardLayout + Sidebar + StepIndicator + NavBar |
| G-07 | Platform rules hard-coded | **Resolved**: platform_rules database table, updateable without code changes |
| G-08 | No 30-day calendar | **Resolved**: CalendarPage + FullCalendar + calendar_builder.py |
| G-09 | Video generation timeout not surfaced | **Resolved**: SSE video_timeout event + partial result return + retry option |

---

## 19. Future-Proofing

### 19.1 Multi-Channel Architecture

The `generators/` folder is designed for channel expansion:

```
generators/
├── instagram.py          ← MVP (prompt templates, size rules, format specs)
├── google_ads.py         ← Phase 3 (Search, Display, PMax, Shopping templates)
├── meta_ads.py           ← Phase 2 (Facebook + Instagram paid)
├── amazon_ads.py         ← Phase 4
└── email.py              ← Phase 4
```

Each generator implements the same interface:
```
generate(session_state, platform_rules) → { variants, calendar }
```

The `platform_rules` table stores rules per platform. Adding a new channel = new generator module + new platform_rules rows. Core pipeline (context_composer, copy_generator, compliance_checker) stays unchanged.

### 19.2 RAG / Vector Search (when needed)

Current approach: Context stuffing (brand book text fits in 128K token context window).

When documents grow (100+ brands, dozens of documents each):
1. Add `pgvector` extension to PostgreSQL
2. Add `embedding VECTOR(1536)` column to a `brand_documents` table
3. On upload: chunk text → `openai.embeddings.create()` → store vector
4. On generation: embed query → `SELECT ... ORDER BY embedding <=> query LIMIT 5`

Same PostgreSQL database, one extension, ~30 lines of Python. No new services needed.

### 19.3 Agent Capabilities (when needed)

If the AI needs to make dynamic decisions (choose tools, search trending hashtags, check competitor posts):
- Wrap specific flows in LangGraph StateGraph
- Keep LangGraph as a service dependency, not the framework backbone
- Call graph from a FastAPI route like any other service function
- Everything else stays as plain Python

---

**End of Document**

*AI-Powered Marketing Campaign Generator — Technical Design Document v1.3*

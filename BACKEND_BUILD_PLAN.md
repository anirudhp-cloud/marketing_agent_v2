# Marketing Agent v2 — Backend Build Plan

**Version:** 2.0 — Full Reanalysis  
**Date:** March 15, 2026  
**Source of Truth:** Frontend code (`api.ts`, all 9 pages, hooks, context), BRD (14 tables), `.env`

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Backend File Structure](#2-backend-file-structure)
3. [Frontend → Backend Contract](#3-frontend--backend-contract)
4. [Complete Backend Workflow](#4-complete-backend-workflow)
5. [Endpoint Specifications](#5-endpoint-specifications)
6. [SSE Protocol](#6-sse-protocol)
7. [Database Schema](#7-database-schema)
8. [Service Layer](#8-service-layer)
9. [Error Handling](#9-error-handling)
10. [Build Phases](#10-build-phases)
11. [Frontend Fixes Required](#11-frontend-fixes-required)
12. [Environment Configuration](#12-environment-configuration)
13. [BRD Traceability](#13-brd-traceability)

---

## 1. Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                    BROWSER (React 18 SPA)                     │
│  Vite + TypeScript + Tailwind + react-query + react-router   │
│                                                               │
│  SessionContext (localStorage)  →  WizardContext (useReducer) │
│  useStream (EventSource)        →  useCampaign (react-query)  │
│  useAgentState (react-query)    →  useSession (sync helper)   │
└──────────────────────┬───────────────────────────────────────┘
                       │ HTTP (JSON) + SSE (EventSource)
                       │ Port 5173 (dev) / :80 (prod via Nginx)
┌──────────────────────▼───────────────────────────────────────┐
│                 NGINX (:80 prod only)                          │
│  /api/* → http://backend:8000    |    /* → static frontend    │
└──────────────────────┬───────────────────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────────────────┐
│                    FastAPI (:8000)                             │
│                                                               │
│  api/          → Thin route handlers                         │
│  services/     → Business logic + AI calls                   │
│  parsers/      → Document format parsers                     │
│  models/       → Pydantic request/response schemas           │
│  db/           → Database layer (aiosqlite)                  │
│  generators/   → Channel-specific logic (Instagram)          │
│  utils/        → Shared helpers (LLM client, Pillow)         │
└──────┬──────────────────┬────────────────────────────────────┘
       │                  │
┌──────▼──────┐   ┌──────▼──────────────────────────────────┐
│  SQLite     │   │  Azure AI Services                       │
│  (dev)      │   │  ├── Azure OpenAI GPT-4o (text gen)      │
│  PostgreSQL │   │  ├── FLUX 1.1 Pro (image gen)            │
│  (prod)     │   │  └── Sora 2 (video gen / Reels)          │
└─────────────┘   └─────────────────────────────────────────┘
```

---

## 2. Backend File Structure

```
backend/
├── app/
│   ├── main.py                     ← FastAPI app, CORS, lifespan, route mounting
│   ├── config.py                   ← pydantic-settings: loads .env
│   │
│   ├── api/                        ← Route handlers (thin — delegate to services/)
│   │   ├── wizard.py               ← POST /step, GET /state/{id}, POST /resume
│   │   ├── brand.py                ← POST /upload
│   │   ├── campaign.py             ← GET /generate (SSE), POST /regenerate, POST /preflight
│   │   ├── variants.py             ← PATCH /{id}
│   │   ├── compliance.py           ← POST /check
│   │   ├── calendar.py             ← POST /generate, PATCH /{postId}
│   │   ├── budget.py               ← POST /estimate
│   │   ├── execution.py            ← GET /run (SSE)
│   │   ├── engage.py               ← GET /comments, POST /reply
│   │   └── chat.py                 ← GET /stream (SSE)
│   │
│   ├── services/                   ← All business logic
│   │   ├── context_composer.py     ← Builds full AI prompt from session data
│   │   ├── brand_parser.py         ← MIME detection → delegates to parsers/
│   │   ├── logo_extractor.py       ← Image filtering + best candidate selection
│   │   ├── insight_extractor.py    ← GPT-4o: text → brand guidelines JSON
│   │   ├── copy_generator.py       ← GPT-4o: context → captions + CTAs + hashtags
│   │   ├── image_generator.py      ← FLUX 1.1 Pro → logo overlay → resize
│   │   ├── video_generator.py      ← Sora 2: variant → Reel video
│   │   ├── calendar_builder.py     ← 30-day plan: date assignment + time slots
│   │   ├── budget_estimator.py     ← Reach/CPM/CPC math
│   │   ├── compliance_checker.py   ← Instagram specs + policy rules
│   │   └── engagement.py           ← GPT-4o: comment → reply suggestions
│   │
│   ├── parsers/                    ← Format-specific document parsers
│   │   ├── pdf_parser.py           ← PyMuPDF: text + images
│   │   ├── docx_parser.py          ← python-docx: paragraphs + media
│   │   ├── pptx_parser.py          ← python-pptx: text + slides
│   │   ├── zip_parser.py           ← Unpack → recursive delegation
│   │   └── image_parser.py         ← Direct JPG/PNG as logo candidate
│   │
│   ├── models/                     ← Pydantic schemas
│   │   ├── session.py              ← StepSubmission, SessionDict, AgentStateResponse
│   │   ├── brand.py                ← BrandInsights, UploadResponse
│   │   ├── campaign.py             ← CampaignVariant, GenerateRequest, ComplianceReport
│   │   ├── calendar.py             ← CalendarPost, CalendarResponse
│   │   └── engagement.py           ← Comment, ReplyRequest, ReplyResponse
│   │
│   ├── db/                         ← Database layer
│   │   ├── database.py             ← aiosqlite connection pool (WAL mode)
│   │   ├── tables.py               ← CREATE TABLE: sessions, variants, calendar_posts
│   │   └── queries.py              ← CRUD functions
│   │
│   ├── utils/                      ← Shared helpers
│   │   ├── llm.py                  ← Azure OpenAI client factory
│   │   └── image.py                ← Pillow: resize, logo overlay, format conversion
│   │
│   └── generators/                 ← Channel-specific prompt templates + rules
│       └── instagram.py            ← FORMAT_SPECS, CAPTION_LIMIT, build_copy_prompt(), etc.
│
├── static/uploads/{session_id}/    ← Brand books, logos, generated assets
├── Dockerfile
├── requirements.txt
└── .env
```

---

## 3. Frontend → Backend Contract

### 3.1 Complete Endpoint Map

Every endpoint defined in `frontend/src/lib/api.ts`, mapped to which page calls it and its current status:

| # | Method | Path | Frontend Function | Called By (Page) | Status |
|---|--------|------|-------------------|------------------|--------|
| 1 | POST | `/api/brand/upload` | `brandApi.uploadDocument(file)` | SetupPage (on file upload) | **Called** — but sends NO session_id |
| 2 | POST | `/api/wizard/step` | `wizardApi.submitStep(sid, step, data)` | AudiencePage (step 2), GoalsPage (step 3), CreativePage (step 4) | **Called** — steps 2-4 only |
| 3 | GET | `/api/wizard/state/{id}` | `wizardApi.getState(sessionId)` | `useAgentState` hook (not used by any page) | **Defined, never called** |
| 4 | POST | `/api/wizard/resume` | `wizardApi.resume(sid, approved)` | ReviewPage (on "Generate" click) | **Called** |
| 5 | POST | `/api/campaign/preflight` | `campaignApi.preflight(sid)` | None | **Defined, never called** |
| 6 | GET (SSE) | `/api/campaign/generate?session_id=` | `campaignApi.generateStream(sid)` | None (ReviewPage uses fake progress) | **Defined, never called** |
| 7 | POST | `/api/budget/estimate` | `budgetApi.estimate(data)` | None (GoalsPage has no budget API call) | **Defined, never called** |
| 8 | POST | `/api/calendar/generate` | `calendarApi.generate(sid)` | None (CalendarPage is 100% mocked) | **Defined, never called** |
| 9 | PATCH | `/api/calendar/{postId}` | `calendarApi.updatePost(postId, data)` | None (CalendarPage is 100% mocked) | **Defined, never called** |
| 10 | GET (SSE) | `/api/execution/run?session_id=` | `executionApi.runStream(sid)` | None (SchedulePage is 100% mocked) | **Defined, never called** |
| 11 | GET | `/api/engage/comments?session_id=` | `engageApi.getComments(sid)` | None (EngagePage is 100% mocked) | **Defined, never called** |
| 12 | POST | `/api/engage/reply` | `engageApi.sendReply(commentId, reply)` | None (EngagePage is 100% mocked) | **Defined, never called** |
| 13 | GET (SSE) | `/api/chat/stream?session_id=&message=` | `chatApi.sendStream(sid, msg)` | None | **Defined, never called** |

### 3.2 Endpoints Needed but NOT in api.ts

These endpoints are needed by the backend workflow but have no corresponding function in the frontend `api.ts`:

| # | Method | Path | Purpose | Needed By |
|---|--------|------|---------|-----------|
| 14 | PATCH | `/api/variants/{id}` | Edit a single variant (copy, CTA, hashtags) | VariantsPage (edit + compliance re-check) |
| 15 | POST | `/api/campaign/regenerate` | Regenerate a single variant with instructions | VariantsPage ("Request Changes" button) |
| 16 | POST | `/api/compliance/check` | On-demand compliance check | VariantsPage (after variant edit) |

### 3.3 Frontend Reality Check — What Each Page Actually Does

| Page | Step | API Calls (Real) | Mocked Data | What Backend Must Provide |
|------|------|-----------------|-------------|--------------------------|
| **SetupPage** | 1 | `brandApi.uploadDocument(file)` | Default form values ("SmartWheels") | Brand insights + logo extraction |
| **AudiencePage** | 2 | `wizardApi.submitStep(sid, 2, data)` | Segment/age/gender lists | Save step data |
| **GoalsPage** | 3 | `wizardApi.submitStep(sid, 3, data)` | Goal/format lists, budget tiers | Save step data |
| **CreativePage** | 4 | `wizardApi.submitStep(sid, 4, data)` | Image styles, tones | Save step data |
| **ReviewPage** | 5 | `wizardApi.resume(sid, true)` | Fake progress bar (5 steps) | Approve → trigger generation |
| **VariantsPage** | 6 | None | 4 hardcoded `MOCK_VARIANTS` + hashtags | Load variants + edit/regenerate |
| **CalendarPage** | 7 | None | `CAL_DATA` grid with mock posts | Generate + load 30-day calendar |
| **SchedulePage** | 8 | None | 6 scheduling methods list | Export assets for scheduling |
| **EngagePage** | 9 | None | 3 `MOCK_COMMENTS` with reply suggestions | Load comments + send replies |

**Critical Finding:** Steps 1-5 make real API calls. Steps 6-9 use 100% hardcoded mock data.

### 3.4 Frontend Type → Backend Response Mapping

The backend MUST return data matching these exact TypeScript types from `context/types.ts`.

**CampaignVariant** (frontend expects):
```typescript
{
  id: number;
  angle: string;        // "Lifestyle Aspiration", "Problem → Solution"
  headline: string;     // short title
  copy: string;         // full caption text
  cta: string;          // "Shop Now →"
  targetSegment: string; // "Young Professionals"
  imageryStyle: string;  // "Lifestyle — person enjoying..."
  imageUrl?: string;     // generated image URL
  score?: number;        // AI quality score
  recommended?: boolean; // system recommendation flag
}
```

**CalendarPost** (frontend expects):
```typescript
{
  id: string;
  date: string;          // "2026-04-15"
  type: "post" | "reel" | "story" | "carousel";
  caption: string;
  hashtags: string[];
  bestTime: string;      // "9:00 AM"
  imageUrl?: string;
}
```

**EngagementComment** (frontend expects):
```typescript
{
  id: string;
  author: string;
  avatar: string;
  comment: string;
  timeAgo: string;
  postRef: string;
  sentiment: "positive" | "neutral" | "negative";
  needsEscalation: boolean;
  replySuggestions: string[];
}
```

**AgentState** (returned by `GET /wizard/state/{id}`):
```typescript
{
  businessProfile: BusinessProfile;
  audience: AudienceConfig;
  goals: CampaignGoals;
  creative: CreativeConfig;
  compliancePassed: boolean;
  humanApproved: boolean;
  variants: CampaignVariant[];
  selectedVariant: number | null;
  calendarPosts: CalendarPost[];
  executionResults: Record<string, unknown>;
  pendingReplies: EngagementComment[];
  currentStep: number;
  error: string | null;
}
```

> **Key implication:** The backend `sessions` table stores flat JSON, but `GET /wizard/state/{id}` must JOIN sessions + variants + calendar_posts and transform into this nested `AgentState` shape.

---

## 4. Complete Backend Workflow

### 4.1 Session Creation

The frontend generates `session_id` client-side in `SessionContext.ensureSessionId()`:
```
session_id = `insta_${companyName}_${uuid()}`
```

No `POST /api/wizard/start` endpoint is needed. The session row in the DB is created via **upsert** when the first `POST /api/wizard/step` arrives.

However, brand upload happens BEFORE any step submission. Current issue: `brandApi.uploadDocument(file)` sends NO `session_id`. Two approaches:

| Approach | How It Works | Frontend Fix | Backend Complexity |
|----------|-------------|-----------|-------------------|
| **A: Stateless Upload** | Upload returns insights JSON. Frontend stores in session. Step 1 sends to backend. | None | Low — no DB in upload |
| **B: Session-Aware Upload** | Frontend sends `session_id` with upload. Backend saves to `static/uploads/{sid}/`. | Add `session_id` to FormData | Medium — creates upload dir |

**Chosen: Approach B** — because the backend needs to save the uploaded file for logo extraction, and session_id isolates files per user.

### 4.2 Full Journey — Step by Step

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 1: SetupPage — Business Profile                                        │
│                                                                             │
│  User fills form: company name, website, category, size, location,          │
│  instagram URL, store type, brand colors, typography, logo placement        │
│                                                                             │
│  [Optional] User uploads brand book:                                        │
│     Frontend → POST /api/brand/upload (file + session_id)                   │
│     Backend  → brand_parser → logo_extractor → insight_extractor (GPT-4o)   │
│     Backend  ← { insights: BrandInsights, logo_found: bool }               │
│     Frontend auto-fills form fields from insights                           │
│                                                                             │
│  User clicks "Next":                                                        │
│     Frontend → POST /api/wizard/step { session_id, step: 1, data }         │
│     Backend  → UPSERT session row, save step 1 data                         │
│     Backend  ← { status: "ok", next_step: 2 }                              │
│     Frontend → navigate to /audience                                        │
│                                                                             │
│  ⚠️ FRONTEND FIX: SetupPage currently does NOT call submitStep on Next.    │
│     It just navigates. Step 1 data is never sent to backend.                │
├─────────────────────────────────────────────────────────────────────────────┤
│ STEP 2: AudiencePage — Audience Config                                      │
│                                                                             │
│  User fills: segments, description, geoTargeting, ageRange, genderFocus,    │
│  activityLevel, primarySegment, secondarySegment                            │
│                                                                             │
│  User clicks "Next":                                                        │
│     Frontend → POST /api/wizard/step { session_id, step: 2, data }         │
│     Backend  → save step 2 data to session                                  │
│     Backend  ← { status: "ok", next_step: 3 }                              │
│     Frontend → navigate to /goals                                           │
│                                                                             │
│  ✅ WORKS as-is. No fix needed.                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│ STEP 3: GoalsPage — Campaign Goals                                          │
│                                                                             │
│  User fills: goalType, budget, formats, durationDays, startDate             │
│                                                                             │
│  User clicks "Next":                                                        │
│     Frontend → POST /api/wizard/step { session_id, step: 3, data }         │
│     Backend  → save step 3 data to session                                  │
│     Backend  ← { status: "ok", next_step: 4 }                              │
│     Frontend → navigate to /creative                                        │
│                                                                             │
│  ✅ WORKS as-is. No fix needed.                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│ STEP 4: CreativePage — Creative Config                                      │
│                                                                             │
│  User fills: imageStyle, contentType, imageSizes, seedHashtags,             │
│  variantCount, toneOfVoice, hashtagCount, hashtagMix                        │
│                                                                             │
│  User clicks "Next":                                                        │
│     Frontend → POST /api/wizard/step { session_id, step: 4, data }         │
│     Backend  → save step 4 data to session                                  │
│     Backend  ← { status: "ok", next_step: 5 }                              │
│     Frontend → navigate to /review                                          │
│                                                                             │
│  ✅ WORKS as-is. No fix needed.                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│ STEP 5: ReviewPage — Review & AI Generation                                 │
│                                                                             │
│  User reviews all inputs from steps 1-4.                                    │
│                                                                             │
│  User clicks "Generate Campaign":                                           │
│     1. Frontend → POST /api/wizard/resume { session_id, approved: true }    │
│     2. Frontend → opens EventSource: GET /api/campaign/generate?session_id= │
│     3. Backend streams SSE events:                                          │
│        → { event: "status", data: "composing_context" }                     │
│        → { event: "status", data: "generating_copy" }                       │
│        → { event: "variant", data: {variant_json} }     (× variant_count)  │
│        → { event: "status", data: "generating_images" }                     │
│        → { event: "image", data: {variant_id, image_url} } (× variant_count)│
│        → { event: "status", data: "checking_compliance" }                   │
│        → { event: "compliance", data: {report_json} }                       │
│        → { event: "done", data: "complete" }                                │
│     4. Frontend receives "done" → navigate to /variants                     │
│                                                                             │
│  ⚠️ FRONTEND FIX: ReviewPage currently shows fake progress bar.            │
│     Needs to be rewired to use campaignApi.generateStream() + useStream.    │
├─────────────────────────────────────────────────────────────────────────────┤
│ STEP 6: VariantsPage — Variant Selection & Editing                          │
│                                                                             │
│  On mount:                                                                  │
│     Frontend → GET /api/wizard/state/{session_id} via useAgentState         │
│     Backend  ← AgentState { ...session, variants: [...], ... }              │
│     Frontend renders variant cards from response                            │
│                                                                             │
│  User can:                                                                  │
│     • Select a variant → update local state                                 │
│     • Edit variant copy → PATCH /api/variants/{id} { copy, cta, ... }      │
│     • Regenerate variant → POST /api/campaign/regenerate { variant_id, ... }│
│     • Run compliance check → POST /api/compliance/check { variants }        │
│                                                                             │
│  User clicks "Proceed to Calendar":                                         │
│     Frontend → navigate to /calendar                                        │
│                                                                             │
│  ⚠️ FRONTEND FIX: VariantsPage is 100% mocked. Needs useAgentState on     │
│     mount + API calls for edit/regenerate/compliance.                        │
│  ⚠️ API.TS FIX: Add variantsApi.update(), campaignApi.regenerate(),        │
│     complianceApi.check()                                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│ STEP 7: CalendarPage — 30-Day Content Calendar                              │
│                                                                             │
│  On mount:                                                                  │
│     Frontend → POST /api/calendar/generate { session_id }                   │
│     Backend  → builds 30-day calendar from approved variants                │
│     Backend  ← { posts: CalendarPost[], total_posts, date_range }           │
│     Frontend renders calendar grid                                          │
│                                                                             │
│  On refresh / revisit:                                                      │
│     Frontend → GET /api/wizard/state/{session_id} via useAgentState         │
│     Backend  ← AgentState with calendarPosts[] populated                    │
│                                                                             │
│  User can:                                                                  │
│     • Edit a post → PATCH /api/calendar/{postId} { caption, date, ... }     │
│     • Move posts between days (drag/drop → PATCH)                           │
│                                                                             │
│  User clicks "Approve Calendar" / "Next":                                   │
│     Frontend → POST /api/wizard/resume { session_id, approved: true }       │
│     Frontend → navigate to /schedule                                        │
│                                                                             │
│  ⚠️ FRONTEND FIX: CalendarPage is 100% mocked. Needs calendar/generate    │
│     on mount + edit PATCH calls + approval button.                          │
├─────────────────────────────────────────────────────────────────────────────┤
│ STEP 8: SchedulePage — Scheduling & Export                                  │
│                                                                             │
│  User selects scheduling method (Buffer, Hootsuite, Later, Manual Export)   │
│                                                                             │
│  On "Export" / "Schedule":                                                   │
│     Frontend → opens EventSource: GET /api/execution/run?session_id=        │
│     Backend streams:                                                        │
│        → { event: "status", data: "preparing_export" }                      │
│        → { event: "export_ready", data: { type: "csv", url: "..." } }      │
│        → { event: "export_ready", data: { type: "ical", url: "..." } }     │
│        → { event: "done", data: "complete" }                                │
│     Frontend shows download links                                           │
│                                                                             │
│  User clicks "Next" → navigate to /engage                                   │
│                                                                             │
│  ⚠️ FRONTEND FIX: SchedulePage is 100% mocked.                            │
├─────────────────────────────────────────────────────────────────────────────┤
│ STEP 9: EngagePage — Engagement Management                                  │
│                                                                             │
│  On mount:                                                                  │
│     Frontend → GET /api/engage/comments?session_id=                         │
│     Backend  ← EngagementComment[] with AI reply suggestions                │
│     (MVP: returns demo/seed data with source: "demo" flag)                  │
│                                                                             │
│  User selects a reply suggestion:                                           │
│     Frontend → POST /api/engage/reply { comment_id, reply }                 │
│     Backend  ← { status: "sent" }                                           │
│                                                                             │
│  User clicks "Activate Campaign":                                           │
│     End of wizard flow. Campaign is live.                                   │
│                                                                             │
│  ⚠️ FRONTEND FIX: EngagePage is 100% mocked.                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Backend Internal Workflow — AI Generation Pipeline

This is the core of the system. When `GET /api/campaign/generate?session_id=` is called:

```
GET /api/campaign/generate?session_id=insta_smartwheels_abc123
│
├── 1. VALIDATE
│   ├── Load session from DB
│   ├── Verify steps 1-4 are complete
│   ├── Verify human_approved = true
│   └── If missing → SSE { event: "error", data: "Steps incomplete" } → close
│
├── 2. PREFLIGHT COMPLIANCE
│   ├── compliance_checker.preflight(session)
│   ├── Check: formats valid? budget > 0? variant_count ≤ 10?
│   └── SSE → { event: "status", data: "preflight_passed" }
│
├── 3. COMPOSE CONTEXT
│   ├── context_composer.compose_context(session_id)
│   │   ├── Pull from DB: business_profile + audience + goals + creative + brand_insights
│   │   └── Build structured text block:
│   │       ┌─────────────────────────────────────┐
│   │       │ ## Company Overview                  │
│   │       │ Name: SmartWheels                    │
│   │       │ Industry: Car Accessories            │
│   │       │ Tagline: Drive Better.               │
│   │       │                                      │
│   │       │ ## Brand Guidelines                  │
│   │       │ Colours: #1E40AF, #F59E0B            │
│   │       │ Typography: Modern Sans              │
│   │       │ Tone: Friendly, confident            │
│   │       │                                      │
│   │       │ ## Target Audience                   │
│   │       │ Segments: Young Professionals        │
│   │       │ Age: 25-40                           │
│   │       │ Location: Mumbai, Bangalore          │
│   │       │                                      │
│   │       │ ## Campaign Goals                    │
│   │       │ Type: Brand Awareness                │
│   │       │ Budget: ₹15,000                      │
│   │       │ Duration: 30 days                    │
│   │       │ Formats: post, reel                  │
│   │       │                                      │
│   │       │ ## Creative Direction                │
│   │       │ Style: Lifestyle                     │
│   │       │ Tone: Friendly                       │
│   │       │ Hashtags: #caraccessories...         │
│   │       └─────────────────────────────────────┘
│   └── SSE → { event: "status", data: "composing_context" }
│
├── 4. GENERATE COPY (GPT-4o)
│   ├── copy_generator.generate_copy(context, variant_count)
│   │   ├── instagram.build_copy_prompt(context, count, formats)
│   │   ├── Call Azure OpenAI GPT-4o (temp=0.8, JSON mode)
│   │   └── Parse response → list[CopyVariant]
│   ├── SSE → { event: "status", data: "generating_copy" }
│   ├── For each variant:
│   │   └── SSE → { event: "variant", data: { id, angle, headline, copy, cta, ... } }
│   └── Save variants to DB (variants table)
│
├── 5. GENERATE IMAGES (FLUX 1.1 Pro) — parallel per variant
│   ├── For each variant:
│   │   ├── image_generator.generate_image(variant, brand_insights, session_dir)
│   │   │   ├── instagram.build_image_prompt(variant, brand)
│   │   │   ├── Call FLUX 1.1 Pro API → raw image bytes
│   │   │   ├── overlay logo (if logo exists) via utils/image.py
│   │   │   ├── Resize to Instagram format specs (1080×1080 post, 1080×1920 story/reel)
│   │   │   └── Save to static/uploads/{session_id}/variant_{id}.png
│   │   └── SSE → { event: "image", data: { variant_id, image_url } }
│   ├── Update variant rows in DB with image_url
│   └── SSE → { event: "status", data: "generating_images" }
│
├── 6. GENERATE VIDEOS (Sora 2) — only if formats include "reel"
│   ├── For each reel variant:
│   │   ├── video_generator.generate_video(variant, brand, session_dir)
│   │   │   ├── Build Sora prompt from variant theme + brand
│   │   │   ├── Call Sora 2 API → video bytes
│   │   │   └── Save to static/uploads/{session_id}/variant_{id}_reel.mp4
│   │   └── SSE → { event: "video", data: { variant_id, video_url } }
│   └── Update variant rows in DB with video_url
│
├── 7. COMPLIANCE CHECK
│   ├── compliance_checker.check_compliance(variants)
│   │   ├── Image dimensions correct? (1080×1080 / 1080×1920)
│   │   ├── Caption ≤ 2200 chars?
│   │   ├── Hashtags ≤ 30?
│   │   ├── No prohibited content?
│   │   └── Returns ComplianceReport { passed: bool, issues: [...] per variant }
│   ├── Update variant compliance_status in DB
│   └── SSE → { event: "compliance", data: { report_json } }
│
└── 8. COMPLETE
    ├── Set session pipeline_state = "completed"
    └── SSE → { event: "done", data: "complete" }
```

### 4.4 Brand Upload Pipeline

```
POST /api/brand/upload (multipart: file + session_id)
│
├── 1. VALIDATE
│   ├── File size ≤ 50MB
│   ├── Extension in [.pdf, .docx, .pptx, .zip, .jpg, .jpeg, .png]
│   └── Save to static/uploads/{session_id}/brand_book.{ext}
│
├── 2. PARSE (brand_parser.py → delegates to parsers/)
│   ├── Detect MIME type
│   ├── .pdf  → pdf_parser.py (PyMuPDF)    → ParseResult(text, images[])
│   ├── .docx → docx_parser.py (python-docx) → ParseResult(text, images[])
│   ├── .pptx → pptx_parser.py (python-pptx) → ParseResult(text, images[])
│   ├── .zip  → zip_parser.py (unpack → recursive) → ParseResult(text, images[])
│   └── .jpg/.png → image_parser.py → ParseResult("", [file_path])
│
├── 3. EXTRACT LOGO (logo_extractor.py)
│   ├── Filter images: min size 100×100, reasonable aspect ratio
│   ├── Score candidates by size + aspect ratio
│   └── Save best → static/uploads/{session_id}/logo.png
│
├── 4. EXTRACT INSIGHTS (insight_extractor.py → GPT-4o)
│   ├── Send extracted text to GPT-4o with structured prompt
│   ├── If text < 100 chars + images exist → GPT-4o Vision fallback
│   └── Parse response → BrandInsights {
│         company_name, tagline, industry,
│         brand_colours, typography, tone_of_voice, USPs
│       }
│
└── 5. RESPONSE
    └── { insights: BrandInsights, logo_found: bool, extracted_text_length: int }
```

### 4.5 Calendar Builder Pipeline

```
POST /api/calendar/generate { session_id }
│
├── 1. Load session + approved variants from DB
│
├── 2. Distribution logic (calendar_builder.py):
│   ├── 30 days ÷ variant_count = posts per variant
│   ├── Weekday weighting: Mon-Fri heavier, weekends lighter
│   ├── Time slots: based on audience timezone + engagement research
│   │   ├── Morning: 8-10 AM (awareness, informational)
│   │   ├── Afternoon: 12-2 PM (engagement, promotional)
│   │   └── Evening: 6-9 PM (lifestyle, stories, reels)
│   ├── Format rotation: post → story → reel → post → ...
│   └── Variant rotation: cycle through all variants evenly
│
├── 3. Save calendar_posts to DB
│
└── 4. Return { posts: CalendarPost[], total_posts, date_range }
```

### 4.6 Budget Estimation

```
POST /api/budget/estimate { goal_type, budget, audience_size }
│
├── CPM rates (India market averages):
│   ├── brand_awareness  → ₹50-80 per 1000 impressions
│   ├── follower_growth  → ₹60-100
│   ├── engagement       → ₹80-150
│   ├── traffic          → ₹100-200
│   ├── conversion       → ₹150-300
│   └── promotional      → ₹70-120
│
├── Calculations:
│   ├── estimated_reach    = budget / (avg_cpm / 1000)
│   ├── daily_spend        = budget / duration_days
│   ├── projected_clicks   = estimated_reach × ctr_by_goal
│   └── projected_engagement = estimated_reach × engagement_rate
│
└── Return { estimated_reach, cpm, cpc, daily_spend, engagement_rate }
```

### 4.7 Engagement Pipeline

```
GET /api/engage/comments?session_id=
│
├── MVP: Return demo/seed data with source: "demo" flag
│   ├── Generate 3-5 realistic comments matching campaign context
│   ├── For each comment: GPT-4o → sentiment + 2 reply suggestions
│   └── Return EngagementComment[]
│
├── Future (Phase 2+): Instagram Graph API
│   ├── Fetch real comments from published posts
│   └── Same GPT-4o reply generation pipeline
│
POST /api/engage/reply { comment_id, reply }
│
├── MVP: Log reply, return { status: "sent" }
└── Future: Post reply via Instagram Graph API
```

---

## 5. Endpoint Specifications

### 5.1 POST /api/brand/upload

```
Method:    POST (multipart/form-data)
Path:      /api/brand/upload

Request:   file: UploadFile (max 50MB)
           session_id: str (form field)

Response:  200 → {
             insights: {
               company_name: str,
               tagline: str,
               industry: str,
               brand_colours: str[],
               typography: str,
               tone_of_voice: str,
               USPs: str[]
             },
             logo_found: bool,
             extracted_text_length: int
           }

Errors:    400 → Invalid file type / too large
           500 → GPT-4o call failed

Internal:  brand_parser → logo_extractor → insight_extractor
```

### 5.2 POST /api/wizard/step

```
Method:    POST
Path:      /api/wizard/step

Request:   {
             session_id: str,
             step: int (1-4),
             data: object (step-specific, see below)
           }

Step 1 data: BusinessProfile fields
Step 2 data: AudienceConfig fields
Step 3 data: CampaignGoals fields
Step 4 data: CreativeConfig fields

Response:  200 → { status: "ok", next_step: step + 1 }

Errors:    400 → Invalid step number or missing fields
           404 → Session not found (for step > 1)

Behavior:  Step 1 → UPSERT (create session if not exists)
           Steps 2-4 → UPDATE existing session
```

### 5.3 GET /api/wizard/state/{session_id}

```
Method:    GET
Path:      /api/wizard/state/{session_id}

Response:  200 → AgentState {
             businessProfile: {...},
             audience: {...},
             goals: {...},
             creative: {...},
             compliancePassed: bool,
             humanApproved: bool,
             variants: CampaignVariant[],     ← JOINed from variants table
             selectedVariant: int | null,
             calendarPosts: CalendarPost[],    ← JOINed from calendar_posts table
             executionResults: {},
             pendingReplies: [],
             currentStep: int,
             error: str | null
           }

Errors:    404 → Session not found

Internal:  SELECT sessions + LEFT JOIN variants + LEFT JOIN calendar_posts
           Transform flat rows → nested AgentState shape
```

### 5.4 POST /api/wizard/resume

```
Method:    POST
Path:      /api/wizard/resume

Request:   { session_id: str, human_approved: bool }

Response:  200 → { status: "ok", approved: true }

Internal:  SET human_approved = true in sessions table
```

### 5.5 POST /api/campaign/preflight

```
Method:    POST
Path:      /api/campaign/preflight

Request:   { session_id: str }

Response:  200 → { ready: true, checks: [...] }
           422 → { ready: false, missing: ["step_1", "step_3"] }

Internal:  Validate all 4 steps complete + brand insights present
```

### 5.6 GET /api/campaign/generate (SSE)

```
Method:    GET (EventSource)
Path:      /api/campaign/generate?session_id=

Response:  SSE stream (see Section 6 for event format)

Events:    status → variant → image → video → compliance → done | error

Internal:  See Section 4.3 (full pipeline)

Timeout:   Per BRD: copy <30s, images <60s each
```

### 5.7 POST /api/campaign/regenerate

```
Method:    POST
Path:      /api/campaign/regenerate

Request:   { session_id: str, variant_id: int, instructions: str }

Response:  200 → CampaignVariant (regenerated)

Internal:  compose_context → copy_generator (single variant, with user instructions)
           → image_generator → compliance_checker → update DB
```

### 5.8 PATCH /api/variants/{id}

```
Method:    PATCH
Path:      /api/variants/{id}

Request:   { copy?: str, cta?: str, hashtags?: str[], headline?: str }

Response:  200 → CampaignVariant (updated)

Internal:  Update variant in DB → re-run compliance_checker on changed fields
           Return updated variant with new compliance_status
```

### 5.9 POST /api/compliance/check

```
Method:    POST
Path:      /api/compliance/check

Request:   { variants: CampaignVariant[] }

Response:  200 → {
             passed: bool,
             results: [{ variant_id, passed, issues: str[] }]
           }
```

### 5.10 POST /api/calendar/generate

```
Method:    POST
Path:      /api/calendar/generate

Request:   { session_id: str }

Response:  200 → {
             posts: CalendarPost[],
             total_posts: int,
             date_range: { start: str, end: str }
           }

Internal:  calendar_builder → save to calendar_posts table
```

### 5.11 PATCH /api/calendar/{postId}

```
Method:    PATCH
Path:      /api/calendar/{postId}

Request:   { caption?: str, date?: str, bestTime?: str, type?: str }

Response:  200 → CalendarPost (updated)
```

### 5.12 POST /api/budget/estimate

```
Method:    POST
Path:      /api/budget/estimate

Request:   { goal_type: str, budget: number, audience_size: str }

Response:  200 → {
             estimated_reach: int,
             cpm: float,
             cpc: float,
             daily_spend: float,
             projected_clicks: int,
             projected_engagement: int,
             engagement_rate: float
           }
```

### 5.13 GET /api/execution/run (SSE)

```
Method:    GET (EventSource)
Path:      /api/execution/run?session_id=

Response:  SSE stream
           → { event: "status", data: "preparing_export" }
           → { event: "export_ready", data: { type: "csv", url: "/static/..." } }
           → { event: "export_ready", data: { type: "ical", url: "/static/..." } }
           → { event: "done", data: "complete" }

Internal:  Generate CSV (calendar data) + iCal file + optional JSON payload
           Save to static/uploads/{session_id}/exports/
```

### 5.14 GET /api/engage/comments

```
Method:    GET
Path:      /api/engage/comments?session_id=

Response:  200 → {
             comments: EngagementComment[],
             source: "demo" | "instagram"
           }

Internal:  MVP returns demo data. Future: Instagram Graph API.
```

### 5.15 POST /api/engage/reply

```
Method:    POST
Path:      /api/engage/reply

Request:   { comment_id: str, reply: str }

Response:  200 → { status: "sent", comment_id: str }
```

### 5.16 GET /api/chat/stream (SSE)

```
Method:    GET (EventSource)
Path:      /api/chat/stream?session_id=&message=

Response:  SSE stream
           → { event: "token", data: "..." }   (streamed GPT-4o response)
           → { event: "done", data: "" }

Internal:  Load session context → GPT-4o streaming completion
```

---

## 6. SSE Protocol

### 6.1 Event Format

The `useStream` hook in the frontend uses the standard `EventSource` API:
- Default `onmessage` handler receives unnamed events
- Named event `"done"` triggers `es.close()`

Backend must use `sse-starlette`'s `EventSourceResponse`:

```python
# Named events (frontend uses addEventListener):
yield {"event": "done",    "data": "complete"}

# Default events (frontend uses onmessage):
yield {"data": json.dumps({"type": "status", "value": "generating_copy"})}
```

**Recommended approach:** Use named events for all types so the frontend can selectively handle them:

```python
yield {"event": "status",     "data": json.dumps({"step": "composing_context"})}
yield {"event": "variant",    "data": json.dumps(variant_dict)}
yield {"event": "image",      "data": json.dumps({"variant_id": 1, "image_url": "..."})}
yield {"event": "video",      "data": json.dumps({"variant_id": 1, "video_url": "..."})}
yield {"event": "compliance", "data": json.dumps(compliance_report)}
yield {"event": "error",      "data": json.dumps({"message": "..."})}
yield {"event": "done",       "data": "complete"}
```

### 6.2 Frontend useStream Hook Behavior

```typescript
// Current implementation:
es.onmessage = (e) => {
  setEvents(prev => [...prev, { event: "message", data: e.data }]);
};
es.addEventListener("done", () => { es.close(); setIsStreaming(false); });
es.onerror = () => { es.close(); setIsStreaming(false); };
```

**Frontend fix needed:** Add event listeners for `variant`, `image`, `video`, `compliance`, `status` to handle them specifically instead of just collecting all messages.

### 6.3 Timeouts & Keep-Alive

- Send SSE comment (`:keep-alive\n\n`) every 15 seconds during long operations
- Image generation can take up to 60s per variant — send progress events
- EventSource auto-reconnects on error — backend must handle idempotently

---

## 7. Database Schema

### 7.1 Tables

```sql
CREATE TABLE sessions (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id       TEXT UNIQUE NOT NULL,       -- "insta_smartwheels_abc123"
    data             TEXT NOT NULL DEFAULT '{}',  -- JSON: all wizard step data
    current_step     INTEGER DEFAULT 1,
    human_approved   BOOLEAN DEFAULT FALSE,
    pipeline_state   TEXT DEFAULT 'idle',         -- idle|running|completed|failed
    created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE variants (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id       TEXT NOT NULL REFERENCES sessions(session_id),
    angle            TEXT NOT NULL,
    headline         TEXT NOT NULL,
    copy_text        TEXT NOT NULL,               -- "copy" is reserved in SQL
    cta              TEXT NOT NULL,
    target_segment   TEXT,
    imagery_style    TEXT,
    image_url        TEXT,
    video_url        TEXT,
    image_prompt     TEXT,
    score            REAL,
    is_recommended   BOOLEAN DEFAULT FALSE,
    compliance_status TEXT DEFAULT 'unchecked',    -- unchecked|passed|failed
    compliance_issues TEXT,                        -- JSON array of strings
    created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE calendar_posts (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id       TEXT NOT NULL REFERENCES sessions(session_id),
    variant_id       INTEGER REFERENCES variants(id),
    post_date        TEXT NOT NULL,                -- "2026-04-15"
    post_type        TEXT NOT NULL,                -- "post"|"reel"|"story"|"carousel"
    caption          TEXT,
    hashtags         TEXT,                         -- JSON array
    best_time        TEXT,                         -- "9:00 AM"
    image_url        TEXT,
    status           TEXT DEFAULT 'scheduled',     -- scheduled|posted|skipped
    created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 7.2 DB → Frontend Type Mapping

Backend DB column names differ from frontend TypeScript property names. The API response handler must transform:

**variants table → CampaignVariant:**

| DB Column | Frontend Property | Transform |
|-----------|------------------|-----------|
| `id` | `id` | Direct |
| `angle` | `angle` | Direct |
| `headline` | `headline` | Direct |
| `copy_text` | `copy` | Rename |
| `cta` | `cta` | Direct |
| `target_segment` | `targetSegment` | camelCase |
| `imagery_style` | `imageryStyle` | camelCase |
| `image_url` | `imageUrl` | camelCase |
| `score` | `score` | Direct |
| `is_recommended` | `recommended` | Rename + camelCase |

**calendar_posts table → CalendarPost:**

| DB Column | Frontend Property | Transform |
|-----------|------------------|-----------|
| `id` | `id` | Cast to string |
| `post_date` | `date` | Rename |
| `post_type` | `type` | Rename |
| `caption` | `caption` | Direct |
| `hashtags` | `hashtags` | JSON parse → string[] |
| `best_time` | `bestTime` | camelCase |
| `image_url` | `imageUrl` | camelCase |

---

## 8. Service Layer

### 8.1 Service Dependency Map

```
api/campaign.py (generate SSE)
  └── services/context_composer.py        ← pulls full session from DB
       └── db/queries.py                  ← get_session()
  └── services/copy_generator.py          ← GPT-4o text generation
       └── generators/instagram.py        ← prompt templates
       └── utils/llm.py                   ← Azure OpenAI client
  └── services/image_generator.py         ← FLUX 1.1 Pro
       └── generators/instagram.py        ← image prompt + format specs
       └── utils/image.py                 ← resize + logo overlay
       └── services/logo_extractor.py     ← logo location
  └── services/video_generator.py         ← Sora 2
  └── services/compliance_checker.py      ← validation rules
       └── generators/instagram.py        ← FORMAT_SPECS, limits

api/brand.py (upload)
  └── services/brand_parser.py            ← MIME detect + delegate
       └── parsers/pdf_parser.py
       └── parsers/docx_parser.py
       └── parsers/pptx_parser.py
       └── parsers/zip_parser.py
       └── parsers/image_parser.py
  └── services/logo_extractor.py
  └── services/insight_extractor.py       ← GPT-4o
       └── utils/llm.py

api/calendar.py
  └── services/calendar_builder.py

api/budget.py
  └── services/budget_estimator.py

api/engage.py
  └── services/engagement.py              ← GPT-4o
       └── utils/llm.py

api/chat.py
  └── utils/llm.py                        ← GPT-4o streaming
```

### 8.2 Key Service: context_composer.py

This is the central file that every LLM-calling service depends on. It assembles ALL user inputs into a single structured text block that becomes the system prompt.

```python
# Pseudo-code
async def compose_context(session_id: str) -> ContextBlock:
    session = await get_session(session_id)

    return ContextBlock(
        company=f"""
            Name: {session.business_profile.storeName}
            Industry: {session.business_profile.productCategory}
            Tagline: {session.brand_insights.tagline if brand_insights else ''}
            Website: {session.business_profile.websiteUrl}
            USPs: {session.brand_insights.USPs}
        """,
        audience=f"""
            Segments: {session.audience.segments}
            Primary: {session.audience.primarySegment}
            Age: {session.audience.ageRange}
            Location: {session.audience.geoTargeting}
        """,
        goals=f"""
            Type: {session.goals.goalType}
            Budget: ₹{session.goals.budget}
            Duration: {session.goals.durationDays} days
            Formats: {session.goals.formats}
        """,
        creative=f"""
            Style: {session.creative.imageStyle}
            Tone: {session.creative.toneOfVoice}
            Hashtags: {session.creative.seedHashtags}
            Variants: {session.creative.variantCount}
        """,
        brand_guidelines=f"""
            Colours: {session.brand_insights.brand_colours}
            Typography: {session.brand_insights.typography}
            Logo Placement: {session.business_profile.logoPlacement}
        """
    )
```

### 8.3 Key Service: generators/instagram.py

Contains Instagram-specific constants and prompt builders:

```python
FORMAT_SPECS = {
    "post":     {"width": 1080, "height": 1080},
    "story":    {"width": 1080, "height": 1920},
    "reel":     {"width": 1080, "height": 1920},
    "portrait": {"width": 1080, "height": 1350},
    "landscape":{"width": 1080, "height": 566},
}
CAPTION_LIMIT = 2200
HASHTAG_LIMIT = 30

def build_copy_prompt(context: ContextBlock, count: int, formats: list[str]) -> str:
    """Build GPT-4o prompt for generating copy variants."""
    ...

def build_image_prompt(variant: CopyVariant, brand: BrandInsights) -> str:
    """Build FLUX 1.1 Pro prompt for image generation."""
    ...
```

---

## 9. Error Handling

### 9.1 HTTP Error Strategy

| Scenario | Status | Response |
|----------|--------|----------|
| Invalid file type upload | 400 | `{ detail: "Unsupported file type. Allowed: pdf, docx, pptx, zip, jpg, png" }` |
| File too large | 413 | `{ detail: "File exceeds 50MB limit" }` |
| Session not found | 404 | `{ detail: "Session not found" }` |
| Step data validation fails | 422 | `{ detail: "Missing required field: goalType" }` |
| Steps incomplete for generate | 422 | `{ detail: "Steps 1, 3 are incomplete", missing: [1, 3] }` |
| GPT-4o API failure | 502 | `{ detail: "AI service temporarily unavailable" }` |
| FLUX API failure | 502 | `{ detail: "Image generation service unavailable" }` |
| Internal error | 500 | `{ detail: "Internal server error" }` |

### 9.2 SSE Error Events

During streaming operations, errors are sent as SSE events (not HTTP errors, since the connection is already open):

```python
yield {"event": "error", "data": json.dumps({
    "step": "generating_images",
    "message": "Image generation failed for variant 2. Retrying...",
    "retryable": True
})}
```

### 9.3 Retry Logic

- GPT-4o calls: retry up to 2 times with exponential backoff (1s, 3s)
- FLUX image generation: retry up to 1 time (images are expensive)
- Sora video generation: no retry (too expensive + slow), report error
- DB operations: no retry needed (SQLite is local)

### 9.4 Pipeline State Recovery

If generation fails mid-pipeline, the `pipeline_state` column tracks progress:

```
idle → running → completed | failed
```

On failure, `pipeline_state = "failed"` and partial results (e.g., copy variants already generated) are preserved. User can retry, and the pipeline resumes from the failed step rather than restarting.

---

## 10. Build Phases

### Phase A — Foundation (server + state persistence)

| # | Type | Task | Files |
|---|------|------|-------|
| A1 | Backend | FastAPI app skeleton, CORS, lifespan, health check | `main.py`, `config.py` |
| A2 | Backend | Database setup + tables + CRUD queries | `db/database.py`, `db/tables.py`, `db/queries.py` |
| A3 | Backend | Wizard routes: step save (upsert), state load (with JOIN), resume | `api/wizard.py`, `models/session.py` |
| A4 | Backend | Shared utilities: LLM client factory, Pillow helpers | `utils/llm.py`, `utils/image.py` |
| A5 | **Frontend fix** | Add `submitStep` call to SetupPage "Next" click | `pages/SetupPage.tsx` |

**Milestone:** All 4 wizard steps persist to SQLite. `GET /state/{id}` returns full AgentState. Session survives page refresh.

**Dependencies:** `fastapi`, `uvicorn`, `aiosqlite`, `pydantic`, `pydantic-settings`, `python-multipart`, `python-dotenv`

### Phase B — Brand Upload Pipeline

| # | Type | Task | Files |
|---|------|------|-------|
| B1 | Backend | Format-specific document parsers | `parsers/pdf_parser.py`, `parsers/docx_parser.py`, `parsers/pptx_parser.py`, `parsers/zip_parser.py`, `parsers/image_parser.py` |
| B2 | Backend | Brand parser (MIME detect + delegation) | `services/brand_parser.py` |
| B3 | Backend | Logo extractor (candidate filtering + scoring) | `services/logo_extractor.py` |
| B4 | Backend | Insight extractor (GPT-4o structured extraction) | `services/insight_extractor.py` |
| B5 | Backend | Brand upload route (orchestrates B1-B4) | `api/brand.py`, `models/brand.py` |
| B6 | **Frontend fix** | Add `session_id` to brand upload FormData | `lib/api.ts` (`brandApi.uploadDocument`) |

**Milestone:** User uploads PDF/DOCX/PPTX brand book → gets auto-extracted brand insights + logo.

**Dependencies:** `PyMuPDF`, `python-docx`, `python-pptx`, `Pillow`, `openai`

### Phase C — Campaign Generation Pipeline (Core)

| # | Type | Task | Files |
|---|------|------|-------|
| C1 | Backend | Instagram prompt templates + format specs | `generators/instagram.py` |
| C2 | Backend | Context composer (session → structured prompt) | `services/context_composer.py` |
| C3 | Backend | Copy generator (GPT-4o → variants) | `services/copy_generator.py` |
| C4 | Backend | Image generator (FLUX 1.1 Pro + logo overlay) | `services/image_generator.py` |
| C5 | Backend | Compliance checker (dimensions, limits, policy) | `services/compliance_checker.py` |
| C6 | Backend | Campaign routes (generate SSE + regenerate + preflight) | `api/campaign.py`, `api/compliance.py`, `models/campaign.py` |
| C7 | Backend | Variants route (PATCH for edit) | `api/variants.py` |
| C8 | **Frontend fix** | Rewire ReviewPage: replace fake progress with `campaignApi.generateStream()` + `useStream` | `pages/ReviewPage.tsx` |
| C9 | **Frontend fix** | Rewire VariantsPage: load via `useAgentState` on mount, add edit/regenerate/compliance | `pages/VariantsPage.tsx` |
| C10 | **Frontend fix** | Add `variantsApi.update()`, `campaignApi.regenerate()`, `complianceApi.check()` to api.ts | `lib/api.ts` |

**Milestone:** User clicks "Generate" → real AI copy + images stream in via SSE → variants are editable.

**Dependencies:** `sse-starlette`, `httpx`, `openai`

### Phase D — Calendar + Budget (MVP Complete)

| # | Type | Task | Files |
|---|------|------|-------|
| D1 | Backend | Calendar builder (30-day distribution logic) | `services/calendar_builder.py` |
| D2 | Backend | Calendar routes (generate + PATCH) | `api/calendar.py`, `models/calendar.py` |
| D3 | Backend | Budget estimator (CPM/reach math) | `services/budget_estimator.py` |
| D4 | Backend | Budget route | `api/budget.py` |
| D5 | **Frontend fix** | Wire CalendarPage: `calendarApi.generate()` on mount + `calendarApi.updatePost()` for edits + `useAgentState` for refresh | `pages/CalendarPage.tsx` |
| D6 | **Frontend fix** | Add "Approve Calendar" button that calls `wizardApi.resume(sid, true)` before navigating to SchedulePage | `pages/CalendarPage.tsx` |
| D7 | **Frontend fix** | Wire GoalsPage to `budgetApi.estimate()` for live reach/CPM display | `pages/GoalsPage.tsx` |

**Milestone:** 30-day calendar generated from real AI variants. Calendar approval gate works. Budget estimates are live. **MVP functionally complete.**

### Phase E — Video + Execution

| # | Type | Task | Files |
|---|------|------|-------|
| E1 | Backend | Video generator (Sora 2 integration) | `services/video_generator.py` |
| E2 | Backend | Execution route (export CSV + iCal via SSE) | `api/execution.py` |
| E3 | **Frontend fix** | Wire SchedulePage to `executionApi.runStream()` for exports | `pages/SchedulePage.tsx` |

**Milestone:** Reels generated via Sora 2. Calendar exportable as CSV/iCal.

### Phase F — Engagement + Chat

| # | Type | Task | Files |
|---|------|------|-------|
| F1 | Backend | Engagement service (GPT-4o reply suggestions) | `services/engagement.py` |
| F2 | Backend | Engagement routes (get comments + send reply) | `api/engage.py`, `models/engagement.py` |
| F3 | Backend | Chat route (GPT-4o streaming conversation) | `api/chat.py` |
| F4 | **Frontend fix** | Wire EngagePage to `engageApi.getComments()` + `sendReply()` | `pages/EngagePage.tsx` |

**Milestone:** AI-generated reply suggestions for comments. Conversational chat sidebar.

### Phase Summary

| Phase | Backend Tasks | Frontend Fixes | Key Deliverable |
|-------|--------------|----------------|-----------------|
| A | 4 | 1 | Wizard state persists in DB |
| B | 5 | 1 | Brand upload pipeline works end-to-end |
| C | 7 | 3 | Real AI generation via SSE + variant editing |
| D | 4 | 3 | Calendar + budget live — **MVP complete** |
| E | 2 | 1 | Video gen + export |
| F | 3 | 1 | Engagement + chat |
| **Total** | **25** | **10** | |

---

## 11. Frontend Fixes Required

Summary of all frontend changes needed, organized by file:

### 11.1 api.ts Changes

```typescript
// ADD: session_id to brand upload
uploadDocument: async (file: File, sessionId: string) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("session_id", sessionId);
  ...
}

// ADD: new API groups
export const variantsApi = {
  update: (id: number, data: Partial<CampaignVariant>) =>
    request(`/api/variants/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
};

export const complianceApi = {
  check: (variants: CampaignVariant[]) =>
    request("/api/compliance/check", { method: "POST", body: JSON.stringify({ variants }) }),
};

// ADD: regenerate to campaignApi
campaignApi.regenerate = (sessionId: string, variantId: number, instructions: string) =>
  request("/api/campaign/regenerate", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId, variant_id: variantId, instructions }),
  });
```

### 11.2 Per-Page Fixes

| Page | Fix |
|------|-----|
| **SetupPage** | Add `wizardApi.submitStep(sid, 1, data)` to "Next" click handler |
| **SetupPage** | Pass `session_id` to `brandApi.uploadDocument(file, sessionId)` |
| **ReviewPage** | Replace fake `GEN_STEPS` progress with `campaignApi.generateStream(sid)` + `useStream` hook |
| **VariantsPage** | Add `useAgentState(sessionId)` on mount to load variants from backend |
| **VariantsPage** | Wire "Request Changes" → `campaignApi.regenerate()`, edit → `variantsApi.update()` |
| **CalendarPage** | Call `calendarApi.generate(sid)` on mount |
| **CalendarPage** | Wire post edits to `calendarApi.updatePost(postId, data)` |
| **CalendarPage** | Add "Approve Calendar" button → `wizardApi.resume(sid, true)` before navigate |
| **GoalsPage** | Add `budgetApi.estimate()` call for live budget breakdown display |
| **SchedulePage** | Wire to `executionApi.runStream(sid)` for export generation |
| **EngagePage** | Wire to `engageApi.getComments(sid)` on mount + `engageApi.sendReply()` |

---

## 12. Environment Configuration

From `.env` — all keys the backend needs:

```env
# Azure OpenAI (text generation — GPT-4o)
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_ENDPOINT=https://medisummarize-openai.cognitiveservices.azure.com
AZURE_OPENAI_DEPLOYMENT=gpt-4o
AZURE_API_VERSION=2024-02-15-preview

# FLUX 1.1 Pro (image generation — Azure AI Foundry)
FLUX_API_ENDPOINT=https://rohit-mhm7xmsp-swedencentral.services.ai.azure.com/openai/deployments/FLUX-1.1-pro/images/generations?api-version=2025-04-01-preview
FLUX_API_KEY=...
FLUX_MODEL=FLUX-1.1-pro

# Sora 2 (video generation — Azure Cognitive Services)
SORA_API_ENDPOINT=https://rohit-mhm7xmsp-swedencentral.cognitiveservices.azure.com
SORA_API_KEY=...
SORA_DEPLOYMENT_NAME=sora-2

# Database
DATABASE_URL=sqlite:///retail_marketing.db

# Application
DEBUG=true
LOG_LEVEL=INFO
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

`config.py` loads these via `pydantic-settings`:

```python
class Settings(BaseSettings):
    azure_openai_api_key: str
    azure_openai_endpoint: str
    azure_openai_deployment: str = "gpt-4o"
    azure_api_version: str = "2024-02-15-preview"
    flux_api_endpoint: str
    flux_api_key: str
    flux_model: str = "FLUX-1.1-pro"
    sora_api_endpoint: str
    sora_api_key: str
    sora_deployment_name: str = "sora-2"
    database_url: str = "sqlite:///retail_marketing.db"
    debug: bool = False
    log_level: str = "INFO"
    cors_origins: str = "http://localhost:5173"

    class Config:
        env_file = ".env"
```

---

## 13. BRD Traceability

Every BRD requirement mapped to its backend implementation:

| BRD ID | Requirement | Backend Implementation |
|--------|------------|----------------------|
| BP-01 | Business Size Selection | `POST /wizard/step` (step 1) → `sessions.data.businessSize` |
| BP-02 | Location Targeting | `POST /wizard/step` (step 1) → `sessions.data.targetMarketLocation` |
| BP-03 | Online Store Classification | `POST /wizard/step` (step 1) → `sessions.data.storeType` |
| BP-04 | Company & Product Info | `POST /wizard/step` (step 1) → `sessions.data` (storeName, websiteUrl, productCategory) |
| BP-05 | Brand Guidelines Input | `POST /brand/upload` → `insight_extractor` + `logo_extractor` |
| AU-01 | Audience Segment Selection | `POST /wizard/step` (step 2) → `sessions.data.segments` |
| AU-02 | Audience Description | `POST /wizard/step` (step 2) → `sessions.data.description` |
| AU-03 | Geographic Targeting | `POST /wizard/step` (step 2) → `sessions.data.geoTargeting` |
| AU-04 | Primary vs Secondary | `POST /wizard/step` (step 2) → `sessions.data.primarySegment` + `secondarySegment` |
| CG-01 | Campaign Goal Selection | `POST /wizard/step` (step 3) → `sessions.data.goalType` |
| CG-02 | Time Frame | `POST /wizard/step` (step 3) → `sessions.data.durationDays` |
| CG-03 | Budget Input | `POST /wizard/step` (step 3) → `sessions.data.budget` |
| CG-04 | Channel Selection | MVP: Instagram hardcoded in `generators/instagram.py` |
| CG-05 | Campaign Type | `POST /wizard/step` (step 3) → `sessions.data.formats` (post/reel/story) |
| CV-01 | Multi-Variant Generation | `GET /campaign/generate` SSE → `copy_generator` (variant_count from step 4) |
| CV-02 | Recommended Variant | `variants.is_recommended` set by copy_generator scoring |
| CV-03 | Edit & Regenerate | `PATCH /variants/{id}` + `POST /campaign/regenerate` |
| CV-04 | Campaign Continuity | `context_composer.py` → assembles ALL steps into single prompt |
| CV-05 | Hashtag Suggestions | `copy_generator` includes hashtags in variant output |
| IG-01 | Image Style Selection | `POST /wizard/step` (step 4) → `sessions.data.imageStyle` → image_generator prompt |
| IG-02 | Content Type Selection | `POST /wizard/step` (step 4) → `sessions.data.contentType` → format routing |
| IG-03 | Brand-Guided Generation | `image_generator` uses brand_colours + logo_placement from insights |
| IG-04 | Image Feedback | `POST /campaign/regenerate` with user instructions |
| IG-05 | Instagram Size Compliance | `compliance_checker` validates against `FORMAT_SPECS` |
| IG-06 | Copyright Check | `compliance_checker` + GPT-4o policy validation |
| IG-07 | Reference URL Input | `sessions.data.instagramUrl` available in context_composer |
| CC-01 | 30-Day Calendar | `POST /calendar/generate` → `calendar_builder` |
| CC-02 | Calendar Editing | `PATCH /calendar/{postId}` |
| CC-03 | Scheduling Integration | `GET /execution/run` SSE → CSV + iCal export for Buffer/Hootsuite |
| CC-04 | Budget Pause Trigger | `budget_estimator` flags if budget exhausted before 30 days |
| CC-05 | Advance Planning | Calendar builder creates 30-day-ahead schedule from start_date |
| AW-01 | Campaign Approval | `POST /wizard/resume` (ReviewPage + CalendarPage approval gates) |
| AW-02 | Sequential Navigation | Frontend wizard step system + backend `current_step` tracking |
| AW-03 | State Persistence | `sessions` table + `GET /wizard/state/{id}` |
| EM-01 | Auto-Reply Suggestions | `GET /engage/comments` → `engagement.py` + GPT-4o |
| EM-02 | Human Escalation Rules | `engagement.py` sentiment analysis → `needsEscalation` flag |
| EM-03 | Brand Tone Training | `context_composer` includes tone_of_voice in reply prompt |

### BRD Gaps (Table 12) Coverage

| Gap | Issue | Fix |
|-----|-------|-----|
| G-01 | Context not carried to image gen | `context_composer.py` assembles ALL steps; image_generator receives full context |
| G-02 | No channel filter | MVP: Instagram-only. `generators/` folder ready for multi-channel |
| G-03 | Default model without brand guidelines | `image_generator` always uses brand_insights when available; fallback prompt without |
| G-04 | No content type selector | CreativePage has `contentType` field → passed to generator |
| G-05 | Image size validation not enforced | `compliance_checker.py` validates against `FORMAT_SPECS` |
| G-06 | No multi-step navigation | Frontend wizard exists; backend tracks `current_step` |
| G-07 | Hard-coded policy rules | `generators/instagram.py` centralizes rules; future: fetch from API |
| G-08 | No 30-day calendar | `calendar_builder.py` + `POST /calendar/generate` |
| G-09 | Video generation timing out | `video_generator.py` with proper timeout handling + SSE error events |

### BRD Phase Alignment

| BRD Phase | Scope | Our Build Phases |
|-----------|-------|-----------------|
| Phase 1 — MVP | Instagram: onboarding → calendar → scheduling | **A + B + C + D + E** |
| Phase 2 | Meta Ads + engagement/auto-reply | **F** + future meta_ads generator |
| Phase 3 | Google Ads (Search, Display, PMax) | Future `generators/google_ads.py` |
| Phase 4 | Amazon Ads, Email, Influencer, Multi-user | Future generators + services |

---

## requirements.txt

```
fastapi>=0.115.0
uvicorn[standard]>=0.30.0
aiosqlite>=0.20.0
pydantic>=2.0
pydantic-settings>=2.0
python-multipart>=0.0.9
python-dotenv>=1.0
sse-starlette>=2.0
openai>=1.30.0
httpx>=0.27.0
Pillow>=10.0
PyMuPDF>=1.24.0
python-docx>=1.1.0
python-pptx>=0.6.23
```

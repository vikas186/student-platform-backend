# University Scraping — Full Flow

This document describes how the multi-entity scraping system works end-to-end: from triggering a job in the admin UI (or cron) through Playwright scraping, AI enrichment, and PostgreSQL persistence.

**Module root:** `src/modules/scrape/`  
**Workers:** `workers/scraper.worker.ts`, `workers/cleaner.worker.ts`

---

## High-level architecture

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────────────┐
│  Admin UI / API │────▶│  PostgreSQL  │◀────│  Enricher worker    │
│  POST /scrape/  │     │  scrape_jobs │     │  (cleaner.worker)   │
│  start          │     │  raw batches │     │  AI + upsert        │
└────────┬────────┘     └──────▲───────┘     └──────────▲──────────┘
         │                     │                          │
         │ publish             │ save raw                 │ consume
         ▼                     │                          │
┌─────────────────┐     ┌─────┴────────┐     ┌───────────┴─────────┐
│    RabbitMQ     │────▶│ Scraper      │────▶│  cleaning queue     │
│  scraping queue │     │ worker       │     │                     │
└─────────────────┘     │ (Playwright) │     └─────────────────────┘
                        └──────────────┘
```

```mermaid
flowchart TB
  subgraph entry [Entry points]
    API["POST /api/v1/scrape/start"]
    CRON["Cron scheduler"]
  end

  subgraph api [API layer]
    CTRL["scrape.controller"]
    SVC["scrape.service"]
    START["startScrapeJob()"]
  end

  subgraph mq [RabbitMQ]
    SQ["course_scraping_queue"]
    CQ["course_cleaning_queue"]
    SRQ["scraping retry / DLQ"]
    CRQ["cleaning retry / DLQ"]
  end

  subgraph scrape_worker [Scraper worker]
    PS["processScrapeJob()"]
    GW["scrapeWebsite()"]
    PL["runPipelineScrape()"]
    PW["Playwright"]
  end

  subgraph clean_worker [Cleaner worker]
    PC["processCleaningJob()"]
    EP["processEnrichmentPipeline()"]
    AI["OpenAI enrichment"]
    UP["upsertEnrichedBatch()"]
  end

  subgraph storage [Storage]
    JOBS[(scrape_jobs)]
    BATCH[(raw_scrape_batches)]
    ENT[(scraped_courses / universities / scholarships)]
    META[(scrape_ai_meta)]
    RAW[(raw/*.json)]
  end

  API --> CTRL --> SVC --> START --> JOBS
  CRON --> START
  START --> SQ
  SQ --> PS --> GW --> PL --> PW
  PS --> BATCH
  PS --> RAW
  PS --> CQ
  CQ --> PC --> EP --> AI --> UP
  UP --> ENT
  UP --> META
  PC --> JOBS
```

---

## How to run locally

### One command (recommended)

```bash
npm run dev
```

Starts:

1. RabbitMQ (Docker)
2. API server (`:4001`)
3. Scraper worker (Playwright)
4. Enricher/cleaner worker (AI + DB upsert)

### Stop everything

```bash
npm run dev:stop              # stop processes + RabbitMQ
npm run dev:stop -- --jobs      # also cancel in-progress scrape jobs
```

### Other useful commands

| Command | Purpose |
|---------|---------|
| `npm run migrate:scrape` | Apply scrape SQL migrations (007–009) |
| `npm run scrape:cancel` | Mark all active jobs as `failed` |
| `npm run test:scrape:idp` | Smoke-test IDP scraper (no queue/DB) |
| `npm run test:scrape:aecc` | Smoke-test AECC scraper (no queue/DB) |
| `npm run seed:admin` | Create dev admin (`admin@example.com` / `SecurePass1`) |

---

## Entry points

### 1. Admin API

**Base path:** `/api/v1`  
**Auth:** JWT admin + permission `university_scraping`

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/scrape/start` | Start a new scrape job |
| `GET` | `/scrape/presets` | List built-in presets (IDP, AECC, partner consultancies) |
| `GET` | `/scrape/jobs` | List jobs with stats |
| `GET` | `/scrape/jobs/:id` | Job detail |
| `DELETE` | `/scrape/jobs/:id` | Delete job (+ related AI meta) |
| `GET` | `/courses` | List cleaned courses |
| `GET` | `/universities` | List cleaned universities |
| `GET` | `/scholarships` | List cleaned scholarships |
| `GET` | `/fees` | List fee records |

**Start request body:**

```json
{ "source": "IDP" }
```

or

```json
{ "source": "AECC" }
```

or custom URL:

```json
{
  "url": "https://example.com/courses",
  "name": "Example Uni",
  "seeds": ["https://example.com/", "https://example.com/courses"]
}
```

**Response:** `202 Accepted` with `{ jobId }`.

**Key files:**

- `src/modules/scrape/scrape.routes.ts`
- `src/modules/scrape/scrape.controller.ts`
- `src/modules/scrape/scrape.service.ts`
- `src/modules/scrape/scrape.processor.ts` → `startScrapeJob()`

### 2. Cron scheduler

**File:** `src/scheduler/scrape.cron.ts`  
**Registered in:** `server.ts` on boot.

| Env var | Default | Meaning |
|---------|---------|---------|
| `CRON_SCRAPE_ENABLED` | off | Must be `true` to enable |
| `CRON_SCRAPE_SCHEDULE` | `0 2 * * *` | Daily at 2 AM |
| `CRON_SCRAPE_SOURCES` | `IDP,AECC` | Presets to scrape |

Calls the same `startScrapeJob(target, 'cron')` as the manual API.

### 3. Direct scripts

- `scripts/test-scrape-idp.ts` / `scripts/test-scrape-aecc.ts` — run Playwright pipeline only
- `scripts/retry-cleaning.ts` — re-run enrichment for a failed job
- `scripts/check-scrape-status.ts` — inspect job/batch/course counts

---

## Built-in presets

**File:** `src/modules/scrape/config/scrape-sources.ts`

| Preset | Base URL | Seed URLs |
|--------|----------|-----------|
| **IDP** | `https://www.idp.com/india/find-a-course/?lang=en` | JSON-LD course listings (`find-a-course`) |
| **AECC** | `https://search.aeccglobal.com` | `/courses/all/all/{destination}` for each study country |
| **STUDIES_OVERSEAS** | `https://www.studies-overseas.com/` | Homepage + link discovery |
| **EDWISE** | `https://www.edwiseinternational.com/` | Homepage + link discovery |
| **CHOPRAS** | `https://www.thechopras.com/` | Homepage + link discovery |
| **GLOBAL_DEGREES** | `https://globaldegrees.in/` | Homepage + link discovery |
| **GEEBEE** | `https://www.geebeeworld.com/` | Homepage + link discovery |
| **EDVOY** | `https://edvoy.com/` | Homepage + link discovery |

Custom URLs use the hostname as the `source` label (see `scrape-target.util.ts` → `resolveScrapeTarget()`).

### AECC preset (`search.aeccglobal.com`)

AECC course data lives on a separate search SPA, **not** the marketing site (`aeccglobal.com/in`). The preset targets the search app directly.

**Why not global `/courses` alone:** that feed is popularity-sorted (mostly US/Australia on early pages). The preset seeds **one listing per destination** (`/courses/all/all/australia`, `…/canada`, `…/united-kingdom`, etc.) so every AECC study country is crawled. Override destinations with `SCRAPE_AECC_DESTINATIONS`.

**Why SSR HTML, not XHR:** Playwright intercepts JSON responses, but the live course list API is not exposed as a capturable XHR on listing pages (analytics/widgets are captured instead). Real course and scholarship rows are rendered server-side in HTML tiles and parsed after page load.

**URL classification** (`classifyPageForPipeline()` in `pipeline.scraper.ts` — runs before generic heuristics):

| URL pattern | Page type |
|-------------|-----------|
| `search.aeccglobal.com/courses` | `course_listing` |
| `search.aeccglobal.com/courses/all/...` | `course_listing` |
| `search.aeccglobal.com/course/:slug` or `/courses/:slug` | `course` |
| `search.aeccglobal.com/universities/:slug` | `university` |
| `search.aeccglobal.com/scholarship` or `/scholarship/:slug` | `scholarship` |
| `aeccglobal.com/in` (marketing homepage) | `reject` |

**Extraction routing:**

| Page type | Extractor |
|-----------|-----------|
| `course` / `course_listing` | `extractAECCCourses()` — API JSON (if present) + SSR `.sr-tile` HTML |
| `scholarship` | `extractAECCScholarships()` — API JSON (if present) + SSR `.scholar-tile` HTML |

Each extracted row gets a `pageText` field (course name, university, country, level, duration, fees, etc.) for the AI enrichment pipeline.

**Pagination:** For each destination seed, the pipeline reads total count from HTML meta and queues `?page=2`, `?page=3`, … up to `SCRAPE_AECC_MAX_PAGES` **per destination** (default 80). Queue budget ≈ destinations × max pages.

**robots.txt:** `search.aeccglobal.com` is allowed when `source === 'AECC'` (`robots.util.ts`). The marketing domain may still be blocked.

**Smoke test:**

```bash
npm run test:scrape:aecc
# Optional: limit pagination during local testing
SCRAPE_AECC_MAX_PAGES=3 npm run test:scrape:aecc
```

---

## RabbitMQ queues

**File:** `src/modules/scrape/queues/scrape.queue.ts`  
**Constants:** `src/modules/scrape/config/scrape.constants.ts`

| Queue | Purpose |
|-------|---------|
| `course_scraping_queue` | Primary scrape jobs |
| `course_scraping_retry_queue` | Scrape retries (TTL → re-deliver) |
| `course_scraping_dead_letter_queue` | Exhausted scrape retries |
| `course_cleaning_queue` | Primary cleaning/enrichment jobs |
| `course_cleaning_retry_queue` | Cleaning retries |
| `course_cleaning_dead_letter_queue` | Exhausted cleaning retries |

**Message shapes:**

```typescript
// Scrape
{ jobId: string; retryCount?: number }

// Cleaning
{ jobId: string; rawBatchId: string; retryCount?: number }
```

**Publish helpers:** `publishScrapeJob`, `publishCleaningJob`, `publishScrapeRetryJob`, `publishCleaningRetryJob`, plus dead-letter publishers.

The API server does **not** consume queues — workers must be running (`npm run dev` or separate worker processes).

---

## Workers

### Scraper worker — `workers/scraper.worker.ts`

1. Load env from `config/.env.{NODE_ENV}`
2. `connectRabbitMqWithRetry()` (up to 20 attempts)
3. `recoverStaleScrapeJobs()` — re-queue jobs stuck after a crash/restart
4. Consume `course_scraping_queue` + retry queue
5. For each message → `processScrapeJob(payload)`
6. On shutdown: close Playwright browser + RabbitMQ connection

### Cleaner / enricher worker — `workers/cleaner.worker.ts`

Same pattern, but:

1. `recoverStaleCleaningJobs()`
2. Consume `course_cleaning_queue` + retry queue
3. For each message → `processCleaningJob(payload)`

> `npm run worker:enricher` is an alias for the cleaner worker — enrichment runs inside the cleaning phase.

---

## Job statuses

### Scrape job (`scrape_jobs.status`)

```
pending → running → scraping → pending_cleaning → cleaning → completed
                                                          └→ failed
```

| Status | When set |
|--------|----------|
| `pending` | Job row created; or scrape retry pending |
| `running` | Message published to scrape queue |
| `scraping` | Playwright crawl in progress |
| `pending_cleaning` | Raw batch saved; waiting for enricher |
| `cleaning` | Enrichment pipeline running |
| `completed` | Cleaning finished with at least one entity or rejected page |
| `failed` | Max retries exceeded, zero entities, cancelled, or fatal error |

### Raw batch (`raw_scrape_batches.status`)

```
pending_cleaning → cleaning → cleaned
                           └→ failed
```

---

## Step-by-step flow

### Phase A — API enqueue

1. Admin calls `POST /api/v1/scrape/start` with `{ source: "AECC" }`.
2. `createScrapeJob()` → `resolveScrapeTarget()` builds target config (URL, seeds, page limits).
3. `startScrapeJob(target, 'manual')`:
   - Checks no other active job exists for the same `targetUrl`.
   - Creates `scrape_jobs` row (`status: pending`).
   - Publishes `{ jobId, retryCount: 0 }` to `course_scraping_queue`.
   - Updates job to `running`.
4. Returns `202` with `{ jobId }`.

### Phase B — Scraper worker (Playwright)

5. Scraper worker picks up the message → `processScrapeJob({ jobId })`.
6. Loads job from DB; builds source config via `toSourceConfig()`.
7. Sets job status to `scraping`.
8. Runs **`scrapeWebsite(config)`** → **`runPipelineScrape()`**:

   **Per page:**

   - Check `robots.txt` (`robots.util.ts`; AECC search domain has a source-specific override)
   - Rate limit: `SCRAPE_RATE_LIMIT_MS` + random jitter
   - **`capturePageWithPlaywright()`** — register XHR/fetch listeners **before** `page.goto()`, wait for `networkidle`, scroll to bottom (+ 2s for lazy load), return `{ html, apiResponses, … }`
   - Save debug artifacts (optional): `debug/screenshots/`, `debug/html/`
   - **`classifyPageForPipeline()`** — AECC URL rules first, then generic **`classifyPage()`** heuristics
   - Route to entity extractor:
     - **AECC** courses → `aecc/aecc-course.extractor.ts` (`extractAECCCourses`)
     - **AECC** scholarships → `aecc/aecc-scholarship.extractor.ts` (`extractAECCScholarships`)
     - Generic courses → `course.scraper` / `course.extractor`
     - Universities → `university.scraper`
     - Generic scholarships → `scholarship.scraper`
     - Fees → `fee.extractor`
   - **AECC** skips link discovery from the marketing homepage; uses preset seeds + auto-generated course pagination URLs
   - Dedupe by type + URL + name; attach `pageText` (up to 15k chars) for AI
   - Update `job.stats` live (pages, counts, current URL)

9. **`saveRawScrapeJson()`** writes a snapshot to `raw/{source}-{timestamp}.json`.
10. **`RawScrapeBatch.create()`** — stores all raw entities as JSONB in PostgreSQL.
11. Job → `pending_cleaning`; stats updated with scrape counts.
12. **`publishCleaningJob({ jobId, rawBatchId, retryCount: 0 })`** → cleaning queue.
13. Playwright browser closed in `finally`.

### Phase C — Cleaner worker (validation + AI + persist)

14. Cleaner worker picks up message → `processCleaningJob({ jobId, rawBatchId })`.
15. Job → `cleaning`; batch → `cleaning`.
16. **`processEnrichmentPipeline()`** runs:

    **Validate raw data**

    - `validateRawBatch()` — Zod schemas (`schemas/scrape.schemas.ts`)
    - Invalid rows counted; valid courses/universities/scholarships proceed

    **Per entity (chunked by `SCRAPE_RAW_CHUNK_SIZE`, default 25):**

    1. **Clean** — normalize fields, compute quality score:
       - Courses: `cleanCourseData()` + `calculateCourseQuality()`
       - ≥70 → `high_quality`, 40–69 → `needs_review`, &lt;40 → `rejected`
    2. **Enrich** (if `SCRAPE_AI_ENRICHMENT` enabled + `OPENAI_API_KEY` set):
       - `enrichEntity()` runs **3 parallel OpenAI calls**:
         - **Categorizer** — page type, subject/career tags, IELTS hints
         - **Parser** — structured field extraction from page text
         - **Summarizer** — short AI summary
       - Results merged via `mergeRecord()` and validated with enriched Zod schemas
    3. **Collect** enriched entities (rejected cleaning status skipped later)

    **Persist**

    - `upsertEnrichedBatch()` in a single DB transaction:
      - `upsertCourse()` / `upsertUniversity()` / `upsertScholarship()`
      - `upsertAiMeta()` → `scrape_ai_meta` (tags, summary, parser output)

17. Batch → `cleaned`.
18. Job → `completed` (or `failed` if zero entities and zero rejected pages).
19. Final stats written: `validCount`, `needsReviewCount`, `persisted`, etc.

---

## Playwright pipeline details

**Call chain:**

```
scrapeWebsite()          → generic.scraper.ts
  └─ runPipelineScrape() → pipeline.scraper.ts
       └─ capturePageWithPlaywright() → playwright.util.ts
```

**Playwright behavior (`playwright.util.ts`):**

- Singleton Chromium browser instance
- Configurable timeout (`SCRAPE_TIMEOUT_MS`, default 180s)
- Per-page retries (`SCRAPE_PAGE_RETRIES`, default 3)
- User-agent rotation from a pool
- XHR/fetch response listeners registered **before** navigation
- Network idle wait → cookie banner dismiss → scroll to bottom → 2s wait (lazy-loaded tiles)
- Returns page HTML (`html`) alongside `mainText`, `links`, and captured `apiResponses`
- Generic sites: captures course-related API JSON (`api-course-extract.util.ts`)
- **AECC:** additionally captures JSON from URLs containing `/courses`, `/universities`, `/scholarship`, `/programs`, or `search.aeccglobal.com/api/`; waits for `a.sr-tile` / `.search_result_content`; logs `AECC XHR captured` with `capturedCount`

**Page limits (env overrides per preset):**

| Preset | Max pages | Max detail pages |
|--------|-----------|------------------|
| IDP | `SCRAPE_IDP_MAX_PAGES` (25) | `SCRAPE_IDP_MAX_DETAIL` (15) |
| AECC | `SCRAPE_AECC_MAX_PAGES` (80 per destination) | `SCRAPE_AECC_MAX_DETAIL` (15) |
| Custom | `SCRAPE_CUSTOM_MAX_PAGES` (25) | `SCRAPE_CUSTOM_MAX_DETAIL` (15) |

---

## AI enrichment

**Gate:** `SCRAPE_AI_ENRICHMENT !== 'false'` and `OPENAI_API_KEY` present.

**Files:**

- `enrichment/enrichment.service.ts` — orchestrates per-entity enrichment
- `enrichment/categorizer.service.ts` — page classification + tags
- `enrichment/html-parser.service.ts` — structured field parsing
- `enrichment/summarizer.service.ts` — summaries
- `enrichment/openai.client.ts` — OpenAI client + model config

**Model:** `SCRAPE_OPENAI_MODEL` (default `gpt-4o-mini`) or `OPENAI_SCRAPE_MODEL` from env.

**Schema coercion:** OpenAI often returns numbers or arrays for string fields (e.g. `ieltsScore`, `country`, `intake`). Zod preprocessors in `schemas/scrape.schemas.ts` normalize these before validation.

If AI enrichment fails for one entity, the entity is still saved with heuristic cleaning data (empty AI fields); the job does not fail entirely unless parsing/upsert throws.

---

## Database tables

| Table | Model | Purpose |
|-------|-------|---------|
| `scrape_jobs` | `ScrapeJob` | Job metadata, status, stats |
| `raw_scrape_batches` | `RawScrapeBatch` | Raw JSONB payload per scrape run |
| `scraped_courses` | `ScrapedCourse` | Cleaned + enriched courses |
| `scrape_universities` | `ScrapeUniversity` | Cleaned + enriched universities |
| `scrape_scholarships` | `ScrapeScholarship` | Cleaned + enriched scholarships |
| `scrape_fees` | `ScrapeFee` | Fee records (table exists; enricher path not wired yet) |
| `scrape_rejected_pages` | `ScrapeRejectedPage` | Rejected pages (stored in batch JSONB; table not populated by current enricher) |
| `scrape_ai_meta` | `ScrapeAiMeta` | AI categorizer/parser output per entity |

**Migrations:** `migrations/005` through `migrations/009`  
**Apply:** `npm run migrate:scrape` (runs 007, 008, 009)

**Upsert keys (`entity-upsert.service.ts`):**

| Entity | Match key |
|--------|-----------|
| Course | `(source, courseUrl)` or fallback `(source, courseName, universityName)` |
| University | `(source, universityName, country)` |
| Scholarship | `(source, scholarshipName, universityName, country)` |

**Job deletion:** `deleteScrapeJob()` removes related `scrape_ai_meta` rows first, then deletes the job (courses/universities/scholarships cascade via FK).

---

## Failure handling & recovery

### Retries

| Phase | Max retries | Env var |
|-------|-------------|---------|
| Scrape | 3 (default) | `SCRAPE_MAX_RETRIES` |
| Cleaning | 3 (default) | `CLEAN_MAX_RETRIES` |

On failure: publish to retry queue → worker retries → after max attempts → dead-letter queue + job `failed`.

### Stale job recovery

**File:** `src/modules/scrape/recover-stale-jobs.ts`  
**Cutoff:** `SCRAPE_STALE_JOB_MS` (default 120 seconds)

Runs on **worker boot** (not API boot):

- **`recoverStaleScrapeJobs()`** — jobs stuck in `pending|running|scraping` → re-publish to scrape queue
- **`recoverStaleCleaningJobs()`** — jobs stuck in `pending_cleaning|cleaning` → re-publish cleaning message

### Cancel active jobs

```bash
npm run scrape:cancel
```

Marks all jobs in active statuses as `failed` with message `"Cancelled by admin"`.

---

## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `RABBITMQ_URL` | `amqp://guest:guest@localhost:5672` | RabbitMQ connection |
| `RABBITMQ_HEARTBEAT` | `3600` | Keep connection alive during long scrapes |
| `OPENAI_API_KEY` | — | Required for AI enrichment |
| `SCRAPE_AI_ENRICHMENT` | enabled | Set `false` to skip AI |
| `SCRAPE_OPENAI_MODEL` | `gpt-4o-mini` | OpenAI model for enrichment |
| `SCRAPE_MAX_RETRIES` | `3` | Scrape retry cap |
| `CLEAN_MAX_RETRIES` | `3` | Cleaning retry cap |
| `SCRAPE_STALE_JOB_MS` | `120000` | Stale job recovery threshold |
| `SCRAPE_TIMEOUT_MS` | `180000` | Playwright page / navigation timeout |
| `SCRAPE_RATE_LIMIT_MS` | `2000` | Delay between pages |
| `SCRAPE_MAX_PAGES` | `25` | Generic page limit |
| `SCRAPE_MAX_DETAIL_PAGES` | `15` | Detail page cap |
| `SCRAPE_AECC_MAX_PAGES` | `80` | AECC listing pages **per destination** |
| `SCRAPE_AECC_DESTINATIONS` | (built-in list) | Comma-separated AECC destination slugs |
| `SCRAPE_AECC_MAX_DETAIL` | `15` | AECC detail page cap |
| `SCRAPE_IDP_MAX_PAGES` | `25` | IDP page cap |
| `SCRAPE_IDP_MAX_DETAIL` | `15` | IDP detail page cap |
| `SCRAPE_PAGE_RETRIES` | `3` | Per-page Playwright retries |
| `SCRAPE_RAW_CHUNK_SIZE` | `25` | Enrichment batch size |
| `CRON_SCRAPE_ENABLED` | off | Enable scheduled scrapes |
| `CRON_SCRAPE_SCHEDULE` | `0 2 * * *` | Cron expression |
| `CRON_SCRAPE_SOURCES` | `IDP,AECC` | Presets for cron |
| `SKIP_DB_SYNC` | `1` in workers | Skip Sequelize sync on worker boot |

See `config/.env.example` for the full template.

---

## Debug artifacts

| Path | Contents |
|------|----------|
| `raw/` | Full scrape JSON snapshots per run |
| `debug/screenshots/` | Playwright screenshots |
| `debug/html/` | Saved page HTML |
| `debug/logs/` | Failure logs |

These directories are gitignored. Nodemon is configured to ignore them so dev restarts are not triggered mid-scrape.

---

## Known limitations (current implementation)

1. **Fees** — scraped into `raw_fees` on the batch but not cleaned, enriched, or upserted yet (`persisted.fees` is always 0).
2. **Rejected pages** — stored in batch JSONB; not written to `scrape_rejected_pages` table by the current enricher.
3. **AECC universities seed** — the `/universities` listing page is classified as `university` but has no dedicated AECC HTML extractor yet; university rows may be sparse until one is added.
4. **AECC course API** — listing data is extracted from SSR HTML tiles, not from a JSON API response. XHR capture is kept for future API compatibility.
5. **Generic / custom scrapes** — yield depends heavily on seed URLs and site structure; low-quality homepage extractions can occur if detail pages are not discovered.
6. **Do not delete jobs from the UI while workers are actively processing** — can cause race conditions; use `npm run dev:stop -- --jobs` for a clean shutdown.

---

## Key file reference

| Concern | Path |
|---------|------|
| Routes | `src/modules/scrape/scrape.routes.ts` |
| Service (list/export/delete) | `src/modules/scrape/scrape.service.ts` |
| Job processor | `src/modules/scrape/scrape.processor.ts` |
| RabbitMQ | `src/modules/scrape/queues/scrape.queue.ts` |
| Presets | `src/modules/scrape/config/scrape-sources.ts` |
| Target resolution | `src/modules/scrape/config/scrape-target.util.ts` |
| Playwright pipeline | `src/modules/scrape/scrapers/pipeline.scraper.ts` |
| AECC course extractor | `src/modules/scrape/scrapers/aecc/aecc-course.extractor.ts` |
| AECC scholarship extractor | `src/modules/scrape/scrapers/aecc/aecc-scholarship.extractor.ts` |
| Playwright utils | `src/modules/scrape/scrapers/playwright.util.ts` |
| Page classifier | `src/modules/scrape/classifier/page.classifier.ts` |
| robots.txt helper | `src/modules/scrape/scrapers/robots.util.ts` |
| Enrichment orchestrator | `src/modules/scrape/orchestrator/enrichment.orchestrator.ts` |
| DB upsert | `src/modules/scrape/persistence/entity-upsert.service.ts` |
| Zod schemas | `src/modules/scrape/schemas/scrape.schemas.ts` |
| Stale recovery | `src/modules/scrape/recover-stale-jobs.ts` |
| Cron | `src/scheduler/scrape.cron.ts` |
| Dev orchestration | `scripts/dev-start.js`, `scripts/dev-stop.js` |
| Scraper worker | `workers/scraper.worker.ts` |
| Cleaner worker | `workers/cleaner.worker.ts` |

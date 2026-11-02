# KrishiLens

KrishiLens is a voice-first, mobile-first crop-care investigation assistant for smallholder farmers, especially in Bangladesh. Farmers will be able to ask crop-health questions in Bangla, share crop images, and receive evidence-grounded guidance with follow-up investigations over time.

The project includes a text-only Muse Spark preview, SAM 3.1 image segmentation, and a bounded Muse Spark tool-calling crop investigation. Image segmentation identifies candidate visual regions only; it does not diagnose crop disease or establish validated severity.

## Technology stack

- **Frontend:** React, Vite, TypeScript, Tailwind CSS (official Vite plugin), React Router, Axios, Lucide React, i18next, react-i18next
- **Backend:** Node.js, Express, TypeScript, `tsx`, dotenv, Zod, OpenAI SDK (Meta Responses API), Multer, Sharp
- **SAM parsing:** `@meta-sam/parser` for streamed segmentation records and binary masks
- **Data:** MongoDB Atlas, Mongoose; Zod validates API requests
- **AI:** Muse Spark text reasoning and SAM 3.1 segmentation via Meta Model API
- **Planned AI:** Muse Voice Transcribe

## Local setup

Requirements: Node.js 22.x and npm.

For Vercel frontend and Render API deployment guidance, see [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md).

1. Install dependencies from the repository root:

   ```sh
   npm install
   npm install --prefix client
   npm install --prefix server
   ```

2. Create the backend environment file:

   ```sh
   cp server/.env.example server/.env
   ```

   The root `.env.example` lists the backend variables for reference. Keep real credentials in an ignored `.env` file; never put server secrets in frontend variables.

3. Optionally configure the frontend API URL:

   ```sh
   cp client/.env.example client/.env
   ```

4. Start both applications:

   ```sh
   npm run dev
   ```

   The frontend runs at <http://localhost:5173> and the API at <http://localhost:3000>.

## Environment variables

| Variable | Purpose | Current behavior |
| --- | --- | --- |
| `PORT` | Backend HTTP port | Defaults to `3000` |
| `CLIENT_URL` | Allowed frontend origin for CORS | Defaults to `http://localhost:5173` |
| `MODEL_API_KEY` | Server-side Meta Model API credential | Required for live AI requests; never sent to the browser |
| `META_BASE_URL` | Meta Model API base URL | Defaults to `https://api.meta.ai/v1` |
| `MONGODB_URI` | MongoDB connection string | Required by the API; startup fails clearly if missing or unreachable |
| `LOCAL_IMAGE_STORAGE_DIR` | Private local image directory | Development-only adapter; defaults to `./data/private-images` from the server directory |
| `IMAGE_STORAGE_PROVIDER` | Private image adapter (`local` or `cloudinary`) | Defaults to `local` for development; production requires `cloudinary` |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name | Required with the `cloudinary` provider; server-side only |
| `CLOUDINARY_API_KEY` | Cloudinary API key | Required with the `cloudinary` provider; server-side only |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | Required with the `cloudinary` provider; server-side only |
| `VITE_API_URL` | Backend origin used by the browser | Optional for local Vite development (defaults to `http://localhost:3000`); required for deployment. Never place secrets in `VITE_*` variables. |

## Development commands

Run these from the repository root:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run the Vite frontend and `tsx` backend together |
| `npm run build` | Build the frontend and compile the backend |
| `npm run typecheck` | Check both TypeScript projects (the client check also produces its production build) |

Production build and typecheck commands require `VITE_API_URL` to be set to the HTTPS backend origin. See [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) for a local verification command.

The real-service end-to-end workflow uses a unique disposable Atlas database and a dedicated Cloudinary account. Configure the `E2E_*` values in the ignored `server/.env.e2e` file, then run `npm run test:e2e --prefix server`. It invokes real SAM and Muse requests and removes the current run's Cloudinary assets and database; setup, licensed image attribution, and recovery from incomplete cleanup are documented in [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md). Do not point integration tests at production services.

The narrower optional Cloudinary integration test can be run with `RUN_CLOUDINARY_INTEGRATION_TESTS=1 npm run test:cloudinary --prefix server`. It requires `IMAGE_STORAGE_PROVIDER=cloudinary`, a `MONGODB_URI` database named `krishilens_integration_test` (or a generated `krishilens_e2e_*` name), and the explicit `E2E_CLOUDINARY_CONFIRMATION` value documented in [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md). Live integration tests refuse unrecognized database names.

Additional commands:

| Command | Purpose |
| --- | --- |
| `npm test` | Run backend agent, upload, parser, mask-math, and provider error tests |
| `npm run test --prefix client` | Run bilingual UI, locale parity, persistence, and request-language tests |
| `npm run lint --prefix client` | Lint the frontend |
| `npm run dev --prefix client` | Run only the frontend |
| `npm run dev --prefix server` | Run only the backend |
| `npm run typecheck --prefix server` | Type-check the backend |

The health check is available at `GET http://localhost:3000/api/health`. Text-only crop investigation is available at `POST http://localhost:3000/api/ai/analyze`. SAM image segmentation is available at `POST http://localhost:3000/api/images/segment`.

### SAM image segmentation API

Send `multipart/form-data` with:

| Field | Required | Values |
| --- | --- | --- |
| `image` | Yes | JPEG, PNG, or WebP; maximum 4 MB |
| `crop` | No | `rice` (default), `wheat`, `maize`, `jute`, `other` |
| `target` | No | `brown spots` (default), `yellow discolored region`, `damaged leaf region` |
| `language` | No | `bn` (default) or `en`; included with browser requests |

Example:

```sh
curl -X POST http://localhost:3000/api/images/segment \
  -F 'image=@rice-leaf.jpg' \
  -F 'crop=rice' \
  -F 'target=brown spots'
```

The backend validates and decodes the uploaded image, auto-rotates it, and resizes it to at most 2048 × 2048 while preserving aspect ratio. It first sends the selected crop leaf as a short SAM concept. If that prompt returns no matches, it tries the generic noun phrase `leaf`. When a leaf is found, the selected candidate region is sent in a separate request. These are sequential, one-concept-per-request SAM Responses API calls. The image is held in memory and sent as a data URL; no image files or public upload URLs are stored.

The JSON response includes `success`, `model`, normalized `image` dimensions, leaf-mask status and pixel count, candidate affected pixel count/percentage/status, detected `objects`, a transparent PNG `overlay.imageUrl`, provider `requestIds`, and short-lived `scanId`/`scanAccessToken` values for an investigation. Keep the access token private; the browser holds it in memory and sends it only in an `Authorization: Bearer` header. The percentage is computed only when validated leaf and candidate masks are available; it is the candidate mask intersection with the leaf mask divided by leaf-mask pixels. This is a geometric estimate of model-selected pixels only, **not** a disease diagnosis or validated severity measure. Missing, invalid, or disjoint masks produce no estimate rather than a zero-damage claim. Overlay green outlines mark the leaf mask; orange pixels show the candidate mask, including portions outside the leaf. The selected interface language is sent as `language`; API status and error codes remain language-neutral.

The endpoint returns 400 for missing/invalid uploads, 413 for files larger than 4 MB, 503 when the model key is unavailable, 429 for provider rate limits, 504 for timeouts, and 502 for other provider failures. Error responses include a friendly `error` and do not expose upstream stack traces or credentials.

Meta documents SAM 3.1's Responses API and parser at [SAM overview](https://dev.meta.ai/docs/sam/overview), [segmenting](https://dev.meta.ai/docs/sam/segmenting), [client libraries](https://dev.meta.ai/docs/sam/client-libraries), and [API basics](https://dev.meta.ai/docs/cookbook/sam-api-basics).

### Crop analysis API

Request JSON:

```json
{
  "crop": "rice",
  "question": "আমার ধানের পাতায় বাদামি দাগ পড়েছে",
  "language": "bn"
}
```

`crop` must be `rice`, `wheat`, `maize`, `jute`, or `other`. `question` must contain 3–2000 characters. `language` is `bn` (Bangla) or `en` (English).

Successful response:

```json
{
  "success": true,
  "answer": "…",
  "model": "muse-spark-1.3",
  "requestId": "resp_…"
}
```

Validation errors return HTTP 400, an unconfigured model key returns HTTP 503, rate limits return HTTP 429, and upstream/time-out errors return HTTP 502/504. Error responses include `success: false`, `model`, and a friendly `answer`; upstream request IDs are included when available. API keys stay on the backend.

### Agentic crop investigation API

The image-analysis page offers a tool-calling investigation after a successful segmentation. The browser sends the `scanId` and its `scanAccessToken` using a bearer header; the backend creates a separate short-lived investigation token and returns it in the response body:

```http
POST /api/agent/investigate
Authorization: Bearer <scanAccessToken>
Content-Type: application/json
```

```json
{
  "scanId": "<scan-id-from-image-response>",
  "crop": "rice",
  "language": "bn",
  "question": "আমার ধানের পাতায় বাদামি দাগ পড়েছে"
}
```

The response contains `sessionId`, the original session `language`, `accessToken`, `status`, a sanitized `trace`, and either a `pendingQuestion`, a final `report`, or a status `message`. Use the session token in an `Authorization: Bearer` header for `GET /api/agent/:sessionId`, `POST /api/agent/:sessionId/answer`, and `POST /api/agent/:sessionId/translate`. Follow-up answers may include the original `{ "language": "bn" | "en" }`; the server checks it and keeps that language for the entire investigation. Translation accepts `{ "language": "bn" | "en" }` and returns a separate translated report/question; it does not overwrite the original case text, observations, measurements, or citations. The UI identifies the original language and only displays translated agent text after the explicit translation action. Never put either access token in a URL or log. Investigation reads are marked `Cache-Control: no-store`.

### Persistent cases and re-checks

The API now connects to MongoDB before listening. Set `MONGODB_URI` in `server/.env` to a MongoDB Atlas URI or a local compatible database. Connection errors report the error class only; the URI and credentials are never logged. Mongoose creates indexes for ownership, related IDs, timestamps, and expiry.

The `Case`, `Scan`, `Investigation`, `Trace`, `Recheck`, `AnonymousOwner`, and `AgentScan` collections store case metadata, validated SAM measurements, protected image references, sanitized traces, assessment text, and resumable agent state. Scan images are stored outside MongoDB. Configure `IMAGE_STORAGE_PROVIDER=local` and `LOCAL_IMAGE_STORAGE_DIR` for development, or use `IMAGE_STORAGE_PROVIDER=cloudinary` with server-only Cloudinary credentials. Cloudinary uploads use the `authenticated` delivery type. The existing bearer-token and case-owner image route retrieves those assets server-side; signed download URLs are short-lived and are never returned to the browser. Existing local references remain readable by the local adapter and are not deleted during provider changes. Production startup requires the Cloudinary provider and all three credentials.

Create a case with `POST /api/cases` and JSON `{ "crop": "rice", "language": "bn" }`. A first-time anonymous browser receives an `ownerAccessToken` once. The client stores it in browser local storage and sends it only as an `Authorization: Bearer` header. The database stores only its SHA-256 hash. The anonymous owner token expires after one year; clearing browser storage loses access. There is no account recovery or cross-device access.

Available case endpoints:

| Endpoint | Purpose |
| --- | --- |
| `POST /api/cases` | Create a case and, for a new browser session, issue its owner token |
| `GET /api/cases?page=1&limit=20` | List only the caller's cases |
| `GET /api/cases/:caseId` | Read a case with its recent scans, investigations, and re-checks |
| `GET /api/cases/:caseId/scans?page=1&limit=20` | Paginated scan history |
| `GET /api/cases/:caseId/investigations?page=1&limit=20` | Paginated investigation history |
| `PATCH /api/cases/:caseId/recheck-date` | Set or clear an intended future re-check date |
| `POST /api/cases/:caseId/recheck` | Upload, analyze, and save a re-check |
| `GET /api/cases/:caseId/scans/:scanId/image` | Read a private saved image after owner authorization |

Re-check uploads use multipart fields `image`, `language`, `observations`, optional `previousScanId`, and optional boolean strings `similarLighting`, `similarAngle`, and `samePlantRegion`. Include a UUID `Idempotency-Key` header. Images are validated and normalized, segmented with the existing SAM 3.1 service, then written to private development storage with measurements and metadata saved in MongoDB. The form asks the farmer to confirm comparable lighting, angle, and plant area; missing confirmations or unvalidated affected-area measurements keep the comparison inconclusive. The displayed change is current minus previous percentage points. Even a comparable decline is described only as a possible visible improvement, never proof of recovery.

Muse Spark receives only the deterministic comparison status, reasons, and farmer observations for the progress note; the numeric measurements remain separate and cannot be changed by the model. If the Meta API is unavailable or unconfigured, the endpoint stores a cautious localized fallback. An intended date appears as an in-app upcoming/overdue reminder; there is no scheduler or automatic message delivery.

Agent scans and investigation session state now use MongoDB-backed adapters in the running API. Session access tokens remain bearer-only and are stored as hashes; state is bounded by the existing agent execution limits. A persistent agent scan retains validated analysis metadata, not the uploaded image. Only images uploaded through the case re-check workflow are retained and associated with a case. Phase 4 investigations created before this change are not backfilled or automatically attached to a crop case.

## Languages

The interface defaults to Bangla (`bn`) for new users and restores only a valid `bn`/`en` preference from `localStorage` (`krishilens.language`). Switching language updates visible static text, document language/title, accessibility labels, and localized number formatting without reloading or resetting the current route or form state. Static copy is bundled in `client/src/i18n/locales/`; it is not machine-translated at runtime. Muse Spark generates investigation content in the language selected when a case starts. If the interface language changes during a case, use the explicit translation action; the original report remains unchanged. Translation output is schema-checked and numeric values/IDs/citations are preserved, but machine translation may still be imperfect.

The agent uses the Meta Responses API function-calling protocol (`function_call`, matching `function_call_output` items, and `previous_response_id`). The server validates tool names, arguments, and outputs; runs a maximum of six model turns; blocks repeated tool calls without new farmer information; and pauses at one follow-up question until an answer arrives. Deterministic report checks reject un-retrieved citations, unsupported percentages, non-agronomic sources used as disease evidence, and chemical treatment instructions. Trace entries report actions only and never include hidden model reasoning or farmer answers.

**Persistence and security limitations:** case access is anonymous and tied to the browser's local storage; it cannot be transferred to another device or recovered if the token is lost. No cloud image-storage adapter, account system, automatic reminders, or backfill of earlier investigations is implemented. A disposable MongoDB integration run is required before claiming database persistence has been verified. The current curated collection contains the accessible BRRI official portal as a referral/institution record only; it has no symptom-specific disease passage, so the guidance tool explicitly reports no symptom-level evidence. Reports must remain tentative/insufficient and refer farmers to qualified local assistance when needed.

## Planned architecture

- `client/src/` contains the mobile-first React UI, reusable components, pages, service clients, shared types, and assets.
- `server/src/routes/` exposes API endpoints; `middleware/` handles cross-cutting concerns; `config/` owns runtime configuration.
- `server/src/agent/` contains the bounded tool-calling loop, Zod-validated tool registry, in-memory test adapters and MongoDB runtime adapters, report safety checks, trace recorder, and scan/guidance/follow-up/report tools. `server/src/services/` contains Muse Spark transport, SAM parsing, image normalization, private image storage, deterministic mask calculations, and scan comparison. The server mediates model API calls so credentials are never sent to the browser.
- `server/src/models/` contains the MongoDB/Mongoose schemas and indexes; `server/src/routes/cases.ts` implements owner-scoped case, schedule, image, and re-check APIs.
- `eval/` and `demo/` are reserved for evaluation assets and hackathon demonstrations.

Voice transcription and persistent user accounts remain out of scope. The current investigation loop is bounded and does not make disease diagnoses or execute chemical treatments. Production deployment requires a private cloud image-storage adapter and a disposable-database integration test. This MVP is not production-ready.

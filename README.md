# KrishiLens

KrishiLens is a voice-first, mobile-first crop-care investigation assistant for smallholder farmers, especially in Bangladesh. Farmers will be able to ask crop-health questions in Bangla, share crop images, and receive evidence-grounded guidance with follow-up investigations over time.

The project includes a text-only Muse Spark preview, SAM 3.1 image segmentation, and a bounded Muse Spark tool-calling crop investigation. Image segmentation identifies candidate visual regions only; it does not diagnose crop disease or establish validated severity.

## Technology stack

- **Frontend:** React, Vite, TypeScript, Tailwind CSS (official Vite plugin), React Router, Axios, Lucide React
- **Backend:** Node.js, Express, TypeScript, `tsx`, dotenv, Zod, OpenAI SDK (Meta Responses API), Multer, Sharp
- **SAM parsing:** `@meta-sam/parser` for streamed segmentation records and binary masks
- **Planned data:** MongoDB, Mongoose; Zod validates API requests
- **AI:** Muse Spark text reasoning and SAM 3.1 segmentation via Meta Model API
- **Planned AI:** Muse Voice Transcribe

## Local setup

Requirements: Node.js 20.19+ and npm.

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

   The root `.env.example` lists the same variables for reference. Keep real credentials in an ignored `.env` file; never put server secrets in frontend variables.

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
| `MONGODB_URI` | MongoDB connection string | Reserved; no database connection |
| `VITE_API_URL` | Backend origin used by the browser | Optional; defaults to `http://localhost:3000`. Never place secrets in `VITE_*` variables. |

## Development commands

Run these from the repository root:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run the Vite frontend and `tsx` backend together |
| `npm run build` | Build the frontend and compile the backend |
| `npm run typecheck` | Check both TypeScript projects (the client check also produces its production build) |
| `npm test` | Run backend agent, upload, parser, mask-math, and provider error tests |
| `npm run dev --prefix client` | Run only the frontend |
| `npm run dev --prefix server` | Run only the backend |
| `npm run typecheck --prefix server` | Type-check the backend |

The health check is available at `GET http://localhost:3000/api/health`. Text-only crop investigation is available at `POST http://localhost:3000/api/ai/analyze`. SAM image segmentation is available at `POST http://localhost:3000/api/images/segment`.

### SAM image segmentation API

Send `multipart/form-data` with:

| Field | Required | Values |
| --- | --- | --- |
| `image` | Yes | JPEG, PNG, or WebP; maximum 5 MB |
| `crop` | No | `rice` (default), `wheat`, `maize`, `jute`, `other` |
| `target` | No | `brown spots` (default), `yellow discolored region`, `damaged leaf region` |

Example:

```sh
curl -X POST http://localhost:3000/api/images/segment \
  -F 'image=@rice-leaf.jpg' \
  -F 'crop=rice' \
  -F 'target=brown spots'
```

The backend validates and decodes the uploaded image, auto-rotates it, and resizes it to at most 2048 × 2048 while preserving aspect ratio. It first sends the selected crop leaf as a short SAM concept. If that prompt returns no matches, it tries the generic noun phrase `leaf`. When a leaf is found, the selected candidate region is sent in a separate request. These are sequential, one-concept-per-request SAM Responses API calls. The image is held in memory and sent as a data URL; no image files or public upload URLs are stored.

The JSON response includes `success`, `model`, normalized `image` dimensions, leaf-mask status and pixel count, candidate affected pixel count/percentage/status, detected `objects`, a transparent PNG `overlay.imageUrl`, provider `requestIds`, and short-lived `scanId`/`scanAccessToken` values for an investigation. Keep the access token private; the browser holds it in memory and sends it only in an `Authorization: Bearer` header. The percentage is computed only when validated leaf and candidate masks are available; it is the candidate mask intersection with the leaf mask divided by leaf-mask pixels. This is a geometric estimate of model-selected pixels only, **not** a disease diagnosis or validated severity measure. Missing, invalid, or disjoint masks produce no estimate rather than a zero-damage claim. Overlay green outlines mark the leaf mask; orange pixels show the candidate mask, including portions outside the leaf.

The endpoint returns 400 for missing/invalid uploads, 413 for files larger than 5 MB, 503 when the model key is unavailable, 429 for provider rate limits, 504 for timeouts, and 502 for other provider failures. Error responses include a friendly `error` and do not expose upstream stack traces or credentials.

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

The response contains `sessionId`, `accessToken`, `status`, a sanitized `trace`, and either a `pendingQuestion`, a final `report`, or a friendly status `message`. Use the session token in an `Authorization: Bearer` header for both `GET /api/agent/:sessionId` and `POST /api/agent/:sessionId/answer`; the answer body is `{ "answer": "..." }`. Never put either access token in a URL or log. Investigation reads are marked `Cache-Control: no-store`.

The agent uses the Meta Responses API function-calling protocol (`function_call`, matching `function_call_output` items, and `previous_response_id`). The server validates tool names, arguments, and outputs; runs a maximum of six model turns; blocks repeated tool calls without new farmer information; and pauses at one follow-up question until an answer arrives. Deterministic report checks reject un-retrieved citations, unsupported percentages, non-agronomic sources used as disease evidence, and chemical treatment instructions. Trace entries report actions only and never include hidden model reasoning or farmer answers.

**Temporary storage limitation:** scans and investigations are held in memory for up to two hours and are lost when the server restarts. They are protected by unguessable bearer tokens whose hashes are stored server-side. MongoDB persistence and user accounts are not implemented. The current curated collection contains the accessible BRRI official portal as a referral/institution record only; it has no symptom-specific disease passage, so the guidance tool explicitly reports no symptom-level evidence. Reports must remain tentative/insufficient and refer farmers to qualified local assistance when needed.

## Planned architecture

- `client/src/` contains the mobile-first React UI, reusable components, pages, service clients, shared types, and assets.
- `server/src/routes/` exposes API endpoints; `middleware/` handles cross-cutting concerns; `config/` owns runtime configuration.
- `server/src/agent/` contains the bounded tool-calling loop, Zod-validated tool registry, temporary stores, report safety checks, trace recorder, and scan/guidance/follow-up/report tools. `server/src/services/` contains Muse Spark transport, SAM parsing, image normalization, and deterministic mask calculations. The server mediates model API calls so credentials are never sent to the browser.
- `server/src/models/` will hold MongoDB/Mongoose models once persistence is introduced.
- `eval/` and `demo/` are reserved for evaluation assets and hackathon demonstrations.

MongoDB scan history, voice transcription, and persistent authentication remain out of scope. The current investigation loop is bounded and does not make disease diagnoses or execute chemical treatments. This MVP is not production-ready.

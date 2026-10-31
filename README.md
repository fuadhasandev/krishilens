# KrishiLens

KrishiLens is a voice-first, mobile-first crop-care investigation assistant for smallholder farmers, especially in Bangladesh. Farmers will be able to ask crop-health questions in Bangla, share crop images, and receive evidence-grounded guidance with follow-up investigations over time.

The project currently includes a text-only AI investigation preview. It does not analyze images and does not provide confirmed crop diagnoses.

## Technology stack

- **Frontend:** React, Vite, TypeScript, Tailwind CSS (official Vite plugin), React Router, Axios, Lucide React
- **Backend:** Node.js, Express, TypeScript, `tsx`, dotenv, Zod, OpenAI SDK (Meta Responses API)
- **Planned data:** MongoDB, Mongoose; Zod validates API requests
- **Planned AI:** Meta Model API for reasoning and tool calls, SAM for image segmentation, and Muse Voice Transcribe

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
| `npm run dev --prefix client` | Run only the frontend |
| `npm run dev --prefix server` | Run only the backend |
| `npm run typecheck --prefix server` | Type-check the backend |

The health check is available at `GET http://localhost:3000/api/health`. Text-only crop investigation is available at `POST http://localhost:3000/api/ai/analyze`.

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

## Planned architecture

- `client/src/` contains the mobile-first React UI, reusable components, pages, hooks, service clients, shared types, and assets.
- `server/src/routes/` exposes API endpoints; `middleware/` handles cross-cutting concerns; `config/` owns runtime configuration.
- `server/src/agent/tools/` will host future investigation tools; `server/src/services/` contains the Meta client and crop reasoning prompt. The server mediates model API calls so credentials are never sent to the browser.
- `server/src/models/` will hold MongoDB/Mongoose models once persistence is introduced.
- `eval/` and `demo/` are reserved for evaluation assets and hackathon demonstrations.

Authentication, MongoDB connections, image analysis, voice transcription, and the agent loop are intentionally out of scope for the current phases.

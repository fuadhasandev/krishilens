# KrishiLens

KrishiLens is a voice-first, mobile-first crop-care investigation assistant for smallholder farmers, especially in Bangladesh. Farmers will be able to ask crop-health questions in Bangla, share crop images, and receive evidence-grounded guidance with follow-up investigations over time.

This repository contains the Phase 1 project foundation. The current frontend is a welcome page and the backend exposes a health check; no AI-generated crop guidance is implemented.

## Technology stack

- **Frontend:** React, Vite, TypeScript, Tailwind CSS (official Vite plugin), React Router, Axios, Lucide React
- **Backend:** Node.js, Express, TypeScript, `tsx`, dotenv
- **Planned data and validation:** MongoDB, Mongoose, Zod
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

3. Start both applications:

   ```sh
   npm run dev
   ```

   The frontend runs at <http://localhost:5173> and the API at <http://localhost:3000>.

## Environment variables

| Variable | Purpose | Phase 1 behavior |
| --- | --- | --- |
| `PORT` | Backend HTTP port | Defaults to `3000` |
| `CLIENT_URL` | Allowed frontend origin for CORS | Defaults to `http://localhost:5173` |
| `MODEL_API_KEY` | Server-side Meta Model API credential | Reserved; not used |
| `META_BASE_URL` | Meta Model API base URL | Reserved; not used |
| `MONGODB_URI` | MongoDB connection string | Reserved; no database connection |

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

The API health check is available at `GET http://localhost:3000/api/health`.

## Planned architecture

- `client/src/` contains the mobile-first React UI, reusable components, pages, hooks, service clients, shared types, and assets.
- `server/src/routes/` exposes API endpoints; `middleware/` handles cross-cutting concerns; `config/` owns runtime configuration.
- `server/src/agent/tools/` and `server/src/services/` will host the investigation agent and integrations. The server will mediate all model API calls so credentials are never sent to the browser.
- `server/src/models/` will hold MongoDB/Mongoose models once persistence is introduced.
- `eval/` and `demo/` are reserved for evaluation assets and hackathon demonstrations.

Authentication, MongoDB connections, model calls, image analysis, voice transcription, and the agent loop are intentionally out of scope for Phase 1.

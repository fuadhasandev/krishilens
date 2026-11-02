# Deployment and safe verification

KrishiLens uses separate managed services:

| Component | Hosting | Production resource |
| --- | --- | --- |
| React/Vite frontend | Vercel | `https://krishilens-nine.vercel.app/` |
| Express API | Render Web Service | `https://krishilens-api.onrender.com/` |
| Cases, scans, and investigations | MongoDB Atlas | Private MongoDB database |
| Uploaded case images | Cloudinary | `authenticated` delivery; API-authorized downloads |
| Image and text models | Meta Model API | SAM 3.1 and Muse Spark 1.3 |

This repository does not contain a Render Blueprint. Render's service settings, selected compute plan, `NODE_VERSION` override, and deploy history are managed in the Render Dashboard. `server/vercel.json` is Vercel-specific legacy configuration; its function duration does **not** configure or extend the Render service.

## 1. Render service settings

For the API's Render Web Service, verify the following under **Settings**, **Environment**, **Compute**, **Events**, and **Logs**:

| Setting | Expected value |
| --- | --- |
| Root directory | `server` |
| Runtime | Node.js |
| Build command | `npm ci && npm run build` |
| Start command | `npm start` |
| Health check path | `/api/health` |
| Node.js version | `22.x`, consistent with `server/package.json` |
| Port | Use Render's injected `PORT`; do not hard-code a production port |

Render's `NODE_VERSION` dashboard value takes precedence over repository version declarations. Check the deployed version in the service's deploy logs (and, if available, its Shell with `node --version`); do not infer it from the local machine or an old deploy. Render's current default can change over time, so explicitly pin the intended major version.

The selected **compute plan** determines CPU and memory. Record the plan and RAM shown in the Render Dashboard; this repository cannot establish which plan the deployed service uses. Image decoding and segmentation hold bounded image buffers in memory, so monitor memory and restarts during real uploads.

The server reads `PORT` and `CLIENT_URL`, checks required production configuration during startup, connects to Atlas, and then initializes Mongo-backed stores. Render must route to the port supplied through `PORT`. The health route returns 200, but it does not itself prove that every external model or image-storage request is healthy.

### Runtime and request limits

- Do not apply Vercel Function limits to Render. Render's request lifetime is an ingress/platform constraint, not the `maxDuration` in `server/vercel.json`; check Render's current Web Service documentation and service logs for the effective cutoff.
- This API performs SAM and Muse calls synchronously. SAM may make sequential provider calls with per-call timeouts, and an investigation has its own execution budget. A re-check can run SAM and then Muse. Those aggregate budgets can exceed a hosted HTTP request window even when each individual provider call is bounded. A disconnected browser request is not evidence that the server-side work completed or that the result was saved.
- The browser's long Axios timeout does not increase Render's request limit. Treat a timeout as a failed or uncertain operation and verify case history before retrying.
- Render Free Web Services spin down after inactivity and can take about a minute to start again. Free instances have limited CPU/RAM and ephemeral local filesystems. Verify the deployed service's plan before attributing a slow first health check to application code.
- Render runs configured HTTP health checks every few seconds and expects a 2xx/3xx response within five seconds. Use `/api/health`; review **Events** and runtime logs around restarts and failed checks.
- Startup/configuration failures appear in deploy/runtime logs. Check `NODE_VERSION`, build output, startup validation errors, `PORT`, Atlas connectivity, and the health-check path. Mongo diagnostics are sanitized in application logs; never paste credentials or full connection strings into tickets or chat.

Official Render references: [Node.js version selection](https://render.com/docs/node-version), [Web Services](https://render.com/docs/web-services), [compute plans](https://render.com/docs/compute-plans), [health checks](https://render.com/docs/health-checks), and [Free Web Service limits](https://render.com/docs/free).

## 2. Environment variables

Configure values in the relevant service's environment settings. Keep secrets server-side. Never use `VITE_` for a credential.

### Vercel frontend

| Variable | Required | Notes |
| --- | --- | --- |
| `VITE_API_URL` | Yes | Render API origin, e.g. `https://krishilens-api.onrender.com`; no `/api` path. It is public and compiled into the client bundle. |

The frontend only uses `http://localhost:3000` in Vite development mode. Production builds require an HTTPS API origin.

### Render backend

| Variable | Required | Notes |
| --- | --- | --- |
| `MODEL_API_KEY` | Yes | Meta Model API key; server-only. |
| `META_BASE_URL` | No | Defaults to `https://api.meta.ai/v1`. |
| `MONGODB_URI` | Yes | Authenticated MongoDB Atlas URI for the production database. |
| `IMAGE_STORAGE_PROVIDER` | Yes | Must be `cloudinary` in production. |
| `CLOUDINARY_CLOUD_NAME` | Yes | Production Cloudinary account. |
| `CLOUDINARY_API_KEY` | Yes | Server-only Cloudinary credential. |
| `CLOUDINARY_API_SECRET` | Yes | Server-only Cloudinary secret. |
| `CLIENT_URL` | Yes | Exact frontend origin, `https://krishilens-nine.vercel.app`. No path or wildcard. |
| `PORT` | Render-provided | The service reads Render's injected port. |

Use an Atlas database user with only the permissions the service needs, TLS, and an appropriate network access policy. The Mongoose connection uses a 10-second server-selection timeout and a maximum pool size of 10 per process; account for the number of Render instances when sizing Atlas limits. Do not use the production URI in integration tests.

Cloudinary uploads must remain `authenticated`. Case image downloads go through the owner-authorized API. Do not expose signed delivery URLs, make assets public, or return credentials to the browser.

Voice transcription uses the existing server-side `MODEL_API_KEY`; no additional secret or Render binary is required. The browser converts MediaRecorder output to mono, 16-bit PCM WAV at 24 kHz with Web Audio before upload. The API validates the WAV in memory, limits it to 60 seconds and 4 MB, allows five requests per IP every ten minutes through the existing process-local limiter, and admits at most three in-flight voice uploads/transcriptions per server process. Audio is not written to disk or persisted. This implementation adds no FFmpeg package or system-binary requirement. Browser codec support and audio decoding vary by device; if the selected browser cannot produce or decode a supported recording format, the UI asks the farmer to retry or type the question.

### Voice transcription verification

The regular backend tests mock Meta responses. An opt-in live test sends real English and Bengali WAV fixtures to Meta and may incur API charges. Use only audio with explicit permission; the fixtures remain at the caller-provided paths and the test does not log the recognized text.

```sh
VOICE_TEST_AUDIO_CONSENT=I_HAVE_PERMISSION_TO_SEND_THESE_AUDIO_FIXTURES_TO_META \
VOICE_TEST_ENGLISH_WAV=/absolute/path/to/consented-english.wav \
VOICE_TEST_BENGALI_WAV=/absolute/path/to/consented-bengali.wav \
npm run test:voice:live --prefix server
```

The fixtures must be mono, 16-bit PCM WAV at 16 kHz or 24 kHz and no longer than 60 seconds. Configure `MODEL_API_KEY` only in the server environment. Do not enable this test in routine CI.

## 3. Disposable real-service integration test

`npm run test:e2e --prefix server` runs a real integration against a local child API process and **dedicated external test services**. It does not mock SAM, Muse, MongoDB, or Cloudinary, and does not call or mutate the deployed production API. It creates a new database named `krishilens_e2e_<run-uuid>` for each run, creates a random owner and case, and saves cleanup metadata without access tokens or credentials.

The test uses two Wikimedia Commons rice images:

- [RiceSheathArk.jpg](https://commons.wikimedia.org/wiki/File:RiceSheathArk.jpg) — public domain; photo by Peggy Greb, USDA Agricultural Research Service; credit: USDA ARS, image D1769-1.
- [Leafs of rice plant.jpg](https://commons.wikimedia.org/wiki/File:Leafs_of_rice_plant.jpg) — CC BY-SA 4.0; photographer/uploader Sivabalachandar03. Attribution and license are retained here; the test downloads the original temporarily and does not add either image to the repository.

These are different example photos, not a controlled before/after pair. The test deliberately marks angle, lighting, and plant region as unconfirmed and requires an **inconclusive** comparison. It must not be interpreted as a disease or treatment efficacy evaluation. The image bytes are transmitted to Meta and the dedicated Cloudinary account during the run.

### One-time test setup

1. Create a disposable Atlas cluster/database user and a separate Cloudinary product environment/account. Never point either at production. Use test-only Meta credentials if available; real inference can incur provider charges.
2. From `server/`, create an ignored `.env.e2e` file. The required names are below; values are intentionally not provided in this document:

   ```text
   E2E_MONGODB_URI
   E2E_MONGODB_HOST
   E2E_MODEL_API_KEY
   E2E_CLOUDINARY_CLOUD_NAME
   E2E_CLOUDINARY_API_KEY
   E2E_CLOUDINARY_API_SECRET
   E2E_DATABASE_CONFIRMATION=I_HAVE_CONFIGURED_A_DISPOSABLE_ATLAS_CLUSTER
   E2E_CLOUDINARY_CONFIRMATION=I_HAVE_CONFIGURED_A_DISPOSABLE_CLOUDINARY_ACCOUNT
   # Optional:
   E2E_META_BASE_URL=https://api.meta.ai/v1
   ```

   `E2E_MONGODB_HOST` must exactly match the hostname in `E2E_MONGODB_URI`. The runner replaces only the database name with its fresh run-specific E2E name. It never falls back to `MONGODB_URI`, `MODEL_API_KEY`, or production Cloudinary variables. Confirm the Atlas user can create and drop only disposable databases and the Cloudinary credentials belong to the dedicated test account.
3. Keep `.env.e2e` private. Do not print or paste it into logs, CI output, or support requests.

### Run and cleanup

```sh
npm run test:e2e --prefix server
```

The workflow creates a dedicated owner, creates a case through the API, uploads a licensed image to real SAM and authenticated Cloudinary storage, runs an English Muse investigation, answers the live follow-up, generates a report, translates it to Bangla, uploads the second image for a real re-check, verifies private-image authorization and cautious comparison, then restarts the API process and confirms Mongo-backed history/report persistence.

Cleanup runs in `finally`: it lists Cloudinary resources only beneath the random run owner's exact `krishilens/<owner-id>/` prefix, rejects resources outside that owner/UUID path or non-authenticated delivery, deletes those assets, verifies the prefix is empty, and only then drops that run's strictly validated `krishilens_e2e_<run-uuid>` database. The test does not use a public deletion endpoint and cannot target production collection names through its cleanup manifest.

If cleanup is incomplete, the run manifest remains in the ignored `server/.e2e-runs/` directory and the test fails. Retry only the named run:

```sh
npm run test:e2e:cleanup --prefix server -- .e2e-runs/<run-uuid>.json
```

The cleanup command requires the same explicit disposable-environment confirmations, validates the manifest/database/owner identifiers, refuses broad Cloudinary deletion, and prints counts only. Do not hand-edit a manifest to target another database or owner. Investigate any incomplete cleanup before running another test against that test account.

This integration test verifies application code and real external dependencies under a local Node process. It does **not** verify the deployed Render plan, ingress timeout, deployment configuration, or browser UI. For those, use a separately provisioned Render staging service and browser smoke tests; never repoint production services or credentials for cleanup.

## 4. Production and staging verification

Before calling a release ready:

1. Verify the Vercel frontend's `VITE_API_URL` is the deployed Render origin and the bundle contains no backend credentials.
2. Verify Render's deployed Node version, root/build/start commands, port, health-check path, compute plan/RAM, recent deploy, and runtime logs in the Dashboard.
3. Confirm `/api/health` and exact-origin CORS from the deployed frontend.
4. Use only a separate staging Render service configured with disposable Atlas and Cloudinary resources for image-based workflow tests.
5. Confirm an unauthorized request cannot read a case or image; confirm authorized retrieval works and unauthenticated Cloudinary delivery fails.
6. Confirm the English and Bangla flows, SAM upload, agent follow-up/report, case history after process restart, and second-scan comparison.
7. Check for null/unavailable measurement handling and explicit uncertainty; do not infer diagnosis, recovery, or treatment success from segmentation/comparisons.
8. Verify the run's Cloudinary prefix is empty and its unique E2E database is dropped before declaring cleanup complete.
9. Inspect startup/runtime logs for sanitized errors only; never export API keys, tokens, connection strings, or image content.

`GET /api/health` confirms API responsiveness only. A passing local test is not a production or Render staging pass.

## 5. Build and test commands

Run from the repository root:

```sh
VITE_API_URL=https://krishilens-api.onrender.com npm run typecheck
npm test
npm run lint --prefix client
VITE_API_URL=https://krishilens-api.onrender.com npm run build
```

The `VITE_API_URL` value is public configuration, not a secret. The real-service E2E test is opt-in and is not part of the ordinary test suite.

## Known limitations

- There is no checked-in Render Blueprint; dashboard settings are authoritative until a Render manifest is intentionally added.
- The client allows a long request timeout, but that cannot extend Render's request/ingress limit. SAM/Muse work is synchronous and re-check requests may exceed that limit. Confirm the current Render cutoff for the deployed service and treat gateway timeouts as uncertain completion; inspect case history before retries.
- Local files are not durable storage on Render. Production cases/images must use MongoDB Atlas and authenticated Cloudinary.
- A cold start, Atlas selection timeout, provider latency, or Render restart can interrupt long synchronous workflows. Boundaries return errors; they do not prove that no downstream side effect occurred.
- A successful real-service E2E run does not replace checking the current deployed Render version/compute plan or testing the actual production UI.

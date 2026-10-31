# Vercel deployment

KrishiLens deploys as two independent Vercel projects connected to the same GitHub repository. The frontend is a static Vite application; the Express API is a Node.js Function. Deployments are not performed by this guide.

## 1. Create the Vercel projects

Create two projects from the same repository:

| Setting | Frontend | Backend |
| --- | --- | --- |
| Root Directory | `client` | `server` |
| Framework Preset | Vite | Express |
| Node.js version | `22.x` | `22.x` |
| Build Command | `npm run build` | `npm run build` |
| Output Directory | `dist` | Leave empty; Express is deployed as a Function |
| Install Command | `npm install` | `npm install` |

Use the automatic framework settings unless the project dashboard asks for a build/output override. The backend entrypoint is `src/index.ts`, which default-exports a reusable Express application and does not call `listen()`. The local development/start command uses `src/dev.ts` / `dist/dev.js` and is the only entrypoint that opens a port. `server/vercel.json` configures a 300-second function duration and includes the investigation system prompt asset. `client/vercel.json` rewrites SPA paths to `index.html` for React Router refreshes.

Deploy the backend first and copy its HTTPS origin into the frontend environment. Set the backend's `CLIENT_URL` to the frontend's exact HTTPS origin. For Preview deployments, configure matching Preview environment values; the API does not permit arbitrary origins.

## 2. Environment variables

Set variables in the corresponding Vercel project's Environment Variables settings. Never use `VITE_` for a backend secret.

### Frontend project

| Variable | Value |
| --- | --- |
| `VITE_API_URL` | The backend's HTTPS origin, without an API path (for example, `https://your-api.example`) |

This is the only frontend variable required. `VITE_API_URL` is public and is compiled into browser code. The frontend uses localhost only in Vite development mode; a production build with this variable absent does not fall back to localhost.

### Backend project

| Variable | Required | Notes |
| --- | --- | --- |
| `MODEL_API_KEY` | Yes | Meta Model API key; server-side secret |
| `META_BASE_URL` | No | Defaults to `https://api.meta.ai/v1` |
| `MONGODB_URI` | Yes | Authenticated MongoDB Atlas connection URI |
| `IMAGE_STORAGE_PROVIDER` | Yes | Set exactly to `cloudinary` |
| `CLOUDINARY_CLOUD_NAME` | Yes | Server-side Cloudinary configuration |
| `CLOUDINARY_API_KEY` | Yes | Server-side Cloudinary credential |
| `CLOUDINARY_API_SECRET` | Yes | Server-side Cloudinary secret |
| `CLIENT_URL` | Yes | Exact HTTPS origin of the frontend; one allowed CORS origin |

`PORT` and `LOCAL_IMAGE_STORAGE_DIR` are local-development settings, not Vercel production storage configuration. Production startup rejects missing required variables and local image storage. Do not copy secret values into source files, README, Vite variables, or logs.

## 3. MongoDB Atlas

- Keep Atlas authentication and TLS enabled and use a least-privilege database user.
- Put the backend Function in a region close to the Atlas cluster to reduce latency.
- Allow only Vercel egress addresses that are stable and documented for the selected plan/configuration. Vercel does not provide a fixed outbound IP on every plan. If a static egress option is unavailable, choose an appropriate Vercel networking/plan option rather than opening Atlas to all IP addresses.
- The Mongoose connection is reused in a warm Function process, has a bounded server-selection timeout, and caps its pool at 10 connections. Atlas connection limits should still be sized for concurrent Function instances.
- A cold connection or Atlas firewall issue is surfaced as a sanitized API error; check Atlas access-list, URI, database user, TLS, and region settings.

## 4. Private image storage

Production must set `IMAGE_STORAGE_PROVIDER=cloudinary` and all three Cloudinary credentials. Uploads use the existing authenticated Cloudinary delivery type; downloads still pass through the case-authorized API, which checks bearer-token ownership and scan membership before retrieving the asset. Do not change assets to `public`, return Cloudinary URLs as authorization, or expose the Cloudinary secret.

Local file storage remains available for development and existing development scans; it is not persistent Vercel storage. Vercel Functions can be restarted or run on another instance, so filesystem data must not be used for production image or case persistence. Existing development files are not migrated or removed.

## 5. Function and image limits

Vercel Function request and response bodies are limited to 4.5 MB. Both image-upload routes therefore cap the source image at 4 MiB (multipart headers and fields add request overhead). The SAM endpoint also limits its serialized response to 4 MiB; if an unusually large result exceeds that threshold, it omits the optional overlay and object list from the response while preserving measurements, access tokens, and the saved scan.

The Express Function is configured for 300 seconds, the maximum available on Hobby plans; higher plans may allow longer durations subject to current Vercel limits and project settings. Muse Spark agent execution is bounded at 240 seconds. A SAM analysis may make up to three sequential model calls with a 90-second per-call timeout, so a worst-case run can approach the 300-second Function ceiling. The browser request timeout is 290 seconds. Provider latency can still exceed these bounds; a timeout is reported as a failed request, not a successful analysis.

There is a specific worst-case re-check limitation: after its SAM calls, a comparable re-check may also call Muse Spark to explain the comparison. Three 90-second SAM timeouts plus up to 60 seconds for the retried Muse request can exceed the 300-second Hobby Function limit, before database or Cloudinary work. The current timeouts are intentionally unchanged to avoid shortening existing behavior. Do not treat this configuration as a guarantee for that worst case. The smallest runtime-side remedy is to reduce the SAM per-call timeout/budget for re-checks or move the optional comparison explanation out of the synchronous request; alternatively, use a plan/configuration that supports a longer function and raise the client timeout accordingly.

Vercel's standard uncompressed Function bundle limit is 250 MB. The default Hobby memory allocation is 2 GB; higher plans/settings may allow more. Keep dependencies and build output within the selected plan's current limits. Image buffers and segmentation processing are in-memory and bounded by the upload/dimension limits; binary images and masks are not returned as ordinary agent API data.

## 6. CORS and previews

`CLIENT_URL` must be the exact deployed frontend origin, including `https://` and excluding a path. Configure a separate matching value for each Preview environment or use a stable custom preview domain. The backend intentionally does not allow wildcard origins. The frontend must use the backend's HTTPS origin in `VITE_API_URL`.

## 7. Build and smoke-test checklist

Before deploying, run from the repository root:

```sh
VITE_API_URL=https://api.example.invalid npm run typecheck
npm run test
npm run lint --prefix client
VITE_API_URL=https://api.example.invalid npm run build
```

The HTTPS origin above is a non-routable placeholder for local build verification; use the actual backend origin in Vercel. Production Vite builds fail clearly if `VITE_API_URL` is missing or is not an HTTPS origin.

After deploying both projects:

1. Confirm the frontend root route and refresh a nested React Router route.
2. Confirm `GET https://<backend-origin>/api/health` returns the API health response.
3. Confirm browser requests use the configured backend origin and pass CORS preflight.
4. Create an authorized crop case, upload a valid image under 4 MiB, and verify SAM analysis.
5. Upload an invalid or oversized image and verify it is rejected with a localized UI error.
6. Verify case history survives a page refresh and serverless cold/warm invocations.
7. Verify an authorized case owner can retrieve a saved scan image; missing/invalid bearer tokens and another case's scan are denied.
8. Verify Cloudinary records the image as `authenticated`; confirm public/unauthenticated delivery is denied and the API does not return a Cloudinary delivery URL.
9. Verify agent reports retain uncertainty, citations, and null/unavailable measurements where evidence is missing; do not infer treatment success from image comparisons.
10. Check Vercel Function logs for sanitized initialization/provider errors only, and confirm no API keys or image bytes are logged.

## Troubleshooting

- **Function reports missing production configuration:** set every required backend variable in the correct Vercel environment and redeploy.
- **Frontend build rejects API configuration:** set `VITE_API_URL` to the backend's HTTPS origin without a path, then rebuild.
- **MongoDB connection fails:** validate `MONGODB_URI`, Atlas database credentials, TLS, region, and the Vercel egress allowlist; do not disable authentication or allow all IPs.
- **Browser CORS error:** make `CLIENT_URL` exactly match the browser's frontend origin and set `VITE_API_URL` to the backend origin; redeploy both projects after changing values.
- **Image upload gets HTTP 413:** keep the original file at or below 4 MiB. Multipart envelope/metadata consumes additional request space.
- **Analysis reaches a timeout:** SAM and Muse requests have bounded duration, and Vercel applies the configured maximum. Retry only after checking Function duration and provider latency; do not raise limits beyond the selected plan.
- **Slow re-check exceeds 300 seconds:** the synchronous SAM-plus-Muse path can exceed the Hobby limit in the worst case; shorten its time budget or make comparison explanation asynchronous before relying on that latency bound.
- **Image download fails:** confirm the case-owner bearer token, scan membership, Cloudinary authenticated delivery type, and server-side credentials. Do not make the asset public as a workaround.
- **System prompt cannot be read:** confirm the backend project uses the checked-in `server/vercel.json` and that the deployment includes `src/agent/systemPrompt.md`.

This repository configuration and local build checks do not prove a production deployment works. Complete the smoke tests against the actual deployed frontend, backend, MongoDB Atlas, Cloudinary, and Meta API before announcing production readiness.

## Official references

- [Vercel Vite framework](https://vercel.com/docs/frameworks/frontend/vite)
- [Vercel Express framework](https://vercel.com/docs/frameworks/backend/express)
- [Vercel Function limitations](https://vercel.com/docs/functions/limitations)

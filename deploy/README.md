# Deployment (DEC-19): Vercel + Azure App Service + Supabase

```
Browser ──► Vercel (Next.js, frontend/) ──NEXT_PUBLIC_API_URL──► Azure App Service (one container)
                                                                 ├─ Node gateway  :8080 (public, HTTPS)
Sarvam voice agent ──► /api/agent/answer ───────────────────────►│
                                                                 └─ RAG :8000 on 127.0.0.1 (never public)
                                                                      │
                                              Supabase Postgres (Mumbai) · Groq · Sarvam APIs
```

Why: the RAG needs ~0.9 GB RAM (free 512 MB tiers fail); Hugging Face Docker Spaces need PRO. Azure for
Students (GitHub Student Developer Pack) gives $100 credit without a card; App Service B1 (1.75 GB) uses
about $13/month of it, always on, HTTPS included, Central India next to Supabase.

## One-time setup

1. **Azure:** activate Azure for Students (education.github.com/pack → Microsoft Azure), then
   `sudo pacman -S azure-cli` and `az login --use-device-code`.
2. **Image:** pushing to `dev` runs `.github/workflows/backend-image.yml` (backend tests, then build) and
   publishes `ghcr.io/<owner>/gramsahayak-backend`. Once, on GitHub → your profile → Packages →
   `gramsahayak-backend` → Package settings → Change visibility → **Public** (Azure pulls it without a token).
3. **Backend:** `bash deploy/azure.sh` → prints `https://gramsahayak-api.azurewebsites.net` (or your
   `AZ_APP` name) and stores the voice-agent token in the root `.env` as `AGENT_TOOL_TOKEN`.
4. **Frontend:** `vercel login`, then from `frontend/`: `vercel link`, set the env and deploy:
   ```bash
   vercel env add NEXT_PUBLIC_API_URL production     # https://<app>.azurewebsites.net
   vercel env add NEXT_PUBLIC_USE_MOCKS production   # false
   vercel --prod
   ```
5. **CORS:** `FRONTEND_ORIGIN=https://<project>.vercel.app bash deploy/azure.sh` (re-run is safe).
6. **Phone calls:** `docs/sarvam-voice-agent.md`.

## Updating

Push to `dev` → the workflow builds a new image → `az webapp restart -g gramsahayak-rg -n gramsahayak-api`
(or re-run `deploy/azure.sh`). Frontend: Vercel redeploys on push when the project is linked to GitHub,
or run `vercel --prod` again.

## Checks

```bash
curl -s https://<app>.azurewebsites.net/api/health          # db postgres ok, rag ok (45 vectors), sarvam configured
bash scripts/e2e.sh https://<app>.azurewebsites.net            # P0 flows against the deployed backend
az webapp log tail -g gramsahayak-rg -n gramsahayak-api      # container logs
```

## Limits

- The container has no persistent disk: uploaded circulars (`/api/schemes/ingest`) and the Chroma index
  are rebuilt from `data/seed` on restart. Sessions, profiles and logs live in Supabase.
- One B1 instance: fine for a demo and judging; the in-memory IVR call state and TTS cache assume one instance.
- Keep `bash scripts/start-demo.sh --lan` as the offline fallback.

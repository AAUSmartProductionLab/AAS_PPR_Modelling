# Setup, How It Works & Issue Log

Living document for getting **ARSO_Ontology_AAS_Generation** running and tracking problems
encountered along the way. Add a row to the [Issue log](#issue-log) whenever something breaks
and is fixed.

---

## 1. How it works

This project generates and validates **Asset Administration Shells (AAS)** from technical
documentation, grounded in the ARSO ontology and SHACL constraints. It has two runtime
processes:

```
┌─────────────────┐     /api/*  (Vite proxy)      ┌──────────────────────┐
│  UI (Vite/React)│ ────────────────────────────▶ │  FastAPI  (api.main) │
│  localhost:5173 │                                │   localhost:8000     │
└─────────────────┘                                └──────────┬───────────┘
                                                              │ imports
                          ┌───────────────────────────────────┼───────────────────────────┐
                          ▼                                    ▼                           ▼
                  Generation/  (LLM pipeline)        Transformation/  (profile→AAS→RDF)   Validation/ (pyshacl)
```

- **UI** ([ui/](../ui)) — React 19 + Vite + Zustand + @xyflow/react. Talks to the backend
  through the dev-server proxy in [ui/vite.config.ts](../ui/vite.config.ts): `/api` →
  `http://localhost:8000`. The client ([ui/src/api/client.ts](../ui/src/api/client.ts)) uses
  only `/api/*`. The `/n8n-webhook` proxy entry is **unused** — no n8n is required.
- **Backend** ([api/main.py](../api/main.py)) — FastAPI app exposing:
  - `GET  /health` → `{"status":"ok"}`
  - `POST /api/validate` ([api/routers/validate.py](../api/routers/validate.py)) — runs
    pyshacl (AAS metamodel + ARSO domain shapes) on posted AAS JSON. **No API key needed.**
  - `POST /api/generate-aas` ([api/routers/generate_aas.py](../api/routers/generate_aas.py)) —
    SSE-streaming generation pipeline. Needs a valid provider API key.
  - `GET  /api/generation-config` — provider + model lists read from `Generation/config.yaml`
    (keys are never returned to the client).
- **Pipeline** ([Generation/pipeline.py](../Generation/pipeline.py)) — builds LLM context,
  calls the provider, parses the profile, expands it to full AAS JSON
  ([Transformation/](../Transformation)), projects to RDF, and validates against SHACL
  ([Validation/Validator/validator.py](../Validation/Validator/validator.py)), retrying on
  failures up to `max_attempts`.

### Configuration & providers
All runtime config lives in **`Generation/config.yaml`** (loaded by
[Generation/config.py](../Generation/config.py)). It selects the LLM `provider`
(`gemini` | `groq` | `claude`), holds the API keys, lists fallback models tried in order on
rate limits, and sets generation options. The backend `sys.exit()`s on startup of a request
if this file is missing, so it is **mandatory**.

> **The new package layout is already wired up.** The repo was restructured from a flat
> `generation/` folder (in `AP2030-UNS/ppr-ontology`) into packages `Generation/`,
> `Transformation/`, `Validation/`, `Guidance/`, `api/`. The Python imports already match the
> new layout — the "won't run" problem was missing untracked files, not broken imports.

---

## 2. Prerequisites

- **Python 3.11+** (3.12 fine) on `PATH`.
- **Node.js 18+ or 20+** with npm.
- A provider API key (Groq or Gemini) if you want live AAS *generation*. Validation works
  without any key.

---

## 3. Quick start

### Scripted (Windows / PowerShell)
```powershell
# from the repo root
./scripts/setup.ps1     # creates .venv, installs Python + UI deps
./scripts/run-api.ps1   # terminal 1 — FastAPI on :8000
./scripts/run-ui.ps1    # terminal 2 — Vite UI on :5173
```
Then open http://localhost:5173.

### Manual equivalent
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

# config: copy the template and add keys (already present if copied from source)
copy Generation\config.example.yaml Generation\config.yaml   # then edit keys

# backend (run from repo root so `api.main` resolves)
uvicorn api.main:app --reload --port 8000

# UI (separate terminal)
cd ui
npm install
npm run dev
```

---

## 4. Provider notes

- Switch providers by editing `provider:` in `Generation/config.yaml`
  (`gemini` / `groq` / `claude`).
- Each provider has an ordered `models:` list; the pipeline cycles to the next model on a
  429 / rate-limit. The UI fetches these via `GET /api/generation-config`.
- **Groq** (default) and **Gemini** need keys in `api_keys`. **Claude** can use the local
  Claude Code CLI auth, so its key is optional.
- `options.use_example: true` adds ~4k tokens of context — disable on the Groq free tier.

---

## 5. Security note

- `Generation/config.yaml` holds **live API keys** and is **gitignored** (see
  [.gitignore](../.gitignore)). Never commit it. Commit `Generation/config.example.yaml`
  instead.
- The keys copied from the source repo were stored there in plaintext. **Rotate them** if the
  source repo was ever pushed to a remote you don't fully control.

---

## 6. Issue log

| # | Symptom | Cause | Fix |
|---|---------|-------|-----|
| 1 | `pip install -r requirements.txt` fails — no such file | `requirements.txt` not carried over in the restructure (source split it into `generation/requirements.txt` + `api/requirements-api.txt`) | Created merged [requirements.txt](../requirements.txt) at repo root |
| 2 | Backend exits on any generation/config request: `ERROR: config file not found` | `Generation/config.yaml` missing; `load_config()` calls `sys.exit()` ([config.py:83](../Generation/config.py#L83)) | Copied `config.yaml` from source (paths fixed to new casing, `pdf_path: null`); added committable `config.example.yaml` |
| 3 | Risk of committing API keys | New repo `.gitignore` didn't exclude `config.yaml` | Added `Generation/config.yaml` + `Generation/output/` to [.gitignore](../.gitignore) |
| 4 | Profile example template not found (degraded prompt quality) | `aas_configs/` referenced by `profile_example_path` was missing (non-fatal — code falls back) | Copied `aas_configs/` (imaDispensing.yaml, imaLoadingSystem.yaml) from source |
| 5 | Output path may not exist | `Generation/output/` missing | Created `Generation/output/` with `.gitkeep` |
| 6 | Backend import crash: `ModuleNotFoundError: No module named 'Generation.Context_Builder.Parsing.config'` | **Real leftover-from-restructure bug** — `pdf_extractor.py` used `from .config import Config` (valid in the old flat layout). In the new package layout `config` lives 3 levels up | Changed to `from ...config import Config` ([pdf_extractor.py:13](../Generation/Context_Builder/Parsing/pdf_extractor.py#L13)) — matches its sibling `json_description_generation.py`. This was the **only** broken import |
| 7 | `npm run build` fails (strict TS) | `SubmodelAdvancedPanel.tsx` lookup records missing the `AIMC` key (submodel added later); two dead symbols in `parseAasToProfile.ts` (`elsByIdShort`, `MLP_FIELDS`) | Added `AIMC` entries (+ `AIMC_SUBMODEL` import); removed the dead code. `npm run build` now passes. Note: `npm run dev` was never blocked — Vite uses esbuild and skips typechecking |
| 8 | UI unreachable at `http://127.0.0.1:5173` (connection refused) | Vite v5 binds to IPv6 `localhost` (`::1`) only, not `127.0.0.1` | Use **`http://localhost:5173`** (or `::1`). Not a bug — just the address to use |

_Add new issues below as they come up._

### Verification results (2026-06-29)
All checks passed on Python 3.12.4 / Node 24.16.0:
- `import api.main` → OK (after fix #6)
- `GET /health` → `{"status":"ok"}`
- `GET /api/generation-config` → providers `[gemini, groq, claude]`, default `groq`, model lists present
- `POST /api/validate` (test case `invalid_missing_nameplate.aas.json`) → `conforms: false`, 4 structured SHACL violations — ontology/SHACL files resolve, no API key needed
- `npm run build` → clean; `npm run dev` → serves on `http://localhost:5173`
- `/api/generate-aas` (live LLM) not exercised to avoid spending API quota; its full import + transform + validate chain is covered by the above

---

## 7. Verification checklist

1. `./scripts/setup.ps1` completes; `.venv/` and `ui/node_modules/` exist.
2. Backend imports resolve: from repo root, `.\.venv\Scripts\python -c "import api.main"`
   (this is the real test that the restructured imports + deps work).
3. `uvicorn api.main:app --port 8000` starts; `GET http://localhost:8000/health` →
   `{"status":"ok"}`.
4. `GET http://localhost:8000/api/generation-config` returns provider/model lists
   (proves `config.yaml` loads).
5. `POST /api/validate` with a file from
   [Testing/SHACL_Tests/Test_Cases/](../Testing/SHACL_Tests/Test_Cases) returns a structured
   report (proves SHACL/ontology files resolve — no API key needed).
6. `npm run dev` serves the UI; validate flow round-trips through the proxy.
7. `git status` does **not** list `Generation/config.yaml`.

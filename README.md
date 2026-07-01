# AAS_PPR_Modelling Framework

Ontology-grounded modelling, generation, and validation of Asset Administration Shells (AAS).
A FastAPI backend serves SHACL validation and LLM generation; a React/Vite editor lets you build
**Resource** AAS (validated against the ARSO ontology) and **Product** AAS (validated against APSO)
visually, with live per-AAS validation.

---

## Prerequisites

- **Python** 3.11+ (3.12 fine)
- **Node.js** 18+ or 20+ (with npm)
- An LLM API key (Groq or Gemini) **only** if you want AI generation — validation works without one.

## Configure (one-time)

Copy the config template and add your keys:

```bash
cp Generation/config.example.yaml Generation/config.yaml   # then edit api_keys
```

`Generation/config.yaml` is gitignored (it holds API keys) — never commit it.

## Run

The app is two processes: the **API** (port 8000) and the **UI** (port 5173).

### Windows (PowerShell) — helper scripts

```powershell
./scripts/setup.ps1     # once: create .venv, install Python + UI deps
./scripts/run-backend.ps1   # terminal 1 — FastAPI on http://localhost:8000
./scripts/run-frontend.ps1    # terminal 2 — Vite UI on http://localhost:5173
```

### Manual (any OS)

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate   |   Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt

uvicorn api.main:app --reload --port 8000     # run from the repo root

cd ui && npm install && npm run dev           # separate terminal
```

Then open **http://localhost:5173** (use `localhost`, not `127.0.0.1` — Vite binds IPv6).
The UI proxies `/api/*` to the backend on port 8000.

### Docker

```bash
cp Generation/config.example.yaml Generation/config.yaml   # then edit api_keys
docker compose up --build
```

Open **http://localhost:5173**. Source code is volume-mounted — hot-reload works for both services.

> Regenerate SHACL shapes after editing an ontology:
> `python Transformation/Generate_Shapes/generate_shapes.py`

More detail and a troubleshooting log live in [docs/SETUP_AND_ISSUES.md](docs/SETUP_AND_ISSUES.md).

---

## What each folder does

| Folder | Purpose |
|--------|---------|
| `api/` | FastAPI backend — `/api/validate` (SHACL) and `/api/generate-aas` (LLM, SSE). |
| `Generation/` | LLM generation pipeline, prompts, context building, and `config.yaml`. |
| `Transformation/` | Profile → full AAS JSON builder, AAS JSON → RDF projection, and SHACL shape generation from the ontologies. |
| `Validation/` | Type-aware SHACL validation — Resource → ARSO shapes, Product → APSO shapes. |
| `Guidance/` | Ontology guidance for the LLM, driven by the real validator. |
| `Ontology/` | `ARSO/` (Resource) and `APSO/` (Product) ontologies, `AAS/` + `CSS/` imports, and `SHACL/` (generated + manual shapes). |
| `ui/` | React/Vite model-builder editor (drag-and-drop AAS/submodel graph, live validation). |
| `Testing/` | SHACL conformance test cases and LLM generation evaluation scripts. |
| `aas_configs/` | Example AAS profile templates. |
| `scripts/` | Windows PowerShell helpers (`setup`, `run-api`, `run-ui`). |
| `docs/` | Setup/troubleshooting and design/implementation notes. |
| `images/` | Diagrams referenced by the docs. |

---

## Licence

MIT. Supported by **Novo Nordisk AMSAT**.

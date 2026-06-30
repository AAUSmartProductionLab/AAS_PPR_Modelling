"""POST /api/guidance

Returns the ontology-guided, one-click *fixes* for a partial profile — the same
imperative repairs the generation builder applies (auto-create Skills from AID
actions, generate Capabilities from Skills, fill missing semantic_id /
realizedBy / interface). Unlike /api/validate (which reports what is wrong), this
returns suggestions with a ``proposed_value`` the UI can apply directly to the
profile.

The request carries the *profile* document ({ "<systemId>": { ...sections... } }),
i.e. the same shape the editor holds in ``parsedProfile`` — NOT a full AAS
Environment. Field paths in the response are dot-paths under the system body.
"""
from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

_PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

router = APIRouter()


class GuidanceRequest(BaseModel):
    # Profile document: { "<systemId>": { idShort, id, AID, Skills, ... } }
    profile_json: str
    # Reserved for parity with /api/validate; guidance is currently ARSO/Resource.
    aas_type: str = "Resource"
    # Optional explicit base URL for proposed semantic-id / capability URIs.
    base_url: Optional[str] = None


class GuidanceSuggestion(BaseModel):
    field: str
    action: str                       # "auto-create" | "fill" | "add"
    description: str
    proposed_value: Any | None = None


class GuidanceResponse(BaseModel):
    system_id: str
    suggestions: list[GuidanceSuggestion]


@router.post("/guidance", response_model=GuidanceResponse)
async def guidance(req: GuidanceRequest) -> GuidanceResponse:
    try:
        parsed = json.loads(req.profile_json)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail=f"profile_json is not valid JSON: {exc}")

    if not isinstance(parsed, dict) or not parsed:
        raise HTTPException(
            status_code=400,
            detail="profile_json must be a non-empty object { '<systemId>': { ... } }.",
        )

    first_value = next(iter(parsed.values()))
    if not isinstance(first_value, dict):
        raise HTTPException(
            status_code=400,
            detail="profile root must map a system id to its config object.",
        )

    try:
        from Transformation.AAS_Builder.AAS_generation.core.generate_aas import AASGenerator
    except Exception as exc:  # pragma: no cover - import/env issue
        raise HTTPException(status_code=500, detail=f"guidance engine unavailable: {exc}")

    # Build a throwaway generator from the posted profile, then compute the
    # imperative fixes. The generator mutates its own copy of the config only;
    # the caller's editor state is untouched.
    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            config_path = Path(tmpdir) / "profile.json"
            config_path.write_text(json.dumps(parsed, ensure_ascii=False), encoding="utf-8")
            generator = AASGenerator(str(config_path), base_url_override=req.base_url)
            suggestions = generator.compute_guidance(actionable_only=True)
            system_id = generator.system_id
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"guidance computation failed: {exc}")

    return GuidanceResponse(
        system_id=system_id,
        suggestions=[GuidanceSuggestion(**s) for s in suggestions],
    )

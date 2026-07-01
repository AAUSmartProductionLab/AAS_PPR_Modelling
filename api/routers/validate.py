"""Validation endpoints.

POST /api/validate         — validate a full AAS Environment JSON directly.
POST /api/validate-profile — validate a UI *profile* by building the full AAS
                             server-side with the canonical Python builders first
                             (the manual-modelling source of truth), then SHACL.

Both run unified pyshacl validation (AAS metamodel SHACL plus the domain shapes
for that type — ARSO for Resource, APSO for Product) and return structured issues.
"""
from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path

from fastapi import APIRouter, HTTPException

_PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

from api.models import (  # noqa: E402
    ValidateProfileRequest,
    ValidateProfileResponse,
    ValidateRequest,
    ValidateResponse,
    ValidationIssue,
)
from Validation.Validator.validator import run_shacl, run_shacl_on_dict  # noqa: E402
from Validation.message_field_map import map_issue_to_field  # noqa: E402

router = APIRouter()


def _issues_from_shacl(all_issues: list[dict]) -> list[ValidationIssue]:
    """Dedupe by message and attach a field anchor to each SHACL issue."""
    issues: list[ValidationIssue] = []
    seen: set[str] = set()
    for issue in all_issues:
        message = issue.get("message", "No message")
        if message in seen:
            continue
        seen.add(message)
        focus_node = issue.get("focus_node") or ""
        result_path = issue.get("result_path") or ""
        issues.append(ValidationIssue(
            severity=issue.get("severity", "Violation"),
            message=message,
            field=map_issue_to_field(message, focus_node, result_path),
            focus_node=focus_node or None,
            result_path=result_path or None,
        ))
    return issues


def _run_validation(aas_json: str, aas_type: str) -> tuple[bool, list[ValidationIssue], str]:
    """Validate AAS JSON string via SHACL (disk-backed, for /api/validate endpoint)."""
    import json as _json
    document = _json.loads(aas_json)
    return _run_validation_on_dict(document, aas_type)


def _run_validation_on_dict(aas_dict: dict, aas_type: str) -> tuple[bool, list[ValidationIssue], str]:
    """Validate an AAS Environment dict via SHACL (in-memory, no disk round-trip)."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)
        try:
            conforms, all_issues, _meta, _onto = run_shacl_on_dict(aas_dict, tmp, aas_type)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"validation error: {exc}")

        issues = _issues_from_shacl(all_issues)
        report_path = tmp / "report.ttl"
        report_ttl = report_path.read_text(encoding="utf-8") if report_path.exists() else ""
    return conforms, issues, report_ttl


@router.post("/validate", response_model=ValidateResponse)
async def validate_aas(req: ValidateRequest) -> ValidateResponse:
    conforms, issues, report_ttl = _run_validation(req.json_text, req.aas_type)
    return ValidateResponse(conforms=conforms, issues=issues, report_ttl=report_ttl)


@router.post("/validate-profile", response_model=ValidateProfileResponse)
async def validate_profile(req: ValidateProfileRequest) -> ValidateProfileResponse:
    try:
        parsed = json.loads(req.profile_json)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail=f"profile_json is not valid JSON: {exc}")
    if not isinstance(parsed, dict) or not parsed:
        raise HTTPException(
            status_code=400,
            detail="profile_json must be a non-empty object { '<systemId>': { ... } }.",
        )
    if not isinstance(next(iter(parsed.values())), dict):
        raise HTTPException(
            status_code=400,
            detail="profile root must map a system id to its config object.",
        )

    # Build the full AAS from the profile with the canonical Python builders.
    try:
        from Transformation.AAS_Builder.AAS_generation.core.generate_aas import AASGenerator

        with tempfile.TemporaryDirectory() as tmpdir:
            cfg_path = Path(tmpdir) / "profile.json"
            cfg_path.write_text(json.dumps(parsed, ensure_ascii=False), encoding="utf-8")
            generator = AASGenerator(str(cfg_path), base_url_override=req.base_url)
            aas_dict = generator.build_aas_dict(apply_guidance=False)
        aas_json = json.dumps(aas_dict, ensure_ascii=False)
    except Exception as exc:
        return ValidateProfileResponse(
            conforms=False,
            issues=[ValidationIssue(severity="Violation", message=f"AAS build failed: {exc}")],
            report_ttl="",
            aas_json="",
        )

    conforms, issues, report_ttl = _run_validation_on_dict(aas_dict, req.aas_type)
    return ValidateProfileResponse(
        conforms=conforms, issues=issues, report_ttl=report_ttl, aas_json=aas_json
    )

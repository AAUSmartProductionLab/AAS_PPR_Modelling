"""POST /api/validate

Accepts AAS JSON plus an aas_type ("Resource" | "Product"), runs unified pyshacl
validation (AAS metamodel SHACL plus the domain shapes for that type — ARSO for
Resource, APSO for Product), and returns structured issues.
"""
from __future__ import annotations

import sys
import tempfile
from pathlib import Path

from fastapi import APIRouter, HTTPException

_PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

from api.models import ValidateRequest, ValidateResponse, ValidationIssue  # noqa: E402
from Validation.Validator.validator import run_shacl  # noqa: E402
from Validation.message_field_map import map_message_to_field  # noqa: E402

router = APIRouter()


@router.post("/validate", response_model=ValidateResponse)
async def validate_aas(req: ValidateRequest) -> ValidateResponse:
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)
        try:
            conforms, all_issues, _meta, _onto = run_shacl(req.json_text, tmp, req.aas_type)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"validation error: {exc}")

        issues: list[ValidationIssue] = []
        seen: set[str] = set()
        for issue in all_issues:
            message = issue.get("message", "No message")
            if message in seen:
                continue
            seen.add(message)
            issues.append(ValidationIssue(
                severity=issue.get("severity", "Violation"),
                message=message,
                field=map_message_to_field(message),
                focus_node=issue.get("focus_node") or None,
                result_path=None,
            ))

        report_path = tmp / "report.ttl"
        report_ttl_text = report_path.read_text(encoding="utf-8") if report_path.exists() else ""

    return ValidateResponse(conforms=conforms, issues=issues, report_ttl=report_ttl_text)

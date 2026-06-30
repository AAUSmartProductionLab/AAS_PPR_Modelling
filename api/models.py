from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class ValidateRequest(BaseModel):
    json_text: str
    # "Resource" -> ARSO shapes, "Product" -> APSO shapes. Defaults to Resource
    # so existing callers keep working unchanged.
    aas_type: str = "Resource"


class ValidateProfileRequest(BaseModel):
    """Validate a UI *profile* ({ "<systemId>": { ...sections... } }) by building
    the full AAS server-side with the canonical Python builders, then running
    SHACL. This is the manual-modelling path's source of truth."""
    profile_json: str
    aas_type: str = "Resource"
    base_url: Optional[str] = None


class ValidationIssue(BaseModel):
    severity: str
    message: str
    field: str = ""
    focus_node: str | None = None
    result_path: str | None = None


class ValidateResponse(BaseModel):
    conforms: bool
    issues: list[ValidationIssue]
    report_ttl: str


class ValidateProfileResponse(ValidateResponse):
    # The full AAS Environment JSON the server built from the profile, so the UI
    # can preview/download exactly what was validated.
    aas_json: str = ""

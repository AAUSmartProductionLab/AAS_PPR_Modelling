from __future__ import annotations

from pydantic import BaseModel


class ValidateRequest(BaseModel):
    json_text: str
    # "Resource" -> ARSO shapes, "Product" -> APSO shapes. Defaults to Resource
    # so existing callers keep working unchanged.
    aas_type: str = "Resource"


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

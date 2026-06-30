"""
Ontology-driven SHACL guidance for the generation pipeline.

Validates a *built* AAS JSON document against the project's canonical SHACL
shapes (the same `Validation.Validator.run_shacl` used by /api/validate and the
pipeline retry loop) and turns the violations into "hint" suggestions.

The SHACL shapes are the single source of truth — no constraint logic is
duplicated here. Replaces the earlier lightweight config→RDF projection, which
emitted a vocabulary no shape targeted and therefore produced no hints.
"""
from __future__ import annotations

import tempfile
from pathlib import Path
from typing import Any

from Validation.message_field_map import map_message_to_field


def check_aas(aas_json_text: str, aas_type: str = "Resource") -> list[dict[str, Any]]:
    """Run the real SHACL validator on a built AAS JSON and return hint suggestions.

    Args:
        aas_json_text: full AAS JSON (as produced by the AAS builder).
        aas_type: "Resource" (ARSO shapes) or "Product" (APSO shapes).

    Returns:
        List of suggestion dicts: {field, action="hint", description, proposed_value}.
    """
    try:
        from Validation.Validator.validator import run_shacl
    except ImportError:
        return []

    try:
        with tempfile.TemporaryDirectory() as tmp:
            _conforms, issues, _meta, _onto = run_shacl(aas_json_text, Path(tmp), aas_type)
    except Exception:
        return []

    hints: list[dict[str, Any]] = []
    seen: set[str] = set()
    for issue in issues:
        message = issue.get("message", "")
        if message in seen:
            continue
        seen.add(message)
        hints.append({
            "field": map_message_to_field(message),
            "action": "hint",
            "description": f"[{issue.get('severity', 'Violation')}] {message}",
            "proposed_value": None,
        })
    return hints


def invalidate_shapes_cache() -> None:
    """No-op — shapes are loaded fresh by Validation.Validator.validator."""

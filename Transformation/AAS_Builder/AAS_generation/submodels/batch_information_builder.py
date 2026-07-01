"""BatchInformation submodel builder (APSO Product AAS).

Follows the APSO ontology module batch_information.ttl:
  - ProductName [Property, xs:string, 1]
  - ProductFamily [Property, xs:string, 0..1]
  - OrderNumber [Property, identifier, 0..1]
  - OrderTimestamp [Property, xs:string, 0..1]
  - Quantity [Property, xs:string, 1]
  - Packaging [Property, xs:string, 0..1]
  - Status [Property, xs:string, 1]
"""
from __future__ import annotations

from typing import Dict, Optional
from basyx.aas import model


class BatchInformationSubmodelBuilder:
    """BatchInformation submodel builder — APSO-aligned, basyx SDK based."""

    SEMANTIC_ID = "https://w3id.org/2025/apso#BatchInformationSubmodel"

    def __init__(self, base_url: str, semantic_factory, element_factory):
        self.base_url = base_url
        self.semantic_factory = semantic_factory
        self.element_factory = element_factory

    def build(self, system_id: str, config: Dict) -> Optional[model.Submodel]:
        batch_config = config.get("BatchInformation") or {}
        if not batch_config:
            return None

        elements = []

        def _add_prop(id_short: str, value: str, mandatory: bool = False) -> None:
            if value or mandatory:
                elements.append(self.element_factory.create_property(
                    id_short=id_short,
                    value=value or "",
                    value_type=model.datatypes.String,
                ))

        _add_prop("ProductName",   batch_config.get("ProductName", ""),   mandatory=True)
        _add_prop("ProductFamily", batch_config.get("ProductFamily", ""))
        _add_prop("OrderNumber",   batch_config.get("OrderNumber", ""))
        _add_prop("OrderTimestamp", batch_config.get("OrderTimestamp", ""))
        _add_prop("Quantity",      batch_config.get("Quantity", ""),      mandatory=True)
        _add_prop("Packaging",     batch_config.get("Packaging", ""))
        _add_prop("Status",        batch_config.get("Status", ""),        mandatory=True)

        return model.Submodel(
            id_=f"{self.base_url}/submodels/instances/{system_id}/BatchInformation",
            id_short="BatchInformation",
            kind=model.ModellingKind.INSTANCE,
            semantic_id=model.ExternalReference(
                key=(model.Key(type_=model.KeyTypes.GLOBAL_REFERENCE, value=self.SEMANTIC_ID),)
            ),
            administration=model.AdministrativeInformation(version="1", revision="0"),
            submodel_element=elements,
        )

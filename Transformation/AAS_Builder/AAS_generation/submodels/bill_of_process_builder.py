"""Bill of Process submodel builder (APSO Product AAS).

Follows the APSO ontology module bill_of_process.ttl:
  - RecipeId [Property, 1]
  - Processes [SML, 1] containing Process strings, Process SMCs, etc.
"""
from __future__ import annotations

from typing import Dict, Optional
from basyx.aas import model


class BillOfProcessSubmodelBuilder:
    """BoP submodel builder — APSO-aligned, basyx SDK based."""

    SEMANTIC_ID = "https://w3id.org/2025/apso#BillOfProcessSubmodel"

    def __init__(self, base_url: str, semantic_factory, element_factory):
        self.base_url = base_url
        self.semantic_factory = semantic_factory
        self.element_factory = element_factory

    def build(self, system_id: str, config: Dict) -> Optional[model.Submodel]:
        bop_config = config.get("BillOfProcess") or {}
        if not bop_config:
            return None

        elements = []

        # RecipeId (mandatory)
        elements.append(self.element_factory.create_property(
            id_short="RecipeId",
            value=bop_config.get("RecipeId", system_id),
            value_type=model.datatypes.String,
        ))

        # Processes as SML
        process_entries = bop_config.get("Processes", []) or []
        if isinstance(process_entries, list) and process_entries:
            sml_elements = []
            for i, proc in enumerate(process_entries):
                if not isinstance(proc, dict):
                    continue
                proc_type = proc.get("type", "ProcessSMC")

                if proc_type == "ProcessProperty":
                    sml_elements.append(self.element_factory.create_property(
                        id_short=proc.get("idShort", f"Process_{i}"),
                        value=proc.get("value", ""),
                        value_type=model.datatypes.String,
                    ))
                elif proc_type == "ProcessSMC":
                    smc_elements = []
                    smc_elements.append(self.element_factory.create_property(
                        id_short="processId", value=proc.get("processId", f"P{i}"),
                        value_type=model.datatypes.String,
                    ))
                    smc_elements.append(self.element_factory.create_property(
                        id_short="semanticId", value=proc.get("semanticId", ""),
                        value_type=model.datatypes.String,
                    ))
                    smc_elements.append(self.element_factory.create_property(
                        id_short="sequenceNumber", value=str(proc.get("sequenceNumber", i + 1)),
                        value_type=model.datatypes.String,
                    ))
                    if proc.get("description"):
                        smc_elements.append(self.element_factory.create_property(
                            id_short="description", value=proc["description"],
                            value_type=model.datatypes.String,
                        ))
                    if proc.get("estimatedDuration"):
                        dur = proc["estimatedDuration"]
                        if isinstance(dur, dict):
                            dur_elements = [
                                self.element_factory.create_property(
                                    id_short="value", value=str(dur.get("value", "")),
                                    value_type=model.datatypes.String,
                                ),
                            ]
                            if dur.get("semanticId"):
                                dur_elements.append(self.element_factory.create_property(
                                    id_short="semanticId", value=dur["semanticId"],
                                    value_type=model.datatypes.String,
                                ))
                            smc_elements.append(model.SubmodelElementCollection(
                                id_short="estimatedDuration", value=dur_elements,
                            ))
                    sml_elements.append(model.SubmodelElementCollection(
                        id_short=proc.get("idShort", f"Process_{i}"),
                        value=smc_elements,
                    ))

            if sml_elements:
                # Determine typeValueListElement for the SML
                first_type = process_entries[0].get("type", "ProcessSMC") if process_entries else "ProcessSMC"
                type_map = {"ProcessProperty": "Property", "ProcessSMC": "SubmodelElementCollection"}
                elements.append(model.SubmodelElementList(
                    id_short="Processes",
                    type_value_list_element=type_map.get(first_type, "SubmodelElementCollection"),
                    value=sml_elements,
                ))

        return model.Submodel(
            id_=f"{self.base_url}/submodels/instances/{system_id}/BillOfProcess",
            id_short="BillOfProcess",
            kind=model.ModellingKind.INSTANCE,
            semantic_id=model.ExternalReference(
                key=(model.Key(type_=model.KeyTypes.GLOBAL_REFERENCE, value=self.SEMANTIC_ID),)
            ),
            administration=model.AdministrativeInformation(version="1", revision="0"),
            submodel_element=elements,
        )

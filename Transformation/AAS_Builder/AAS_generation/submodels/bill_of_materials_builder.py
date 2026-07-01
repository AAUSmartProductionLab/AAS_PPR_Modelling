"""Bill of Materials submodel builder (APSO Product AAS).

Follows the APSO ontology module bill_of_materials.ttl:
  - EntryNode [Entity, 1]
  - ArcheType [Property/string, 1]
  - JointConnection [AnnotatedRelationshipElement, 0..*]
  - JointParams [SMC, 0..*]
"""
from __future__ import annotations

from typing import Dict, Optional
from basyx.aas import model


class BillOfMaterialsSubmodelBuilder:
    """BoM submodel builder — APSO-aligned, basyx SDK based."""

    SEMANTIC_ID = "https://w3id.org/2025/apso#BillOfMaterialsSubmodel"

    def __init__(self, base_url: str, semantic_factory, element_factory):
        self.base_url = base_url
        self.semantic_factory = semantic_factory
        self.element_factory = element_factory

    def build(self, system_id: str, config: Dict) -> Optional[model.Submodel]:
        bom_config = config.get("BillOfMaterials") or {}
        if not bom_config:
            return None

        elements = []

        # EntryNode (Entity, mandatory)
        entry_id = bom_config.get("EntryNodeId", f"{self.base_url}/entities/{system_id}/EntryNode")
        elements.append(model.Entity(
            id_short="EntryNode",
            entity_type=model.EntityType.SELF_MANAGED_ENTITY,
            global_asset_id=entry_id,
        ))

        # ArcheType (Property, mandatory)
        archetype = bom_config.get("ArcheType", "OneUpAndOneDown")
        elements.append(self.element_factory.create_property(
            id_short="ArcheType",
            value=archetype,
            value_type=model.datatypes.String,
        ))

        # JointConnections
        for jc_name, jc in (bom_config.get("JointConnections") or {}).items():
            if not isinstance(jc, dict):
                continue
            first_ref = jc.get("first", "")
            second_ref = jc.get("second", "")
            joint_type = jc.get("jointType", "")
            joint_params_ref = jc.get("jointParamsRef", "")

            annotations = []
            if joint_params_ref:
                annotations.append(model.ReferenceElement(
                    id_short="JointParamsRef",
                    value=model.ModelReference(
                        key=(model.Key(type_=model.KeyTypes.SUBMODEL_ELEMENT_COLLECTION, value=joint_params_ref),),
                        type_=model.SubmodelElementCollection,
                    ),
                ))
            if joint_type:
                annotations.append(self.element_factory.create_property(
                    id_short="JointType", value=joint_type,
                    value_type=model.datatypes.String,
                ))
            if jc.get("jointStandard"):
                annotations.append(self.element_factory.create_property(
                    id_short="JointStandard", value=jc["jointStandard"],
                    value_type=model.datatypes.String,
                ))

            elements.append(model.AnnotatedRelationshipElement(
                id_short=jc_name,
                first=model.ModelReference(
                    key=(model.Key(type_=model.KeyTypes.ENTITY, value=first_ref),),
                    type_=model.Entity,
                ),
                second=model.ModelReference(
                    key=(model.Key(type_=model.KeyTypes.ENTITY, value=second_ref),),
                    type_=model.Entity,
                ),
                annotation=annotations if annotations else None,
            ))

        # JointParams
        for jp_name, jp in (bom_config.get("JointParams") or {}).items():
            if not isinstance(jp, dict):
                continue
            jp_elements = []
            for tp_name, tp_val in (jp.get("typeParams") or {}).items():
                if isinstance(tp_val, dict):
                    jp_elements.append(self.element_factory.create_property(
                        id_short=tp_name, value=str(tp_val.get("value", "")),
                        value_type=model.datatypes.String,
                    ))
            if jp.get("typeFile"):
                jp_elements.append(model.File(
                    id_short="TypeFile",
                    content_type=jp.get("typeFileContentType", "application/octet-stream"),
                    value=jp["typeFile"],
                ))
            if jp_elements:
                elements.append(model.SubmodelElementCollection(
                    id_short=jp_name, value=jp_elements,
                ))

        return model.Submodel(
            id_=f"{self.base_url}/submodels/instances/{system_id}/BillOfMaterials",
            id_short="BillOfMaterials",
            kind=model.ModellingKind.INSTANCE,
            semantic_id=model.ExternalReference(
                key=(model.Key(type_=model.KeyTypes.GLOBAL_REFERENCE, value=self.SEMANTIC_ID),)
            ),
            administration=model.AdministrativeInformation(version="1", revision="0"),
            submodel_element=elements,
        )

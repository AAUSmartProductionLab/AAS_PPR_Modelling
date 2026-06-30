/**
 * Single source of truth for every submodel the editor knows about.
 *
 * One entry per submodel carries everything the rest of the app needs — the
 * profile (YAML) key, the built idShort, the semantic id, catalog presentation,
 * which AAS types it applies to, and the builder that turns a profile section
 * into a full AAS Submodel. All the previously-parallel lookup tables
 * (ALL_SUBMODELS, SUBMODEL_YAML_KEYS, SUBMODEL_META, SUBMODEL_IDSHORT, ...) are
 * now DERIVED from this map, so adding a submodel is a single edit here (plus
 * the SubmodelKey union, which TypeScript enforces via Record<SubmodelKey, …>).
 */
import type { AasSubmodel } from './types';
import type { SubmodelKey, AASType, AASNodeState } from '../store/useAppStore';

import { buildNameplateSubmodel } from './builders/nameplate';
import { buildHierarchicalStructuresSubmodel } from './builders/hierarchicalStructures';
import { buildAIDSubmodel } from './builders/aid';
import { buildSkillsSubmodel } from './builders/skills';
import { buildCapabilitiesSubmodel } from './builders/capabilities';
import { buildOperationalDataSubmodel } from './builders/operationalData';
import { buildParametersSubmodel } from './builders/parameters';
import { buildAIMCSubmodel } from './builders/aimc';
import {
  DIGITAL_NAMEPLATE_SUBMODEL,
  HIERARCHICAL_STRUCTURES,
  AID_SUBMODEL,
  SKILLS_SUBMODEL,
  CAPABILITIES_SUBMODEL,
  OPERATIONAL_DATA_SUBMODEL,
  PARAMETERS_SUBMODEL,
  AIMC_SUBMODEL,
} from './semanticIds';

/** Context passed to a submodel builder. `section` is the profile slice under `yamlKey`. */
export interface BuildContext {
  baseUrl: string;
  systemId: string;
  section: unknown;
  meta?: { id?: string; semanticId?: string };
  node: AASNodeState;
}

export interface SubmodelDef {
  /** Key in the profile / system config (e.g. 'DigitalNameplate', 'Variables'). */
  yamlKey: string;
  /** idShort the builder emits — must match the built Submodel for round-tripping. */
  idShort: string;
  /** idShorts recognised when importing an AAS back into a profile (built idShort + aliases). */
  importIdShorts: string[];
  /** Default submodel semantic id. */
  semanticId: string;
  /** Catalog label + description + colour. */
  label: string;
  description: string;
  color: string;
  /** AAS types this submodel may appear on. */
  aasTypes: AASType[];
  /** Always present on a new AAS of an applicable type. */
  required?: boolean;
  /** Build the full AAS Submodel from the profile section. */
  build: (ctx: BuildContext) => AasSubmodel;
  /** Hide from catalog UI (backend not yet implemented). */
  hidden?: boolean;
}

// Typed casts mirror the original buildSubmodels call sites.
type NameplateArg = Parameters<typeof buildNameplateSubmodel>[2];
type HierArg = Parameters<typeof buildHierarchicalStructuresSubmodel>[4];
type AIDArg = Parameters<typeof buildAIDSubmodel>[2];
type SkillsArg = Parameters<typeof buildSkillsSubmodel>[2];
type CapsArg = Parameters<typeof buildCapabilitiesSubmodel>[2];
type VarsArg = Parameters<typeof buildOperationalDataSubmodel>[2];
type ParamsArg = Parameters<typeof buildParametersSubmodel>[2];
type AIMCArg = Parameters<typeof buildAIMCSubmodel>[2];

/**
 * The registry. Order here is the canonical catalog display order.
 * Record<SubmodelKey, …> makes TypeScript require an entry for every key.
 */
export const SUBMODELS: Record<SubmodelKey, SubmodelDef> = {
  Nameplate: {
    yamlKey: 'DigitalNameplate',
    idShort: 'DigitalNameplate',
    importIdShorts: ['DigitalNameplate'],
    semanticId: DIGITAL_NAMEPLATE_SUBMODEL,
    label: 'DigitalNameplate',
    description: 'Manufacturer, serial number, product URI',
    color: '#38bdf8',
    aasTypes: ['Resource'],
    required: true,
    build: (c) => buildNameplateSubmodel(c.baseUrl, c.systemId, (c.section ?? {}) as NameplateArg, c.meta),
  },
  HierarchicalStructures: {
    yamlKey: 'HierarchicalStructures',
    idShort: 'HierarchicalStructures',
    importIdShorts: ['HierarchicalStructures'],
    semanticId: HIERARCHICAL_STRUCTURES,
    label: 'BillOfMaterials',
    description: 'BOM — IsPartOf / HasPart relationships',
    color: '#34d399',
    aasTypes: ['Resource'],
    required: true,
    build: (c) => buildHierarchicalStructuresSubmodel(
      c.baseUrl, c.systemId, c.node.identityGlobalAssetId, c.node.identityId,
      (c.section ?? {}) as HierArg, c.meta,
    ),
  },
  AID: {
    yamlKey: 'AID',
    idShort: 'AID',
    importIdShorts: ['AID'],
    semanticId: AID_SUBMODEL,
    label: 'AssetInterfaceDescription',
    description: 'MQTT/HTTP endpoint + interaction metadata',
    color: '#a78bfa',
    aasTypes: ['Resource'],
    build: (c) => buildAIDSubmodel(c.baseUrl, c.systemId, (c.section ?? {}) as AIDArg, c.meta),
  },
  Skills: {
    yamlKey: 'Skills',
    idShort: 'Skills',
    importIdShorts: ['Skills'],
    semanticId: SKILLS_SUBMODEL,
    label: 'Skills',
    description: 'Executable capabilities of this resource',
    color: '#fb923c',
    aasTypes: ['Resource'],
    build: (c) => buildSkillsSubmodel(c.baseUrl, c.systemId, (c.section ?? {}) as SkillsArg, c.meta),
  },
  Capabilities: {
    yamlKey: 'Capabilities',
    idShort: 'Capabilities',
    importIdShorts: ['Capabilities'],
    semanticId: CAPABILITIES_SUBMODEL,
    label: 'Capabilities',
    description: 'Semantic capability declarations',
    color: '#f472b6',
    aasTypes: ['Resource'],
    build: (c) => buildCapabilitiesSubmodel(c.baseUrl, c.systemId, (c.section ?? {}) as CapsArg, c.meta),
  },
  Variables: {
    yamlKey: 'Variables',
    idShort: 'OperationalData',
    importIdShorts: ['OperationalData'],
    semanticId: OPERATIONAL_DATA_SUBMODEL,
    label: 'OperationalData',
    description: 'Runtime variable semantic IDs',
    color: '#fbbf24',
    aasTypes: ['Resource'],
    build: (c) => buildOperationalDataSubmodel(c.baseUrl, c.systemId, (c.section ?? {}) as VarsArg, c.meta),
  },
  Parameters: {
    yamlKey: 'Parameters',
    idShort: 'Parameters',
    importIdShorts: ['Parameters'],
    semanticId: PARAMETERS_SUBMODEL,
    label: 'Parameters',
    description: 'Configuration parameters with units',
    color: '#94a3b8',
    aasTypes: ['Resource'],
    build: (c) => buildParametersSubmodel(c.baseUrl, c.systemId, (c.section ?? {}) as ParamsArg, c.meta),
  },
  AIMC: {
    yamlKey: 'AIMC',
    idShort: 'AssetInterfacesMappingConfiguration',
    importIdShorts: ['AssetInterfacesMappingConfiguration'],
    semanticId: AIMC_SUBMODEL,
    label: 'InterfaceMapping',
    description: 'Maps AID affordances to Variables, Skills, Parameters',
    color: '#6ee7b7',
    aasTypes: ['Resource'],
    hidden: true,
    build: (c) => buildAIMCSubmodel(c.baseUrl, c.systemId, (c.section ?? {}) as AIMCArg, c.meta),
  },
};

/** Submodel keys in canonical display order. */
export const SUBMODEL_KEYS = Object.keys(SUBMODELS) as SubmodelKey[];

/** Keys whose submodel applies to the given AAS type, in display order, excluding hidden entries. */
export function submodelKeysForType(aasType: AASType): SubmodelKey[] {
  return SUBMODEL_KEYS.filter((k) => SUBMODELS[k].aasTypes.includes(aasType) && !SUBMODELS[k].hidden);
}

/** Keys that are always present on a new AAS (required), in display order. */
export const REQUIRED_SUBMODEL_KEYS = SUBMODEL_KEYS.filter((k) => SUBMODELS[k].required);

/** Reverse map: built/aliased idShort -> SubmodelKey (for importing an AAS). */
export const IDSHORT_TO_KEY: Record<string, SubmodelKey> = Object.fromEntries(
  SUBMODEL_KEYS.flatMap((k) => SUBMODELS[k].importIdShorts.map((id) => [id, k])),
) as Record<string, SubmodelKey>;

/** Build the full Submodel list for an AAS node from its selected submodels. */
export function buildSubmodelsForNode(
  ns: AASNodeState,
  baseUrl: string,
): AasSubmodel[] {
  const systemId = ns.identitySystemId;
  const systemConfig = (ns.parsedProfile?.[systemId] ?? {}) as Record<string, unknown>;
  const metaOverrides = (systemConfig._meta ?? {}) as Record<string, { id?: string; semanticId?: string }>;
  const out: AasSubmodel[] = [];
  for (const key of ns.selectedSubmodels) {
    const def = SUBMODELS[key];
    if (!def) continue;
    out.push(def.build({
      baseUrl,
      systemId,
      section: systemConfig[def.yamlKey] ?? {},
      meta: metaOverrides[key],
      node: ns,
    }));
  }
  return out;
}

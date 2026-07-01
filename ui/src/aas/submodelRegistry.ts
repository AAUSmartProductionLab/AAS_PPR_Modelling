/**
 * Single source of truth for every submodel the editor knows about.
 *
 * One entry per submodel carries the metadata the rest of the app needs — the
 * profile key, the built idShort, the semantic id, catalog presentation, and
 * which AAS types it applies to. The lookup tables (SUBMODEL_KEYS,
 * REQUIRED_SUBMODEL_KEYS, IDSHORT_TO_KEY, …) are DERIVED from this map, so adding
 * a submodel is a single edit here (plus the SubmodelKey union, which TypeScript
 * enforces via Record<SubmodelKey, …>).
 *
 * The AAS itself is built on the backend (Python builders, the single source of
 * truth). The frontend only assembles the *profile* and sends it to the API —
 * there are no TypeScript AAS builders.
 */
import type { SubmodelKey, AASType } from '../store/useAppStore';
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

export interface SubmodelDef {
  /** Key in the profile / system config (e.g. 'DigitalNameplate', 'Variables'). */
  yamlKey: string;
  /** idShort the backend builder emits — used for round-tripping on import. */
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
  /** Hide from catalog UI (backend not yet implemented). */
  hidden?: boolean;
}

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

/**
 * Generic connection rules for the model graph.
 *
 * Every connectable row on a node renders a handle whose id encodes
 * `role | submodelKey | kind | item`. A small declarative rule table maps a
 * (sourceKind -> targetKind) pair to the profile mutation it represents, plus
 * how to undo it when the edge is deleted. This replaces the ad-hoc
 * `handle.includes('-cap-')` string matching and makes adding a new connection
 * type a single entry here — so all node-to-node links behave consistently.
 */
import type { Edge, Connection } from '@xyflow/react';
import { useAppStore, type SubmodelKey } from '../../store/useAppStore';
import { useModelStore } from '../../store/useModelStore';

const SEP = '::';
const PREFIX = 'h';

/** Build a structured handle id for a connectable row. */
export function makeHandleId(role: 'source' | 'target', submodelKey: SubmodelKey, kind: string, item: string): string {
  return [PREFIX, role, submodelKey, kind, item].join(SEP);
}

export interface ParsedHandle {
  role: 'source' | 'target';
  submodelKey: SubmodelKey;
  kind: string;
  item: string;
}

export function parseHandleId(id: string | null | undefined): ParsedHandle | null {
  if (!id) return null;
  const parts = id.split(SEP);
  if (parts.length !== 5 || parts[0] !== PREFIX) return null;
  const [, role, submodelKey, kind, ...rest] = parts;
  if (role !== 'source' && role !== 'target') return null;
  return { role, submodelKey: submodelKey as SubmodelKey, kind, item: rest.join(SEP) };
}

/** A handle resolved to its owning AAS (shell + systemId). */
interface Endpoint extends ParsedHandle {
  nodeId: string;
  shellId: string;
  systemId: string;
}

interface RuleStore {
  aasNodes: ReturnType<typeof useAppStore.getState>['aasNodes'];
  updateProfileFieldForNode: ReturnType<typeof useAppStore.getState>['updateProfileFieldForNode'];
  removeProfileEntryForNode: ReturnType<typeof useAppStore.getState>['removeProfileEntryForNode'];
}

export interface ConnectionRule {
  /** kind on the source endpoint. */
  from: string;
  /** kind on the target endpoint. */
  to: string;
  /** Edge label shown on the canvas. */
  label: string;
  /** Apply the profile mutation this connection represents. */
  apply: (src: Endpoint, tgt: Endpoint, store: RuleStore) => void;
  /** Undo it when the edge is removed. */
  remove: (src: Endpoint, tgt: Endpoint, store: RuleStore) => void;
}

// ── The rules ─────────────────────────────────────────────────────────────────
export const CONNECTION_RULES: ConnectionRule[] = [
  // Capability is realized by a Skill (same AAS).
  {
    from: 'capability', to: 'skill', label: 'realizedBy',
    apply: (src, tgt, s) =>
      s.updateProfileFieldForNode(src.shellId, [src.systemId, 'Capabilities', src.item, 'realizedBy'], tgt.item),
    remove: (src, _tgt, s) =>
      s.removeProfileEntryForNode(src.shellId, [src.systemId, 'Capabilities', src.item, 'realizedBy']),
  },
  // Skill is invoked through an AID action (same AAS).
  {
    from: 'skill', to: 'aid-action', label: 'invokes',
    apply: (src, tgt, s) =>
      s.updateProfileFieldForNode(src.shellId, [src.systemId, 'Skills', src.item, 'interface'], tgt.item),
    remove: (src, _tgt, s) =>
      s.removeProfileEntryForNode(src.shellId, [src.systemId, 'Skills', src.item, 'interface']),
  },
  // Variable reads an AID property (OperationalData → AID InteractionMetadata/properties).
  // Properties are observable outputs, so the relationship reads as "reads".
  {
    from: 'variable', to: 'aid-property', label: 'reads',
    apply: (src, tgt, s) =>
      s.updateProfileFieldForNode(src.shellId, [src.systemId, 'Variables', src.item, 'InterfaceReference'], tgt.item),
    remove: (src, _tgt, s) =>
      s.removeProfileEntryForNode(src.shellId, [src.systemId, 'Variables', src.item, 'InterfaceReference']),
  },
  // Parameter writes a (settable) AID property (Parameters → AID InteractionMetadata/properties).
  {
    from: 'parameter', to: 'aid-property', label: 'writes',
    apply: (src, tgt, s) =>
      s.updateProfileFieldForNode(src.shellId, [src.systemId, 'Parameters', src.item, 'InterfaceReference'], tgt.item),
    remove: (src, _tgt, s) =>
      s.removeProfileEntryForNode(src.shellId, [src.systemId, 'Parameters', src.item, 'InterfaceReference']),
  },
  // BoM relationships: HierarchicalStructures of AAS-A references AAS-B's entry node.
  ...(['HasPart', 'IsPartOf', 'SameAs'] as const).map((rel) => ({
    from: `bom-${rel.toLowerCase()}`,
    to: 'bom-entry',
    label: rel,
    apply: (src: Endpoint, tgt: Endpoint, s: RuleStore) => {
      const tgtNs = s.aasNodes[tgt.shellId];
      let tgtBaseUrl = '';
      try { tgtBaseUrl = new URL(tgtNs?.identityId ?? '').origin; } catch { /* ignore */ }
      s.updateProfileFieldForNode(src.shellId, [src.systemId, 'HierarchicalStructures', rel, tgt.systemId], {
        globalAssetId: tgtNs?.identityGlobalAssetId || undefined,
        systemId: tgt.systemId,
        ...(tgtBaseUrl ? { submodelId: `${tgtBaseUrl}/submodels/instances/${tgt.systemId}/HierarchicalStructures` } : {}),
      });
    },
    remove: (src: Endpoint, tgt: Endpoint, s: RuleStore) =>
      s.removeProfileEntryForNode(src.shellId, [src.systemId, 'HierarchicalStructures', rel, tgt.systemId]),
  })),
];

function findRule(fromKind: string, toKind: string): ConnectionRule | undefined {
  return CONNECTION_RULES.find((r) => r.from === fromKind && r.to === toKind);
}

function resolveEndpoint(nodeId: string | null, handleId: string | null | undefined): Endpoint | null {
  const parsed = parseHandleId(handleId);
  if (!parsed || !nodeId) return null;
  const node = useModelStore.getState().nodes.find((n) => n.id === nodeId);
  const shellId = (node?.data as { parentId?: string } | undefined)?.parentId;
  if (!shellId) return null;
  const systemId = useAppStore.getState().aasNodes[shellId]?.identitySystemId;
  if (!systemId) return null;
  return { ...parsed, nodeId, shellId, systemId };
}

function store(): RuleStore {
  const s = useAppStore.getState();
  return {
    aasNodes: s.aasNodes,
    updateProfileFieldForNode: s.updateProfileFieldForNode,
    removeProfileEntryForNode: s.removeProfileEntryForNode,
  };
}

/**
 * Apply a new connection. Returns the matched rule's label (or null if the
 * connection carries no semantic meaning — a plain reference edge).
 */
export function applyConnection(connection: Connection): string | null {
  const src = resolveEndpoint(connection.source, connection.sourceHandle);
  const tgt = resolveEndpoint(connection.target, connection.targetHandle);
  if (!src || !tgt) return null;
  const rule = findRule(src.kind, tgt.kind);
  if (!rule) return null;
  rule.apply(src, tgt, store());
  return rule.label;
}

/** Undo the profile mutation for an edge being removed. */
export function removeConnectionForEdge(edge: Edge): void {
  const src = resolveEndpoint(edge.source, edge.sourceHandle);
  const tgt = resolveEndpoint(edge.target, edge.targetHandle);
  if (!src || !tgt) return;
  const rule = findRule(src.kind, tgt.kind);
  if (!rule) return;
  rule.remove(src, tgt, store());
}

import { useEffect, useRef } from 'react';
import { api } from '../api/client';
import { useAppStore } from '../store/useAppStore';

const DEBOUNCE_MS = 400;

/**
 * Validate a single AAS node against the shapes for its own type and store the
 * result per-node. Reads the freshest store state via getState(), so it is safe
 * to call imperatively (e.g. when an editor modal closes) as well as from the
 * debounced workspace effect below.
 *
 * For the active node the latest identity/type live in the flat workspace
 * fields; for other nodes they live in the saved aasNodes entry.
 */
export async function validateAasNode(nodeId: string): Promise<void> {
  const s = useAppStore.getState();
  const isActive = nodeId === s.activeAasNodeId;
  const node = s.aasNodes[nodeId];
  const identitySystemId = isActive ? s.identitySystemId : node?.identitySystemId;
  const identityId = isActive ? s.identityId : node?.identityId;
  const nodeType = isActive ? s.aasType : (node?.aasType ?? 'Resource');

  if (!identitySystemId) {
    s.setValidationIssuesForNode(nodeId, []);
    return;
  }

  // Send the profile; the server builds the canonical AAS (correct IDTA/ARSO
  // semanticIds) and validates it. The TS builders are preview-only.
  const profile = s.buildProfileForNode(nodeId);
  if (!profile) {
    s.setValidationIssuesForNode(nodeId, []);
    return;
  }
  let baseUrl: string | undefined;
  try { baseUrl = identityId ? new URL(identityId).origin : undefined; } catch { baseUrl = undefined; }

  s.setLoadingValidateForNode(nodeId, true);
  try {
    const result = await api.validateProfile(profile, nodeType, baseUrl);
    if (nodeId === s.activeAasNodeId) s.setValidateResult(result);
    s.setValidationIssuesForNode(nodeId, result.issues);
  } catch {
    // Backend not running / transient error — keep previous issues silently.
  } finally {
    s.setLoadingValidateForNode(nodeId, false);
  }
}

/**
 * Build the canonical (server-side) AAS Environment JSON for a node — the same
 * AAS that /api/validate-profile validates, with the correct IDTA/ARSO
 * semanticIds and mandatory structure. Use this for export/download so what the
 * user saves matches what passes validation (the TS builders are preview-only).
 * Returns '' if the node isn't configured or the backend is unreachable.
 */
export async function buildServerAasJson(nodeId: string): Promise<string> {
  const s = useAppStore.getState();
  const isActive = nodeId === s.activeAasNodeId;
  const node = s.aasNodes[nodeId];
  const identityId = isActive ? s.identityId : node?.identityId;
  const aasType = isActive ? s.aasType : (node?.aasType ?? 'Resource');
  const profile = s.buildProfileForNode(nodeId);
  if (!profile) return '';
  let baseUrl: string | undefined;
  try { baseUrl = identityId ? new URL(identityId).origin : undefined; } catch { baseUrl = undefined; }
  const res = await api.validateProfile(profile, aasType, baseUrl);
  return res.aas_json || '';
}

/**
 * Validates EVERY AAS in the workspace whenever anything changes (debounced).
 * Each AAS is validated against the shapes for its own type (Resource -> ARSO,
 * Product -> APSO), so a mixed workspace stays correct. Results are stored
 * per-node so the GuidancePanel and nodes show issues without cross-contamination.
 */
export function useValidation() {
  const aasNodes = useAppStore((s) => s.aasNodes);
  const activeAasNodeId = useAppStore((s) => s.activeAasNodeId);
  // Active-workspace fields are the freshest copy of the active node's data.
  const parsedProfile = useAppStore((s) => s.parsedProfile);
  const selectedSubmodels = useAppStore((s) => s.selectedSubmodels);
  const aasType = useAppStore((s) => s.aasType);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevDataKeyRef = useRef<string>('');

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    // Key over all nodes + the active workspace edits, so any change re-validates.
    const dataKey = JSON.stringify({ aasNodes, parsedProfile, selectedSubmodels, activeAasNodeId, aasType });
    const delay = dataKey !== prevDataKeyRef.current ? DEBOUNCE_MS : 0;
    prevDataKeyRef.current = dataKey;

    const nodeIds = Object.keys(aasNodes);

    timerRef.current = setTimeout(() => {
      // Validate each configured AAS in parallel against its own type's shapes.
      void Promise.all(nodeIds.map((nodeId) => validateAasNode(nodeId)));
    }, delay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [aasNodes, parsedProfile, selectedSubmodels, activeAasNodeId, aasType]);
}

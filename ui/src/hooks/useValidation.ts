import { useEffect, useRef } from 'react';
import { api } from '../api/client';
import { useAppStore } from '../store/useAppStore';

const DEBOUNCE_MS = 400;

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
  const buildAasJsonForNode = useAppStore((s) => s.buildAasJsonForNode);
  const setValidationIssuesForNode = useAppStore((s) => s.setValidationIssuesForNode);
  const setLoadingValidateForNode = useAppStore((s) => s.setLoadingValidateForNode);
  const setValidateResult = useAppStore((s) => s.setValidateResult);

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
      void Promise.all(nodeIds.map(async (nodeId) => {
        const node = aasNodes[nodeId];
        if (!node?.identitySystemId) {
          setValidationIssuesForNode(nodeId, []);
          return;
        }
        const nodeType = nodeId === activeAasNodeId ? aasType : (node.aasType ?? 'Resource');
        setLoadingValidateForNode(nodeId, true);
        try {
          const json = buildAasJsonForNode(nodeId);
          if (!json) {
            setValidationIssuesForNode(nodeId, []);
            return;
          }
          const result = await api.validate(json, nodeType);
          if (nodeId === activeAasNodeId) setValidateResult(result);
          setValidationIssuesForNode(nodeId, result.issues);
        } catch {
          // Silently ignore (backend not running, etc.)
        } finally {
          setLoadingValidateForNode(nodeId, false);
        }
      }));
    }, delay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [aasNodes, parsedProfile, selectedSubmodels, activeAasNodeId, aasType, buildAasJsonForNode, setValidationIssuesForNode, setLoadingValidateForNode, setValidateResult]);
}

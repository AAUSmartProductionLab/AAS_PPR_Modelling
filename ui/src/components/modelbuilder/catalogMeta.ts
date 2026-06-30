import type { SubmodelKey } from '../../store/useAppStore';
import { SUBMODELS, SUBMODEL_KEYS } from '../../aas/submodelRegistry';

export interface SubmodelMeta {
  icon: string;
  label: string;
  description: string;
  color: string;
}

// Catalog presentation is derived from the submodel registry (single source of truth).
export const SUBMODEL_META = Object.fromEntries(
  SUBMODEL_KEYS.map((k) => [k, {
    icon: 'SM',
    label: SUBMODELS[k].label,
    description: SUBMODELS[k].description,
    color: SUBMODELS[k].color,
  }]),
) as Record<SubmodelKey, SubmodelMeta>;

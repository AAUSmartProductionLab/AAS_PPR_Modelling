import { useAppStore } from '../../store/useAppStore';
import { useAdvanced } from '../shared/AdvancedContext';
import { AdvField } from '../shared/AdvField';
import { PARAMETERS_SUBMODEL, SEMANTIC_ID_BASE } from '../../aas/semanticIds';
import type { Parameter } from '../../types/resourceaas';

function deriveBaseUrl(id: string) {
  try { return new URL(id).origin; } catch { return SEMANTIC_ID_BASE; }
}

function nextCountName(prefix: string, existing: string[]): string {
  let i = 1;
  while (existing.includes(`${prefix}_${String(i).padStart(2, '0')}`)) i++;
  return `${prefix}_${String(i).padStart(2, '0')}`;
}

export function ParametersForm() {
  const parsedProfile = useAppStore((s) => s.parsedProfile);
  const updateProfileField = useAppStore((s) => s.updateProfileField);
  const identityId = useAppStore((s) => s.identityId);
  const identitySystemId = useAppStore((s) => s.identitySystemId);
  const { advanced } = useAdvanced();

  if (!parsedProfile) return <p className="empty-state">No profile loaded.</p>;

  const systemId = Object.keys(parsedProfile)[0];
  const parameters = parsedProfile[systemId]?.Parameters ?? {};

  // Collect AID property names for the InterfaceReference dropdown
  const aid = (parsedProfile[systemId]?.AID ?? {}) as Record<string, any>;
  const aidProperties: string[] = [];
  for (const iface of Object.values(aid)) {
    if (iface && typeof iface === 'object') {
      const props = iface?.InteractionMetadata?.properties ?? {};
      for (const pName of Object.keys(props)) {
        if (!aidProperties.includes(pName)) aidProperties.push(pName);
      }
    }
  }

  const baseUrl = deriveBaseUrl(identityId);
  const metaId = (parsedProfile[systemId] as any)?._meta?.Parameters?.id ?? `${baseUrl}/submodels/instances/${identitySystemId}/Parameters`;
  const metaSemanticId = (parsedProfile[systemId] as any)?._meta?.Parameters?.semanticId ?? PARAMETERS_SUBMODEL;

  const update = (paramName: string, field: keyof Parameter, value: string) => {
    updateProfileField([systemId, 'Parameters', paramName, field], value || undefined);
  };

  const addParam = () => {
    const name = nextCountName('NewParam', Object.keys(parameters));
    updateProfileField([systemId, 'Parameters', name], {
      ParameterValue: '',
      Unit: '',
    } as Parameter);
  };

  const removeParam = (name: string) => {
    const clone = { ...parameters };
    delete clone[name];
    updateProfileField([systemId, 'Parameters'], clone);
  };

  return (
    <div className="submodel-form">
      {advanced && (
        <div className="adv-block">
          <AdvField label="id"         value={metaId}
            onChange={(v) => updateProfileField([systemId, '_meta', 'Parameters', 'id'], v || undefined)} />
          <AdvField label="semanticId" value={metaSemanticId}
            onChange={(v) => updateProfileField([systemId, '_meta', 'Parameters', 'semanticId'], v || undefined)} />
        </div>
      )}

      <div className="submodel-form__controls">
        <button className="btn btn--sm btn--secondary" onClick={addParam}>
          + Parameter
        </button>
      </div>

      {Object.keys(parameters).length === 0 && (
        <p className="empty-state">
          No parameters defined. Add one or link to AID properties via InterfaceReference.
        </p>
      )}

      {Object.entries(parameters).map(([paramName, param]) => (
        <div key={paramName} className="card">
          <div className="card__header">
            <strong>{paramName}</strong>
            <button
              className="btn btn--xs btn--danger"
              onClick={() => removeParam(paramName)}
            >
              ✕
            </button>
          </div>
          <div className="card__body">
            <div className="field-grid field-grid--2col">
              <div className="field-group">
                <label className="field-label">ParameterValue</label>
                <input
                  className="field-input"
                  value={param?.ParameterValue ?? ''}
                  onChange={(e) => update(paramName, 'ParameterValue', e.target.value)}
                />
              </div>
              <div className="field-group">
                <label className="field-label">Unit</label>
                <input
                  className="field-input"
                  value={param?.Unit ?? ''}
                  placeholder="unit"
                  onChange={(e) => update(paramName, 'Unit', e.target.value)}
                />
              </div>
              <div className="field-group">
                <label className="field-label">Semantic ID</label>
                <input
                  className="field-input"
                  value={param?.semanticId ?? ''}
                  placeholder="https://..."
                  onChange={(e) => update(paramName, 'semanticId', e.target.value)}
                />
              </div>
              <div className="field-group">
                <label className="field-label">
                  InterfaceReference <span className="field-hint">(AID property to write to)</span>
                </label>
                {aidProperties.length > 0 ? (
                  <select
                    className="field-input"
                    value={param?.InterfaceReference ?? ''}
                    onChange={(e) => update(paramName, 'InterfaceReference', e.target.value)}
                  >
                    <option value="">— none —</option>
                    {aidProperties.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="field-input"
                    value={param?.InterfaceReference ?? ''}
                    placeholder="No AID properties defined yet"
                    onChange={(e) => update(paramName, 'InterfaceReference', e.target.value)}
                  />
                )}
              </div>
              <div className="field-group">
                <label className="field-label">
                  Field <span className="field-hint">(optional: extract single input schema field)</span>
                </label>
                <input
                  className="field-input"
                  value={param?.Field ?? ''}
                  placeholder="e.g. targetPosition"
                  onChange={(e) => update(paramName, 'Field', e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

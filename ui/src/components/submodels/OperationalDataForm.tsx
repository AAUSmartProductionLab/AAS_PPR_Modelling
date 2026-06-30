import { useAppStore } from '../../store/useAppStore';
import { SemanticIdInput } from '../shared/SemanticIdInput';
import { useAdvanced } from '../shared/AdvancedContext';
import { AdvField } from '../shared/AdvField';
import { OPERATIONAL_DATA_SUBMODEL, SEMANTIC_ID_BASE } from '../../aas/semanticIds';
import type { Variable } from '../../types/resourceaas';

function deriveBaseUrl(id: string) {
  try { return new URL(id).origin; } catch { return SEMANTIC_ID_BASE; }
}

function nextCountName(prefix: string, existing: string[]): string {
  let i = 1;
  while (existing.includes(`${prefix}_${String(i).padStart(2, '0')}`)) i++;
  return `${prefix}_${String(i).padStart(2, '0')}`;
}

const RESERVED_KEYS = new Set(['semanticId', 'InterfaceReference', 'Field']);

export function OperationalDataForm() {
  const parsedProfile = useAppStore((s) => s.parsedProfile);
  const updateProfileField = useAppStore((s) => s.updateProfileField);
  const identityId = useAppStore((s) => s.identityId);
  const identitySystemId = useAppStore((s) => s.identitySystemId);
  const { advanced } = useAdvanced();

  if (!parsedProfile) return <p className="empty-state">No profile loaded.</p>;

  const systemId = Object.keys(parsedProfile)[0];
  const variables = parsedProfile[systemId]?.Variables ?? {};

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
  const metaId = (parsedProfile[systemId] as any)?._meta?.Variables?.id ?? `${baseUrl}/submodels/instances/${identitySystemId}/OperationalData`;
  const metaSemanticId = (parsedProfile[systemId] as any)?._meta?.Variables?.semanticId ?? OPERATIONAL_DATA_SUBMODEL;

  const update = (varName: string, field: string, value: string | undefined) => {
    updateProfileField([systemId, 'Variables', varName, field], value || undefined);
  };

  const updateData = (varName: string, field: string, value: string) => {
    updateProfileField([systemId, 'Variables', varName, field], value || undefined);
  };

  const addVariable = () => {
    const name = nextCountName('NewVariable', Object.keys(variables));
    updateProfileField([systemId, 'Variables', name], { semanticId: '' } as Variable);
  };

  const removeVariable = (name: string) => {
    const clone = { ...variables };
    delete clone[name];
    updateProfileField([systemId, 'Variables'], clone);
  };

  const renameVariable = (oldName: string, newName: string) => {
    const clone = { ...variables };
    clone[newName] = clone[oldName];
    delete clone[oldName];
    updateProfileField([systemId, 'Variables'], clone);
  };

  // Extract data fields (non-reserved keys) from a variable
  const dataFields = (v: Variable | undefined): [string, string][] => {
    if (!v) return [];
    return Object.entries(v).filter(([k]) => !RESERVED_KEYS.has(k)) as [string, string][];
  };

  const addDataField = (varName: string) => {
    const name = nextCountName('field', dataFields(variables[varName]).map(([k]) => k));
    updateData(varName, name, '');
  };

  const removeDataField = (varName: string, fieldName: string) => {
    updateData(varName, fieldName, undefined as any);
  };

  return (
    <div className="submodel-form">
      {advanced && (
        <div className="adv-block">
          <AdvField label="id"         value={metaId}
            onChange={(v) => updateProfileField([systemId, '_meta', 'Variables', 'id'], v || undefined)} />
          <AdvField label="semanticId" value={metaSemanticId}
            onChange={(v) => updateProfileField([systemId, '_meta', 'Variables', 'semanticId'], v || undefined)} />
        </div>
      )}

      <div className="submodel-form__controls">
        <button className="btn btn--sm btn--secondary" onClick={addVariable}>
          + Variable
        </button>
      </div>

      {Object.keys(variables).length === 0 && (
        <p className="empty-state">
          No operational data variables defined. Link to AID properties to create schema-driven variables.
        </p>
      )}

      {Object.entries(variables).map(([varName, variable]) => {
        const data = dataFields(variable);
        return (
        <div key={varName} className="card">
          <div className="card__header">
            <strong>{varName}</strong>
            <button className="btn btn--xs btn--danger" onClick={() => removeVariable(varName)}>
              ✕
            </button>
          </div>
          <div className="card__body">
            {advanced && (
              <div className="adv-block">
                <AdvField label="idShort" value={varName}
                  onRename={(n) => renameVariable(varName, n)} />
              </div>
            )}
            <div className="field-grid field-grid--2col">
              <SemanticIdInput
                label="Semantic ID"
                required
                value={variable?.semanticId ?? ''}
                onChange={(v) => update(varName, 'semanticId', v)}
              />
              <div className="field-group">
                <label className="field-label">
                  InterfaceReference <span className="field-hint">(AID property to read from)</span>
                </label>
                {aidProperties.length > 0 ? (
                  <select
                    className="field-input"
                    value={variable?.InterfaceReference ?? ''}
                    onChange={(e) => update(varName, 'InterfaceReference', e.target.value || undefined)}
                  >
                    <option value="">— none —</option>
                    {aidProperties.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="field-input"
                    value={variable?.InterfaceReference ?? ''}
                    placeholder="No AID properties defined yet"
                    onChange={(e) => update(varName, 'InterfaceReference', e.target.value || undefined)}
                  />
                )}
              </div>
              <div className="field-group">
                <label className="field-label">
                  Field <span className="field-hint">(optional: extract single schema field)</span>
                </label>
                <input
                  className="field-input"
                  value={variable?.Field ?? ''}
                  placeholder="e.g. State, ProcessQueue"
                  onChange={(e) => update(varName, 'Field', e.target.value || undefined)}
                />
              </div>
            </div>

            {/* Data fields (non-reserved keys become individual data properties) */}
            {data.length > 0 && (
              <div className="skill-vars" style={{ marginTop: '0.75rem' }}>
                <div className="skill-vars__header">
                  <span className="field-label">Data Fields</span>
                  <button className="btn btn--xs btn--secondary" onClick={() => addDataField(varName)}>+</button>
                </div>
                <table className="param-table">
                  <thead>
                    <tr>
                      <th>Field Name</th>
                      <th>Value</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {data.map(([fieldName, fieldValue]) => (
                      <tr key={fieldName}>
                        <td>
                          <input
                            className="field-input field-input--sm"
                            value={fieldName}
                            onChange={(e) => {
                              const old = fieldName;
                              const val = fieldValue;
                              update(varName, old, undefined as any);
                              updateData(varName, e.target.value || 'field', val);
                            }}
                          />
                        </td>
                        <td>
                          <input
                            className="field-input field-input--sm"
                            value={fieldValue ?? ''}
                            placeholder="value"
                            onChange={(e) => updateData(varName, fieldName, e.target.value)}
                          />
                        </td>
                        <td>
                          <button className="btn btn--xs btn--danger" onClick={() => removeDataField(varName, fieldName)}>
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
        );
      })}
    </div>
  );
}

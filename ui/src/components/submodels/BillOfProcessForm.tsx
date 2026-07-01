import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { BillOfProcessConfig, ProcessEntry, ProcessEntryType } from '../../types/resourceaas';

const PROCESS_TYPES: ProcessEntryType[] = ['ProcessProperty', 'ProcessSMC', 'ProcessStructureSMC'];

const EMPTY_PROCESS_SMC: ProcessEntry = {
  type: 'ProcessSMC',
  processId: '',
  semanticId: '',
  sequenceNumber: 1,
};

const EMPTY_PROCESS_PROPERTY: ProcessEntry = {
  type: 'ProcessProperty',
  value: '',
};

export function BillOfProcessForm() {
  const parsedProfile = useAppStore((s) => s.parsedProfile);
  const updateProfileField = useAppStore((s) => s.updateProfileField);
  const [newProcType, setNewProcType] = useState<ProcessEntryType>('ProcessSMC');

  if (!parsedProfile) return <p className="empty-state">No profile loaded.</p>;
  const systemId = Object.keys(parsedProfile)[0];
  const cfg = (parsedProfile[systemId]?.BillOfProcess ?? {}) as BillOfProcessConfig;
  const processes: ProcessEntry[] = cfg.Processes ?? [];

  const setProcesses = (procs: ProcessEntry[]) => {
    updateProfileField([systemId, 'BillOfProcess', 'Processes'], procs.length ? procs : undefined as never);
  };

  const addProcess = () => {
    const proto = newProcType === 'ProcessProperty' ? { ...EMPTY_PROCESS_PROPERTY } : { ...EMPTY_PROCESS_SMC };
    proto.type = newProcType;
    proto.idShort = `${newProcType}_${processes.length + 1}`;
    setProcesses([...processes, proto]);
  };

  const delProcess = (idx: number) => {
    setProcesses(processes.filter((_, i) => i !== idx));
  };

  const updateProcess = (idx: number, field: keyof ProcessEntry, val: unknown) => {
    const next = processes.map((p, i) => (i === idx ? { ...p, [field]: val } : p));
    setProcesses(next);
  };

  const updateDuration = (idx: number, field: 'value' | 'semanticId', val: string) => {
    const next = processes.map((p, i) => {
      if (i !== idx) return p;
      return { ...p, estimatedDuration: { ...(p.estimatedDuration ?? { value: '' }), [field]: val } };
    });
    setProcesses(next);
  };

  return (
    <div className="submodel-form">
      {/* RecipeId */}
      <div className="field-group">
        <label className="field-label">
          RecipeId <span className="field-required" title="Required">*</span>
        </label>
        <input className="field-input" placeholder="Recipe identifier"
          value={cfg.RecipeId ?? ''}
          onChange={(e) => updateProfileField([systemId, 'BillOfProcess', 'RecipeId'], e.target.value)} />
      </div>

      {/* Processes */}
      <fieldset className="field-group" style={{ border: '1px solid var(--border-color)', borderRadius: 8, padding: '0.75rem' }}>
        <legend style={{ fontWeight: 600 }}>
          Processes <span className="field-required" title="Required">*</span> ({processes.length})
        </legend>

        {processes.map((proc, idx) => (
          <div key={idx} className="card" style={{ marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span>
                <strong>{proc.idShort ?? `#${idx + 1}`}</strong>
                {' '}
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', padding: '1px 6px', borderRadius: 4 }}>{proc.type}</span>
              </span>
              <button className="btn btn--ghost" style={{ color: 'var(--danger-color)', padding: '2px 6px' }}
                onClick={() => delProcess(idx)}>✕</button>
            </div>

            {proc.type === 'ProcessProperty' ? (
              <label style={{ fontSize: '0.8rem' }}>
                value
                <input className="field-input" placeholder="Process name/label"
                  value={proc.value ?? ''} onChange={(e) => updateProcess(idx, 'value', e.target.value)} />
              </label>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.8rem' }}>
                  processId <span className="field-required">*</span>
                  <input className="field-input" placeholder="e.g. P1"
                    value={proc.processId ?? ''} onChange={(e) => updateProcess(idx, 'processId', e.target.value)} />
                </label>
                <label style={{ fontSize: '0.8rem' }}>
                  semanticId <span className="field-required">*</span>
                  <input className="field-input" placeholder="Semantic identifier"
                    value={proc.semanticId ?? ''} onChange={(e) => updateProcess(idx, 'semanticId', e.target.value)} />
                </label>
                <label style={{ fontSize: '0.8rem' }}>
                  sequenceNumber <span className="field-required">*</span>
                  <input className="field-input" type="number" min={1}
                    value={proc.sequenceNumber ?? idx + 1}
                    onChange={(e) => updateProcess(idx, 'sequenceNumber', parseInt(e.target.value, 10) || 1)} />
                </label>
                <label style={{ fontSize: '0.8rem' }}>
                  description
                  <input className="field-input" placeholder="Optional description"
                    value={proc.description ?? ''} onChange={(e) => updateProcess(idx, 'description', e.target.value || undefined)} />
                </label>
              </div>
            )}

            {/* Estimated duration (for SMC types) */}
            {proc.type !== 'ProcessProperty' && (
              <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: 'var(--bg-secondary)', borderRadius: 6 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>estimatedDuration</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.8rem' }}>
                    value
                    <input className="field-input" placeholder="e.g. 120"
                      value={proc.estimatedDuration?.value ?? ''}
                      onChange={(e) => updateDuration(idx, 'value', e.target.value)} />
                  </label>
                  <label style={{ fontSize: '0.8rem' }}>
                    semanticId
                    <input className="field-input" placeholder="Duration semantic id"
                      value={proc.estimatedDuration?.semanticId ?? ''}
                      onChange={(e) => updateDuration(idx, 'semanticId', e.target.value)} />
                  </label>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Add new process */}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', alignItems: 'center' }}>
          <select className="field-input" style={{ width: 'auto' }}
            value={newProcType} onChange={(e) => setNewProcType(e.target.value as ProcessEntryType)}>
            {PROCESS_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <button className="btn btn--primary" onClick={addProcess}>Add Process</button>
        </div>
      </fieldset>
    </div>
  );
}

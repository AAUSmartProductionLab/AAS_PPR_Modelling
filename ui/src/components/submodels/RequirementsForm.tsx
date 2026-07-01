import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { RequirementsConfig, ApsotRequirement } from '../../types/resourceaas';

type ReqMap = Record<string, ApsotRequirement>;

export function RequirementsForm() {
  const parsedProfile = useAppStore((s) => s.parsedProfile);
  const updateProfileField = useAppStore((s) => s.updateProfileField);
  const [newReqName, setNewReqName] = useState('');

  if (!parsedProfile) return <p className="empty-state">No profile loaded.</p>;
  const systemId = Object.keys(parsedProfile)[0];
  const cfg = (parsedProfile[systemId]?.Requirements ?? {}) as RequirementsConfig;
  const reqs: ReqMap = cfg.Requirements ?? {};

  const setReqs = (next: ReqMap | undefined) => {
    updateProfileField([systemId, 'Requirements', 'Requirements'],
      (next && Object.keys(next).length) ? next : undefined as never);
  };

  const addReq = () => {
    const name = newReqName.trim();
    if (!name || reqs[name]) return;
    setReqs({ ...reqs, [name]: { requirementId: name, semanticId: '', value: '' } });
    setNewReqName('');
  };

  const delReq = (name: string) => {
    const next = { ...reqs };
    delete next[name];
    setReqs(Object.keys(next).length ? next : undefined);
  };

  const updateReq = (name: string, field: keyof ApsotRequirement, val: string) => {
    setReqs({ ...reqs, [name]: { ...reqs[name], [field]: val } });
  };

  return (
    <div className="submodel-form">
      {/* Requirements collection */}
      <fieldset className="field-group" style={{ border: '1px solid var(--border-color)', borderRadius: 8, padding: '0.75rem' }}>
        <legend style={{ fontWeight: 600 }}>
          Requirements <span className="field-required" title="Required">*</span> ({Object.keys(reqs).length})
        </legend>

        {Object.entries(reqs).map(([name, req]) => (
          <div key={name} className="card" style={{ marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <strong>{name}</strong>
              <button className="btn btn--ghost" style={{ color: 'var(--danger-color)', padding: '2px 6px' }}
                onClick={() => delReq(name)}>✕</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.8rem' }}>
                requirementId <span className="field-required">*</span>
                <input className="field-input" placeholder="Unique ID"
                  value={req.requirementId} onChange={(e) => updateReq(name, 'requirementId', e.target.value)} />
              </label>
              <label style={{ fontSize: '0.8rem' }}>
                semanticId <span className="field-required">*</span>
                <input className="field-input" placeholder="Semantic identifier"
                  value={req.semanticId} onChange={(e) => updateReq(name, 'semanticId', e.target.value)} />
              </label>
              <label style={{ fontSize: '0.8rem', gridColumn: '1 / -1' }}>
                description
                <input className="field-input" placeholder="Optional description"
                  value={req.description ?? ''} onChange={(e) => updateReq(name, 'description', e.target.value)} />
              </label>
              <label style={{ fontSize: '0.8rem' }}>
                value <span className="field-required">*</span>
                <input className="field-input" placeholder="Requirement value"
                  value={req.value} onChange={(e) => updateReq(name, 'value', e.target.value)} />
              </label>
              <label style={{ fontSize: '0.8rem' }}>
                unit
                <input className="field-input" placeholder="Optional unit"
                  value={req.unit ?? ''} onChange={(e) => updateReq(name, 'unit', e.target.value)} />
              </label>
              <label style={{ fontSize: '0.8rem' }}>
                unitSemanticId
                <input className="field-input" placeholder="Unit semantic id"
                  value={req.unitSemanticId ?? ''} onChange={(e) => updateReq(name, 'unitSemanticId', e.target.value)} />
              </label>
            </div>
          </div>
        ))}

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
          <input className="field-input" placeholder="New requirement name"
            value={newReqName} onChange={(e) => setNewReqName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addReq(); }} />
          <button className="btn btn--primary" onClick={addReq}>Add</button>
        </div>
      </fieldset>
    </div>
  );
}

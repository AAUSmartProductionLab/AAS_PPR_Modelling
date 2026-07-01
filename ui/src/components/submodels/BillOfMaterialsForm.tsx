import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { ProductBillOfMaterialsConfig, BomJointConnection, BomJointParams } from '../../types/resourceaas';

type JointConns = Record<string, BomJointConnection>;
type JointParamsMap = Record<string, BomJointParams>;

export function BillOfMaterialsForm() {
  const parsedProfile = useAppStore((s) => s.parsedProfile);
  const updateProfileField = useAppStore((s) => s.updateProfileField);
  const [newJcName, setNewJcName] = useState('');
  const [newJpName, setNewJpName] = useState('');

  if (!parsedProfile) return <p className="empty-state">No profile loaded.</p>;
  const systemId = Object.keys(parsedProfile)[0];
  const bomKey = [systemId, 'BillOfMaterials'] as const;
  const cfg = (parsedProfile[systemId]?.BillOfMaterials ?? {}) as ProductBillOfMaterialsConfig;

  const jointConns: JointConns = cfg.JointConnections ?? {};
  const jointParams: JointParamsMap = cfg.JointParams ?? {};

  const setField = (path: (string | number)[], value: unknown) => {
    updateProfileField([systemId, 'BillOfMaterials', ...path], value as never);
  };

  // ── ArcheType ────────────────────────────────────────────────────────────────
  const ARCHETYPES = ['OneUpAndOneDown', 'OneUp', 'OneDown'];

  // ── JointConnection helpers ──────────────────────────────────────────────────
  const addJointConnection = () => {
    const name = newJcName.trim();
    if (!name || jointConns[name]) return;
    const next: JointConns = {
      ...jointConns,
      [name]: { first: '', second: '', jointType: '', jointParamsRef: '' },
    };
    setField(['JointConnections'], next);
    setNewJcName('');
  };

  const delJointConnection = (name: string) => {
    const next = { ...jointConns };
    delete next[name];
    setField(['JointConnections'], Object.keys(next).length ? next : undefined);
  };

  const updateJc = (name: string, field: keyof BomJointConnection, val: string) => {
    setField(['JointConnections', name, field], val);
  };

  // ── JointParams helpers ──────────────────────────────────────────────────────
  const addJointParams = () => {
    const name = newJpName.trim();
    if (!name || jointParams[name]) return;
    setField(['JointParams', name], {});
    setNewJpName('');
  };

  const delJointParams = (name: string) => {
    const next = { ...jointParams };
    delete next[name];
    setField(['JointParams'], Object.keys(next).length ? next : undefined);
  };

  return (
    <div className="submodel-form">
      {/* EntryNode */}
      <div className="field-group">
        <label className="field-label">EntryNodeId <span className="field-required" title="Required">*</span></label>
        <input className="field-input" placeholder="globalAssetId of the root Entity"
          value={cfg.EntryNodeId ?? ''}
          onChange={(e) => setField(['EntryNodeId'], e.target.value || undefined)} />
      </div>

      {/* ArcheType */}
      <div className="field-group">
        <label className="field-label">ArcheType <span className="field-required" title="Required">*</span></label>
        <select className="field-input"
          value={cfg.ArcheType ?? 'OneUpAndOneDown'}
          onChange={(e) => setField(['ArcheType'], e.target.value)}>
          {ARCHETYPES.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {/* JointConnections */}
      <fieldset className="field-group" style={{ border: '1px solid var(--border-color)', borderRadius: 8, padding: '0.75rem' }}>
        <legend style={{ fontWeight: 600 }}>JointConnections ({Object.keys(jointConns).length})</legend>
        {Object.entries(jointConns).map(([name, jc]) => (
          <div key={name} className="card" style={{ marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <strong>{name}</strong>
              <button className="btn btn--ghost" style={{ color: 'var(--danger-color)', padding: '2px 6px' }}
                onClick={() => delJointConnection(name)}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.8rem' }}>
                first <span className="field-required">*</span>
                <input className="field-input" placeholder="Entity reference"
                  value={jc.first} onChange={(e) => updateJc(name, 'first', e.target.value)} />
              </label>
              <label style={{ fontSize: '0.8rem' }}>
                second <span className="field-required">*</span>
                <input className="field-input" placeholder="Entity reference"
                  value={jc.second} onChange={(e) => updateJc(name, 'second', e.target.value)} />
              </label>
              <label style={{ fontSize: '0.8rem' }}>
                jointType <span className="field-required">*</span>
                <input className="field-input" placeholder="e.g. ScrewJoint"
                  value={jc.jointType} onChange={(e) => updateJc(name, 'jointType', e.target.value)} />
              </label>
              <label style={{ fontSize: '0.8rem' }}>
                jointParamsRef <span className="field-required">*</span>
                <input className="field-input" placeholder="JointParams idShort"
                  value={jc.jointParamsRef} onChange={(e) => updateJc(name, 'jointParamsRef', e.target.value)} />
              </label>
            </div>
            <label style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
              jointStandard
              <input className="field-input" placeholder="Optional standard ref"
                value={jc.jointStandard ?? ''}
                onChange={(e) => updateJc(name, 'jointStandard', e.target.value || undefined as any)} />
            </label>
          </div>
        ))}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
          <input className="field-input" placeholder="New connection name"
            value={newJcName} onChange={(e) => setNewJcName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addJointConnection(); }} />
          <button className="btn btn--primary" onClick={addJointConnection}>Add</button>
        </div>
      </fieldset>

      {/* JointParams */}
      <fieldset className="field-group" style={{ border: '1px solid var(--border-color)', borderRadius: 8, padding: '0.75rem' }}>
        <legend style={{ fontWeight: 600 }}>JointParams ({Object.keys(jointParams).length})</legend>
        {Object.entries(jointParams).map(([name, jp]) => (
          <div key={name} className="card" style={{ marginBottom: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>{name}</strong>
              <button className="btn btn--ghost" style={{ color: 'var(--danger-color)', padding: '2px 6px' }}
                onClick={() => delJointParams(name)}>✕</button>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
              TypeParams: {Object.keys(jp.typeParams ?? {}).length} | TypeFile: {jp.typeFile ?? '—'}
            </div>
          </div>
        ))}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
          <input className="field-input" placeholder="New params name"
            value={newJpName} onChange={(e) => setNewJpName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addJointParams(); }} />
          <button className="btn btn--primary" onClick={addJointParams}>Add</button>
        </div>
      </fieldset>
    </div>
  );
}

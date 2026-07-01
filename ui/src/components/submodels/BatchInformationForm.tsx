import { useAppStore } from '../../store/useAppStore';
import type { BatchInformationConfig } from '../../types/resourceaas';

/** Fields mirroring APSO batch_information.ttl: cardinality [1] or [0..1]. */
const FIELDS: { key: keyof BatchInformationConfig; label: string; required: boolean }[] = [
  { key: 'ProductName',    label: 'ProductName',    required: true  },
  { key: 'ProductFamily',  label: 'ProductFamily',  required: false },
  { key: 'OrderNumber',    label: 'OrderNumber',    required: false },
  { key: 'OrderTimestamp', label: 'OrderTimestamp', required: false },
  { key: 'Quantity',       label: 'Quantity',       required: true  },
  { key: 'Packaging',      label: 'Packaging',      required: false },
  { key: 'Status',         label: 'Status',         required: true  },
];

export function BatchInformationForm() {
  const parsedProfile = useAppStore((s) => s.parsedProfile);
  const updateProfileField = useAppStore((s) => s.updateProfileField);

  if (!parsedProfile) return <p className="empty-state">No profile loaded.</p>;
  const systemId = Object.keys(parsedProfile)[0];
  const cfg = (parsedProfile[systemId]?.BatchInformation ?? {}) as BatchInformationConfig;

  return (
    <div className="submodel-form">
      {FIELDS.map(({ key, label, required }) => (
        <div className="field-group" key={key}>
          <label className="field-label">
            {label}
            {required && <span className="field-required" title="Required"> *</span>}
          </label>
          <input
            className="field-input"
            value={(cfg as any)[key] ?? ''}
            placeholder={required ? 'Required' : 'Optional'}
            onChange={(e) => updateProfileField([systemId, 'BatchInformation', key], e.target.value)}
          />
        </div>
      ))}
    </div>
  );
}

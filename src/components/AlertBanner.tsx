import { AlertTriangle, HeartPulse, ShieldQuestion } from 'lucide-react';
import type { Allergy } from '@/server/db/schema';

type Props = {
  allergyStatus: 'unknown' | 'nka' | 'recorded';
  allergies: Allergy[];
  chronicConditions: string[];
  compact?: boolean;
};

// FEATURES A3: persistent clinical alert banner shown on every patient-context screen.
// Severe/anaphylaxis allergies red, other allergies and chronic conditions amber, NKA grey.
export function AlertBanner({ allergyStatus, allergies, chronicConditions, compact }: Props) {
  const severe = allergies.filter((a) => a.severity === 'severe' || a.severity === 'anaphylaxis');
  const other = allergies.filter((a) => !severe.includes(a));
  const pad = compact ? 'px-3 py-1.5' : 'px-4 py-2.5';

  return (
    <div className="space-y-1.5" role="region" aria-label="Clinical alerts">
      {allergyStatus === 'unknown' && (
        <div className={`flex items-center gap-2 rounded-md border border-warn bg-warn-soft ${pad} text-sm font-semibold text-warn`}>
          <ShieldQuestion size={18} aria-hidden /> Allergies not recorded — ask the patient before prescribing
        </div>
      )}
      {allergyStatus === 'nka' && (
        <div className={`flex items-center gap-2 rounded-md border border-line bg-line-soft ${pad} text-sm font-semibold text-ink-soft`}>
          No known allergies
        </div>
      )}
      {severe.length > 0 && (
        <div className={`flex flex-wrap items-center gap-2 rounded-md border-2 border-danger bg-danger-soft ${pad} text-sm font-bold text-danger`}>
          <AlertTriangle size={18} aria-hidden /> SEVERE ALLERGY:
          {severe.map((a) => (
            <span key={a.substance} className="rounded bg-danger px-2 py-0.5 text-white">
              {a.substance}{a.severity === 'anaphylaxis' ? ' (anaphylaxis)' : ''}{a.reaction ? ` — ${a.reaction}` : ''}
            </span>
          ))}
        </div>
      )}
      {other.length > 0 && (
        <div className={`flex flex-wrap items-center gap-2 rounded-md border border-warn bg-warn-soft ${pad} text-sm font-semibold text-warn`}>
          <AlertTriangle size={16} aria-hidden /> Allergies:
          {other.map((a) => <span key={a.substance}>{a.substance} ({a.severity}{a.reaction ? `, ${a.reaction}` : ''})</span>)}
        </div>
      )}
      {chronicConditions.length > 0 && (
        <div className={`flex flex-wrap items-center gap-2 rounded-md border border-warn/50 bg-warn-soft/60 ${pad} text-sm font-semibold text-warn`}>
          <HeartPulse size={16} aria-hidden /> Chronic:
          {chronicConditions.map((c) => <span key={c} className="badge badge-amber">{c}</span>)}
        </div>
      )}
    </div>
  );
}

import type { PracticeSettings } from '@/server/services/settings';

export function Letterhead({ s, title, number }: { s: PracticeSettings; title: string; number?: string }) {
  return (
    <header className="mb-6 flex items-start justify-between border-b-2 border-ink pb-3">
      <div>
        <p className="text-xl font-black">{s.practice_name}</p>
        {s.letterhead_note && <p className="text-sm">{s.letterhead_note}</p>}
        <p className="text-xs">{s.practice_address}</p>
        <p className="text-xs">Tel {s.practice_phone} · {s.practice_email}{s.ahfoz_practice_no ? ` · Practice no. ${s.ahfoz_practice_no}` : ''}</p>
      </div>
      <div className="text-right">
        <p className="text-lg font-bold uppercase tracking-wide">{title}</p>
        {number && <p className="font-mono text-sm">{number}</p>}
      </div>
    </header>
  );
}

export function PatientBlock({ p, date }: { p: { firstName: string; lastName: string; dob: string | null; sex: string | null; fileNo: string; nationalId: string | null; address: string | null; city: string | null; medicalAidName: string | null; maMemberNo: string | null; maDependantCode: string | null }; date: string }) {
  return (
    <section className="mb-5 grid grid-cols-2 gap-x-6 gap-y-0.5 text-sm">
      <p><span className="text-muted">Patient:</span> <strong>{p.firstName} {p.lastName}</strong></p>
      <p><span className="text-muted">Date:</span> {date}</p>
      <p><span className="text-muted">DOB / Sex:</span> {p.dob ?? '—'} · {p.sex ?? '—'}</p>
      <p><span className="text-muted">File no.:</span> {p.fileNo}</p>
      <p><span className="text-muted">National ID:</span> {p.nationalId ?? '—'}</p>
      <p><span className="text-muted">Address:</span> {[p.address, p.city].filter(Boolean).join(', ') || '—'}</p>
      <p className="col-span-2"><span className="text-muted">Medical aid:</span> {p.medicalAidName ? `${p.medicalAidName} · No. ${p.maMemberNo} · Dep. ${p.maDependantCode ?? '00'}` : 'Cash / private'}</p>
    </section>
  );
}

export function SignatureBlock({ doctor }: { doctor: { title: string | null; name: string; qualification: string | null; hpzNumber: string | null } }) {
  return (
    <footer className="mt-10 flex items-end justify-between gap-6 text-sm">
      <div>
        <div className="mb-1 h-10 w-56 border-b border-ink" />
        <p className="font-semibold">{doctor.title ?? 'Dr'} {doctor.name}</p>
        {doctor.qualification && <p className="text-xs">{doctor.qualification}</p>}
        <p className="text-xs">HPZ / MDPCZ Reg. No.: <strong>{doctor.hpzNumber ?? '—'}</strong></p>
      </div>
      <div className="flex h-28 w-44 items-center justify-center border-2 border-dashed border-muted text-xs text-muted">Practice stamp</div>
    </footer>
  );
}

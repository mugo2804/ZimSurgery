// Seeds practice settings, reference data, staff accounts and (first run only) demo patients.
// Safe to re-run: reference rows are upserted, staff/demo data is only created on an empty DB.
import '../../../scripts/load-env';
import { count, eq } from 'drizzle-orm';
import { handle, getRootDb, withTx, nextNumber } from './index';
import * as s from './schema';
import { createStaff } from '../services/users';
import { localDay, localDateTime } from '@/lib/time';

const DEMO_PASSWORD = process.env.SEED_PASSWORD ?? 'Zimmed-Demo-2026!';

const SETTINGS: Record<string, string> = {
  practice_name: 'Avondale Family Medical Practice',
  practice_address: '12 King George Road, Avondale, Harare',
  practice_phone: '+263 242 000 000',
  practice_email: 'reception@example.co.zw',
  ahfoz_practice_no: 'AHFOZ-0000',
  letterhead_note: 'General Practice & Family Medicine',
  reminder_hours_before: '24',
};

const MEDICAL_AIDS = [
  { name: 'CIMAS', code: 'CIMAS', claimsEmail: 'claims@cimas.example' },
  { name: 'PSMAS', code: 'PSMAS', claimsEmail: 'claims@psmas.example' },
  { name: 'First Mutual Health', code: 'FMH', claimsEmail: 'claims@fmh.example' },
  { name: 'Generation Health', code: 'GEN', claimsEmail: 'claims@generationhealth.example' },
  { name: 'Fidelity Life Medical Aid', code: 'FID', claimsEmail: 'claims@fidelity.example' },
  { name: 'MASCA', code: 'MASCA', claimsEmail: 'claims@masca.example' },
];

// Placeholder tariffs in the AHFoZ style — replace with the practice's current schedule (docs/THIRD_PARTY.md)
const TARIFFS = [
  { code: '0190', description: 'GP consultation', category: 'Consultation', cash: 3000, aid: 2500 },
  { code: '0191', description: 'GP consultation — extended', category: 'Consultation', cash: 4500, aid: 3600 },
  { code: '0192', description: 'GP follow-up consultation', category: 'Consultation', cash: 2000, aid: 1800 },
  { code: '0173', description: 'Specialist consultation', category: 'Consultation', cash: 6000, aid: 5000 },
  { code: '0145', description: 'After-hours consultation surcharge', category: 'Consultation', cash: 1500, aid: 1000 },
  { code: '0201', description: 'Injection administration', category: 'Procedure', cash: 500, aid: 400 },
  { code: '0222', description: 'Wound dressing', category: 'Procedure', cash: 1000, aid: 800 },
  { code: '0227', description: 'Suturing of laceration (simple)', category: 'Procedure', cash: 3500, aid: 2800 },
  { code: '1191', description: 'Nebulisation', category: 'Procedure', cash: 1200, aid: 1000 },
  { code: '1232', description: 'ECG (12 lead) with interpretation', category: 'Investigation', cash: 2500, aid: 2000 },
  { code: '4188', description: 'Rapid malaria test', category: 'Investigation', cash: 800, aid: 600 },
  { code: '4019', description: 'Urinalysis (dipstick)', category: 'Investigation', cash: 500, aid: 400 },
  { code: '4057', description: 'Blood glucose (finger prick)', category: 'Investigation', cash: 500, aid: 400 },
  { code: '4614', description: 'Urine pregnancy test', category: 'Investigation', cash: 700, aid: 500 },
  { code: '0109', description: 'Medical certificate / report', category: 'Administrative', cash: 1000, aid: 0 },
  { code: '0003', description: 'IV line insertion and fluids administration', category: 'Procedure', cash: 2500, aid: 2000 },
];

const STOCK = [
  { name: 'Tetanus toxoid 0.5ml', category: 'Vaccine', unit: 'ampoule', qty: 40, reorderLevel: 10, batchNo: 'TT2406', expiryDate: '2027-06-30' },
  { name: 'Ceftriaxone 1g vial', category: 'Injectable', unit: 'vial', qty: 25, reorderLevel: 10, batchNo: 'CF2503', expiryDate: '2027-03-31' },
  { name: 'Diclofenac 75mg/3ml', category: 'Injectable', unit: 'ampoule', qty: 8, reorderLevel: 15, batchNo: 'DC2411', expiryDate: '2026-12-15' },
  { name: 'Medroxyprogesterone 150mg', category: 'Injectable', unit: 'vial', qty: 30, reorderLevel: 10, batchNo: 'DP2502', expiryDate: '2027-08-31' },
  { name: 'Salbutamol nebules 2.5mg', category: 'Respiratory', unit: 'nebule', qty: 60, reorderLevel: 20, batchNo: 'SB2501', expiryDate: '2027-01-31' },
  { name: 'Malaria RDT kits', category: 'Diagnostic', unit: 'test', qty: 50, reorderLevel: 20, batchNo: 'MR2504', expiryDate: '2026-12-01' },
  { name: 'Glucose test strips', category: 'Diagnostic', unit: 'strip', qty: 100, reorderLevel: 50, batchNo: 'GS2505', expiryDate: '2027-05-31' },
  { name: 'Sodium chloride 0.9% 1L', category: 'IV fluid', unit: 'bag', qty: 12, reorderLevel: 10, batchNo: 'NS2502', expiryDate: '2027-02-28' },
];

const STAFF = [
  { username: 'manager', name: 'Rutendo Mapfumo', role: 'admin' as const },
  { username: 'dr.moyo', name: 'Tendai Moyo', role: 'doctor' as const, title: 'Dr', qualification: 'MBChB (UZ)', hpzNumber: 'MDPCZ/A1234' },
  { username: 'dr.ncube', name: 'Sipho Ncube', role: 'doctor' as const, title: 'Dr', qualification: 'MBChB (NUST), MMed', hpzNumber: 'MDPCZ/A2345' },
  { username: 'dr.chikore', name: 'Farai Chikore', role: 'doctor' as const, title: 'Dr', qualification: 'MBBS, FCP (SA)', hpzNumber: 'MDPCZ/A3456' },
  { username: 'sr.dube', name: 'Sibusisiwe Dube', role: 'nurse' as const, title: 'Sr', qualification: 'RGN' },
  { username: 'sr.mutasa', name: 'Precious Mutasa', role: 'nurse' as const, title: 'Sr', qualification: 'RGN, RM' },
  { username: 'reception', name: 'Tatenda Banda', role: 'reception' as const },
];

async function seedReference() {
  const d = await getRootDb();
  for (const [key, value] of Object.entries(SETTINGS)) {
    await d.insert(s.settings).values({ key, value }).onConflictDoNothing();
  }
  for (const a of MEDICAL_AIDS) await d.insert(s.medicalAids).values(a).onConflictDoNothing();
  for (const t of TARIFFS) {
    await d.insert(s.tariffs).values({ code: t.code, description: t.description, category: t.category, cashCents: t.cash, aidCents: t.aid }).onConflictDoNothing();
  }
  const [{ n: rates }] = await d.select({ n: count() }).from(s.exchangeRates);
  if (!rates) await d.insert(s.exchangeRates).values({ zigPerUsd: '26.7500', source: 'Seed value — enter today\'s RBZ rate' });
}

async function seedDemo() {
  // Demo staff share a published password, so they must never exist on a real practice server
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_SEED !== 'true') {
    console.log('• Production: skipping demo staff and patients (create real users in Administration)');
    return;
  }
  const d = await getRootDb();
  const [{ n }] = await d.select({ n: count() }).from(s.user);
  if (n > 0) {
    console.log('• Staff already exist — skipping staff and demo patients');
    return;
  }
  const ids: Record<string, string> = {};
  await withTx(async () => {
    for (const st of STAFF) ids[st.username] = await createStaff({ ...st, password: DEMO_PASSWORD });
  });

  for (const item of STOCK) await d.insert(s.stockItems).values(item);

  const aids = Object.fromEntries((await d.select().from(s.medicalAids)).map((a) => [a.code, a.id]));
  const demo = [
    { firstName: 'Tapiwa', lastName: 'Chiweshe', dob: '1968-04-12', sex: 'M' as const, nationalId: '63-123456 F 42', phone: '263772123456', city: 'Harare',
      address: '45 Mutare Road, Msasa', medicalAidId: aids.CIMAS, maMemberNo: 'CIM0012345', maPrincipalName: 'Tapiwa Chiweshe', maDependantCode: '00',
      allergyStatus: 'recorded' as const, allergies: [{ substance: 'Penicillin', severity: 'anaphylaxis' as const, reaction: 'Throat swelling' }],
      chronicConditions: ['Hypertension', 'Type 2 Diabetes'], recallIntervalMonths: 3 },
    { firstName: 'Nyasha', lastName: 'Mukwena', dob: '1991-09-30', sex: 'F' as const, nationalId: '08-765432 K 18', phone: '263783456789', city: 'Harare',
      address: '7 Lomagundi Road, Mabelreign', medicalAidId: aids.PSMAS, maMemberNo: 'PS-778899', maPrincipalName: 'Kudzai Mukwena', maDependantCode: '01',
      allergyStatus: 'nka' as const, allergies: [], chronicConditions: ['Asthma'], recallIntervalMonths: 6 },
    { firstName: 'Blessing', lastName: 'Sibanda', dob: '2015-02-03', sex: 'M' as const, phone: '263712987654', city: 'Chitungwiza', address: '1123 Unit L, Seke',
      allergyStatus: 'recorded' as const, allergies: [{ substance: 'Sulfa', severity: 'moderate' as const, reaction: 'Rash' }], chronicConditions: [] },
    { firstName: 'Grace', lastName: 'Madziva', dob: '1955-11-20', sex: 'F' as const, nationalId: '29-334455 R 29', phone: '263774000111', city: 'Harare',
      address: '3 Churchill Avenue, Alexandra Park', medicalAidId: aids.FMH, maMemberNo: 'FMH-55210', maPrincipalName: 'Grace Madziva', maDependantCode: '00',
      allergyStatus: 'unknown' as const, allergies: [], chronicConditions: ['Hypertension', 'Heart failure'], recallIntervalMonths: 3 },
  ];

  const patientIds: string[] = [];
  for (const p of demo) {
    const [row] = await d.insert(s.patients).values({
      ...p, whatsapp: p.phone, fileNo: await nextNumber('patient', 'ZMP-'), createdBy: ids.reception,
    }).returning({ id: s.patients.id });
    patientIds.push(row.id);
  }

  const today = localDay();
  const appts = [
    { patientId: patientIds[0], doctorId: ids['dr.moyo'], startAt: localDateTime(today, '09:00'), reason: 'Chronic review — BP & sugar' },
    { patientId: patientIds[1], doctorId: ids['dr.ncube'], startAt: localDateTime(today, '09:30'), reason: 'Asthma follow-up' },
    { patientId: patientIds[3], doctorId: ids['dr.chikore'], startAt: localDateTime(today, '10:15'), reason: 'Shortness of breath' },
  ];
  for (const a of appts) await d.insert(s.appointments).values({ ...a, createdBy: ids.reception });

  console.log('\n✔ Demo staff accounts (password for all: %s)', DEMO_PASSWORD);
  for (const st of STAFF) console.log(`   ${st.username.padEnd(12)} ${st.role.padEnd(10)} ${st.name}`);
  console.log('  Change these passwords before using real patient data.\n');
}

await seedReference();
await seedDemo();
const d = await getRootDb();
const [{ n: aidsCount }] = await d.select({ n: count() }).from(s.medicalAids).where(eq(s.medicalAids.active, true));
console.log(`✔ Seed complete (${aidsCount} medical aids, ${TARIFFS.length} tariffs)`);
await (await handle()).close();

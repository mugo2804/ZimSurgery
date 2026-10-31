// Labs, test panels, chronic conditions, and vital-sign reference ranges (FEATURES §C).

export const LABS = ['Lancet Laboratories', 'PathCare Zimbabwe', 'National Pathology Research Services', 'Other'] as const;

export const LAB_TESTS: { group: string; tests: string[] }[] = [
  { group: 'Haematology', tests: ['FBC', 'ESR', 'Blood group & Rh', 'Coagulation screen (PT/INR)', 'Sickle cell screen'] },
  { group: 'Chemistry', tests: ['U&E + Creatinine', 'LFT', 'Lipogram', 'FBS', 'HbA1c', 'TFT (TSH, FT4)', 'Uric acid', 'CRP', 'Calcium/Phosphate/Magnesium', 'PSA', 'Amylase'] },
  { group: 'Serology / infection', tests: ['Malaria RDT', 'Malaria smear (MPS)', 'HIV test', 'CD4 count', 'HIV viral load', 'Hepatitis B sAg', 'Hepatitis C Ab', 'RPR/VDRL', 'Widal / Typhoid', 'H. pylori Ag', 'COVID-19 PCR/Ag'] },
  { group: 'Microbiology', tests: ['Urine MCS', 'Urinalysis (dipstick)', 'Stool MCS', 'Stool ova & parasites', 'Sputum GeneXpert (TB)', 'High vaginal swab MCS', 'Pus swab MCS', 'Blood culture'] },
  { group: 'Pregnancy & women', tests: ['Urine β-hCG', 'Serum β-hCG', 'Pap smear', 'VIAC'] },
  { group: 'Imaging', tests: ['Chest X-ray', 'X-ray (other — specify)', 'Ultrasound abdomen', 'Ultrasound pelvis', 'Obstetric ultrasound', 'ECG', 'Echocardiogram', 'CT scan (specify)', 'MRI (specify)'] },
];

export const CHRONIC_CONDITIONS = [
  'Hypertension', 'Type 2 Diabetes', 'Type 1 Diabetes', 'Asthma', 'COPD', 'HIV', 'Epilepsy', 'Heart failure',
  'Chronic kidney disease', 'Hypothyroidism', 'Hyperthyroidism', 'Depression', 'Rheumatoid arthritis', 'Gout',
  'Sickle cell disease', 'Hyperlipidaemia', 'TB (on treatment)', 'Pregnancy',
];

// Suggested recall interval (months) when a chronic condition is added
export const RECALL_DEFAULTS: Record<string, number> = {
  Hypertension: 3, 'Type 2 Diabetes': 3, 'Type 1 Diabetes': 3, Asthma: 6, COPD: 6, HIV: 3, Epilepsy: 6,
  'Heart failure': 3, 'Chronic kidney disease': 3, Hypothyroidism: 6, Hyperthyroidism: 3,
};

export type VitalKey = 'bpSys' | 'bpDia' | 'pulse' | 'respRate' | 'tempC' | 'spo2' | 'glucose';

// Thresholds from FEATURES §C (triage)
export function vitalFlags(v: Partial<Record<VitalKey, number | null>>): Partial<Record<VitalKey, 'high' | 'low'>> {
  const f: Partial<Record<VitalKey, 'high' | 'low'>> = {};
  const n = (x: number | null | undefined) => (typeof x === 'number' && !Number.isNaN(x) ? x : null);
  const sys = n(v.bpSys), dia = n(v.bpDia), pulse = n(v.pulse), temp = n(v.tempC), spo2 = n(v.spo2), glu = n(v.glucose), rr = n(v.respRate);
  if (sys !== null) { if (sys >= 140) f.bpSys = 'high'; else if (sys < 90) f.bpSys = 'low'; }
  if (dia !== null) { if (dia >= 90) f.bpDia = 'high'; else if (dia < 60) f.bpDia = 'low'; }
  if (pulse !== null) { if (pulse > 100) f.pulse = 'high'; else if (pulse < 50) f.pulse = 'low'; }
  if (temp !== null) { if (temp >= 37.5) f.tempC = 'high'; else if (temp < 35.5) f.tempC = 'low'; }
  if (spo2 !== null && spo2 < 94) f.spo2 = 'low';
  if (glu !== null) { if (glu > 11.1) f.glucose = 'high'; else if (glu < 4.0) f.glucose = 'low'; }
  if (rr !== null) { if (rr > 24) f.respRate = 'high'; else if (rr < 10) f.respRate = 'low'; }
  return f;
}

export const PROCEDURE_ROUTES = ['IM', 'IV', 'SC', 'ID', 'Oral', 'Topical', 'Nebulised', 'Other'];

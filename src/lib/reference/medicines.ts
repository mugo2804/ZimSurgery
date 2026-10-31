// Formulary of generics commonly stocked in Zimbabwean pharmacies. Not a substitute for MCAZ
// registration status — the practice should review it (docs/THIRD_PARTY.md).
// `classes` drive the allergy conflict check (FEATURES §C, AC C3).

export type Medicine = {
  name: string;
  strength: string;
  form: string;
  dose: string;
  frequency: string;
  duration?: string;
  classes: string[];
};

const m = (name: string, strength: string, form: string, dose: string, frequency: string, classes: string[] = [], duration?: string): Medicine =>
  ({ name, strength, form, dose, frequency, classes, duration });

export const MEDICINES: Medicine[] = [
  // Analgesics / anti-inflammatories
  m('Paracetamol', '500mg', 'tablet', '1-2 tabs', 'every 6 hours as needed', ['analgesic']),
  m('Paracetamol syrup', '120mg/5ml', 'syrup', 'per weight', 'every 6 hours', ['analgesic']),
  m('Ibuprofen', '400mg', 'tablet', '1 tab', 'three times daily with food', ['nsaid'], '5 days'),
  m('Diclofenac', '50mg', 'tablet', '1 tab', 'three times daily with food', ['nsaid'], '5 days'),
  m('Aspirin', '75mg', 'tablet', '1 tab', 'once daily', ['nsaid', 'salicylate', 'antiplatelet']),
  m('Tramadol', '50mg', 'capsule', '1 cap', 'every 8 hours as needed', ['opioid'], '5 days'),
  m('Codeine phosphate', '30mg', 'tablet', '1 tab', 'every 6 hours as needed', ['opioid']),
  // Antibiotics
  m('Amoxicillin', '500mg', 'capsule', '1 cap', 'three times daily', ['penicillin', 'beta-lactam'], '5 days'),
  m('Amoxicillin-Clavulanate (Co-amoxiclav)', '625mg', 'tablet', '1 tab', 'twice daily', ['penicillin', 'beta-lactam'], '7 days'),
  m('Phenoxymethylpenicillin (Pen V)', '250mg', 'tablet', '2 tabs', 'four times daily', ['penicillin', 'beta-lactam'], '10 days'),
  m('Benzathine benzylpenicillin', '2.4MU', 'injection', '2.4MU IM', 'single dose', ['penicillin', 'beta-lactam']),
  m('Flucloxacillin', '500mg', 'capsule', '1 cap', 'four times daily', ['penicillin', 'beta-lactam'], '7 days'),
  m('Cefalexin', '500mg', 'capsule', '1 cap', 'four times daily', ['cephalosporin', 'beta-lactam'], '7 days'),
  m('Ceftriaxone', '1g', 'injection', '1g IM/IV', 'once daily', ['cephalosporin', 'beta-lactam']),
  m('Cefuroxime', '500mg', 'tablet', '1 tab', 'twice daily', ['cephalosporin', 'beta-lactam'], '7 days'),
  m('Azithromycin', '500mg', 'tablet', '1 tab', 'once daily', ['macrolide'], '3 days'),
  m('Erythromycin', '500mg', 'tablet', '1 tab', 'four times daily', ['macrolide'], '7 days'),
  m('Clarithromycin', '500mg', 'tablet', '1 tab', 'twice daily', ['macrolide'], '7 days'),
  m('Doxycycline', '100mg', 'capsule', '1 cap', 'twice daily', ['tetracycline'], '7 days'),
  m('Ciprofloxacin', '500mg', 'tablet', '1 tab', 'twice daily', ['fluoroquinolone', 'quinolone'], '5 days'),
  m('Levofloxacin', '500mg', 'tablet', '1 tab', 'once daily', ['fluoroquinolone', 'quinolone'], '7 days'),
  m('Co-trimoxazole', '960mg', 'tablet', '1 tab', 'twice daily', ['sulfonamide', 'sulfa'], '5 days'),
  m('Nitrofurantoin', '100mg', 'capsule', '1 cap', 'twice daily', ['nitrofuran'], '5 days'),
  m('Metronidazole', '400mg', 'tablet', '1 tab', 'three times daily', ['nitroimidazole'], '7 days'),
  m('Tinidazole', '500mg', 'tablet', '4 tabs', 'single dose', ['nitroimidazole']),
  m('Gentamicin', '80mg', 'injection', '80mg IM', 'every 8 hours', ['aminoglycoside']),
  // Antimalarials / antiparasitics
  m('Artemether-Lumefantrine (Coartem)', '20/120mg', 'tablet', '4 tabs', 'twice daily (6 doses)', ['antimalarial', 'artemisinin'], '3 days'),
  m('Artesunate', '60mg', 'injection', '2.4mg/kg IV', 'at 0, 12, 24 hours', ['antimalarial', 'artemisinin']),
  m('Quinine sulphate', '300mg', 'tablet', '2 tabs', 'three times daily', ['antimalarial', 'quinine'], '7 days'),
  m('Albendazole', '400mg', 'tablet', '1 tab', 'single dose', ['anthelmintic']),
  m('Praziquantel', '600mg', 'tablet', '40mg/kg', 'single dose', ['anthelmintic']),
  m('Mebendazole', '100mg', 'tablet', '1 tab', 'twice daily', ['anthelmintic'], '3 days'),
  // Antifungals / antivirals
  m('Fluconazole', '150mg', 'capsule', '1 cap', 'single dose', ['azole antifungal']),
  m('Clotrimazole cream', '1%', 'cream', 'apply thinly', 'twice daily', ['azole antifungal'], '2 weeks'),
  m('Nystatin oral suspension', '100,000IU/ml', 'suspension', '1ml', 'four times daily', ['antifungal'], '7 days'),
  m('Acyclovir', '400mg', 'tablet', '1 tab', 'three times daily', ['antiviral'], '7 days'),
  m('Tenofovir/Lamivudine/Dolutegravir (TLD)', '300/300/50mg', 'tablet', '1 tab', 'once daily', ['antiretroviral']),
  // Cardiovascular
  m('Amlodipine', '5mg', 'tablet', '1 tab', 'once daily', ['calcium channel blocker']),
  m('Amlodipine', '10mg', 'tablet', '1 tab', 'once daily', ['calcium channel blocker']),
  m('Nifedipine SR', '20mg', 'tablet', '1 tab', 'twice daily', ['calcium channel blocker']),
  m('Hydrochlorothiazide', '25mg', 'tablet', '1 tab', 'once daily (morning)', ['thiazide diuretic', 'sulfonamide']),
  m('Enalapril', '10mg', 'tablet', '1 tab', 'once daily', ['ace inhibitor']),
  m('Lisinopril', '10mg', 'tablet', '1 tab', 'once daily', ['ace inhibitor']),
  m('Losartan', '50mg', 'tablet', '1 tab', 'once daily', ['arb']),
  m('Atenolol', '50mg', 'tablet', '1 tab', 'once daily', ['beta blocker']),
  m('Carvedilol', '6.25mg', 'tablet', '1 tab', 'twice daily', ['beta blocker']),
  m('Furosemide', '40mg', 'tablet', '1 tab', 'once daily (morning)', ['loop diuretic', 'sulfonamide']),
  m('Spironolactone', '25mg', 'tablet', '1 tab', 'once daily', ['potassium-sparing diuretic']),
  m('Atorvastatin', '20mg', 'tablet', '1 tab', 'once daily (night)', ['statin']),
  m('Simvastatin', '20mg', 'tablet', '1 tab', 'once daily (night)', ['statin']),
  // Diabetes / endocrine
  m('Metformin', '500mg', 'tablet', '1 tab', 'twice daily with meals', ['biguanide']),
  m('Metformin', '850mg', 'tablet', '1 tab', 'twice daily with meals', ['biguanide']),
  m('Gliclazide', '80mg', 'tablet', '1 tab', 'twice daily with meals', ['sulfonylurea']),
  m('Glibenclamide', '5mg', 'tablet', '1 tab', 'once daily with breakfast', ['sulfonylurea']),
  m('Insulin isophane (NPH)', '100IU/ml', 'injection', 'as directed', 'twice daily', ['insulin']),
  m('Insulin soluble (regular)', '100IU/ml', 'injection', 'as directed', 'with meals', ['insulin']),
  m('Levothyroxine', '50mcg', 'tablet', '1 tab', 'once daily (empty stomach)', ['thyroid hormone']),
  m('Carbimazole', '5mg', 'tablet', '1 tab', 'three times daily', ['antithyroid']),
  // Respiratory / allergy
  m('Salbutamol inhaler', '100mcg/dose', 'inhaler', '2 puffs', 'every 4-6 hours as needed', ['beta-agonist']),
  m('Beclomethasone inhaler', '100mcg/dose', 'inhaler', '2 puffs', 'twice daily', ['corticosteroid']),
  m('Prednisolone', '5mg', 'tablet', '8 tabs (40mg)', 'once daily (morning)', ['corticosteroid'], '5 days'),
  m('Hydrocortisone', '100mg', 'injection', '100mg IV/IM', 'stat', ['corticosteroid']),
  m('Cetirizine', '10mg', 'tablet', '1 tab', 'once daily', ['antihistamine'], '7 days'),
  m('Loratadine', '10mg', 'tablet', '1 tab', 'once daily', ['antihistamine'], '7 days'),
  m('Chlorphenamine', '4mg', 'tablet', '1 tab', 'three times daily', ['antihistamine'], '5 days'),
  m('Promethazine', '25mg', 'tablet', '1 tab', 'at night', ['antihistamine', 'phenothiazine']),
  m('Carbocisteine syrup', '250mg/5ml', 'syrup', '10ml', 'three times daily', ['mucolytic'], '5 days'),
  // Gastrointestinal
  m('Omeprazole', '20mg', 'capsule', '1 cap', 'once daily before breakfast', ['proton pump inhibitor'], '4 weeks'),
  m('Pantoprazole', '40mg', 'tablet', '1 tab', 'once daily', ['proton pump inhibitor'], '4 weeks'),
  m('Magnesium trisilicate', 'mixture', 'suspension', '10ml', 'three times daily', ['antacid']),
  m('Metoclopramide', '10mg', 'tablet', '1 tab', 'three times daily', ['antiemetic'], '3 days'),
  m('Hyoscine butylbromide (Buscopan)', '10mg', 'tablet', '2 tabs', 'four times daily as needed', ['antispasmodic']),
  m('Loperamide', '2mg', 'capsule', '2 caps then 1', 'after each loose stool (max 8/day)', ['antidiarrhoeal']),
  m('Oral rehydration salts (ORS)', '1 sachet/L', 'powder', '200ml', 'after each loose stool', []),
  m('Zinc sulphate', '20mg', 'tablet', '1 tab', 'once daily', ['mineral'], '10 days'),
  m('Lactulose', '3.3g/5ml', 'syrup', '15ml', 'twice daily', ['laxative']),
  // CNS / mental health
  m('Amitriptyline', '25mg', 'tablet', '1 tab', 'at night', ['tricyclic antidepressant']),
  m('Fluoxetine', '20mg', 'capsule', '1 cap', 'once daily (morning)', ['ssri']),
  m('Sertraline', '50mg', 'tablet', '1 tab', 'once daily', ['ssri']),
  m('Diazepam', '5mg', 'tablet', '1 tab', 'at night as needed', ['benzodiazepine'], '5 days'),
  m('Carbamazepine', '200mg', 'tablet', '1 tab', 'twice daily', ['anticonvulsant']),
  m('Sodium valproate', '200mg', 'tablet', '1 tab', 'twice daily', ['anticonvulsant']),
  m('Phenytoin', '100mg', 'capsule', '1 cap', 'three times daily', ['anticonvulsant']),
  // Women's health / supplements
  m('Ferrous sulphate', '200mg', 'tablet', '1 tab', 'three times daily', ['iron'], '3 months'),
  m('Folic acid', '5mg', 'tablet', '1 tab', 'once daily', ['vitamin']),
  m('Ferrous + Folic acid (pregnancy)', '200mg/0.4mg', 'tablet', '1 tab', 'once daily', ['iron', 'vitamin']),
  m('Vitamin B complex', '—', 'tablet', '1 tab', 'once daily', ['vitamin'], '30 days'),
  m('Combined oral contraceptive (Microgynon)', '30/150mcg', 'tablet', '1 tab', 'once daily', ['hormonal contraceptive']),
  m('Medroxyprogesterone acetate (Depo-Provera)', '150mg/ml', 'injection', '150mg IM', 'every 12 weeks', ['hormonal contraceptive']),
  m('Mefenamic acid', '500mg', 'capsule', '1 cap', 'three times daily', ['nsaid'], '3 days'),
  // Topicals / eye / ear
  m('Hydrocortisone cream', '1%', 'cream', 'apply thinly', 'twice daily', ['corticosteroid'], '7 days'),
  m('Betamethasone cream', '0.1%', 'cream', 'apply thinly', 'twice daily', ['corticosteroid'], '7 days'),
  m('Chloramphenicol eye drops', '0.5%', 'eye drops', '1 drop', 'every 2 hours (waking)', ['amphenicol'], '5 days'),
  m('Tetracycline eye ointment', '1%', 'eye ointment', 'apply', 'three times daily', ['tetracycline'], '5 days'),
  m('Ciprofloxacin ear drops', '0.3%', 'ear drops', '3 drops', 'twice daily', ['fluoroquinolone', 'quinolone'], '7 days'),
  m('Benzyl benzoate lotion', '25%', 'lotion', 'apply neck down', 'once, repeat in 7 days', ['scabicide']),
  // Vaccines / emergency
  m('Tetanus toxoid', '0.5ml', 'injection', '0.5ml IM', 'single dose', ['vaccine']),
  m('Adrenaline (Epinephrine)', '1mg/ml', 'injection', '0.5mg IM', 'stat, repeat after 5 min if needed', ['sympathomimetic']),
];

// Common allergy names → the drug classes they imply
const ALLERGY_ALIASES: Record<string, string[]> = {
  penicillin: ['penicillin'],
  penicillins: ['penicillin'],
  'beta-lactam': ['beta-lactam'],
  cephalosporin: ['cephalosporin'],
  sulfa: ['sulfonamide'],
  sulpha: ['sulfonamide'],
  sulphonamide: ['sulfonamide'],
  sulfonamide: ['sulfonamide'],
  'co-trimoxazole': ['sulfonamide'],
  bactrim: ['sulfonamide'],
  nsaid: ['nsaid'],
  nsaids: ['nsaid'],
  aspirin: ['salicylate', 'nsaid'],
  quinolone: ['quinolone'],
  macrolide: ['macrolide'],
  tetracycline: ['tetracycline'],
  codeine: ['opioid'],
  morphine: ['opioid'],
  opioid: ['opioid'],
  'ace inhibitor': ['ace inhibitor'],
  benzodiazepine: ['benzodiazepine'],
};

export function allergyConflicts(medicineName: string, allergies: { substance: string }[]): string[] {
  const name = medicineName.toLowerCase();
  const med = MEDICINES.find((x) => x.name.toLowerCase() === name);
  const classes = med?.classes ?? [];
  const hits: string[] = [];
  for (const a of allergies) {
    const s = a.substance.trim().toLowerCase();
    if (!s) continue;
    const implied = ALLERGY_ALIASES[s] ?? [s];
    if (name.includes(s) || implied.some((c) => classes.includes(c))) hits.push(a.substance);
  }
  return hits;
}

export function searchMedicines(q: string, limit = 15): Medicine[] {
  const s = q.trim().toLowerCase();
  if (!s) return [];
  return MEDICINES.filter((x) => x.name.toLowerCase().includes(s) || x.classes.some((c) => c.includes(s))).slice(0, limit);
}

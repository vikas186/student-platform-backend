export type CareerEntry = {
  role: string;
  salaryRange: string;
};

export type CareerReferenceRow = {
  fieldKey: string;
  level: 'undergraduate' | 'postgraduate' | 'any';
  countryPattern: string;
  careers: CareerEntry[];
};

/** Curated career + salary bands (no DB table). Country pattern is matched with ILIKE contains. */
export const CAREER_SALARY_REFERENCE: CareerReferenceRow[] = [
  {
    fieldKey: 'business',
    level: 'postgraduate',
    countryPattern: 'canada',
    careers: [
      { role: 'Financial Analyst', salaryRange: 'CAD 55,000–75,000' },
      { role: 'Marketing Manager', salaryRange: 'CAD 60,000–85,000' },
      { role: 'Management Consultant', salaryRange: 'CAD 70,000–100,000' },
    ],
  },
  {
    fieldKey: 'business',
    level: 'undergraduate',
    countryPattern: 'canada',
    careers: [
      { role: 'Business Analyst', salaryRange: 'CAD 45,000–60,000' },
      { role: 'Account Coordinator', salaryRange: 'CAD 40,000–55,000' },
    ],
  },
  {
    fieldKey: 'computer',
    level: 'postgraduate',
    countryPattern: 'canada',
    careers: [
      { role: 'Software Engineer', salaryRange: 'CAD 75,000–110,000' },
      { role: 'Data Scientist', salaryRange: 'CAD 80,000–120,000' },
      { role: 'Product Manager', salaryRange: 'CAD 85,000–130,000' },
    ],
  },
  {
    fieldKey: 'computer',
    level: 'undergraduate',
    countryPattern: 'canada',
    careers: [
      { role: 'Junior Developer', salaryRange: 'CAD 55,000–75,000' },
      { role: 'IT Support Specialist', salaryRange: 'CAD 45,000–60,000' },
    ],
  },
  {
    fieldKey: 'stem',
    level: 'postgraduate',
    countryPattern: 'australia',
    careers: [
      { role: 'Engineer', salaryRange: 'AUD 80,000–120,000' },
      { role: 'Research Scientist', salaryRange: 'AUD 75,000–105,000' },
    ],
  },
  {
    fieldKey: 'business',
    level: 'any',
    countryPattern: 'united kingdom',
    careers: [
      { role: 'Graduate Analyst', salaryRange: '£28,000–38,000' },
      { role: 'Operations Associate', salaryRange: '£26,000–35,000' },
    ],
  },
  {
    fieldKey: 'computer',
    level: 'any',
    countryPattern: 'united states',
    careers: [
      { role: 'Software Developer', salaryRange: 'USD 70,000–120,000' },
      { role: 'Systems Analyst', salaryRange: 'USD 65,000–95,000' },
    ],
  },
  {
    fieldKey: 'any',
    level: 'any',
    countryPattern: '',
    careers: [
      { role: 'Graduate Professional', salaryRange: 'Varies by country and sector' },
      { role: 'Industry Specialist', salaryRange: 'Varies by experience' },
    ],
  },
];

const normalizeFieldKey = (field: string): string => {
  const f = field.toLowerCase();
  if (/business|commerce|mba|management|finance/i.test(f)) return 'business';
  if (/computer|software|cs|it|tech|data/i.test(f)) return 'computer';
  if (/stem|engineering|science|math/i.test(f)) return 'stem';
  return 'any';
};

const normalizeLevel = (level: string): 'undergraduate' | 'postgraduate' | 'any' => {
  if (/undergrad|bachelor|ug/i.test(level)) return 'undergraduate';
  if (/postgrad|master|pg|graduate|mba/i.test(level)) return 'postgraduate';
  return 'any';
};

export const lookupCareers = (
  field: string,
  level: string,
  country: string,
  extraRoles: string[] = [],
): CareerEntry[] => {
  const fieldKey = normalizeFieldKey(field);
  const lvl = normalizeLevel(level);
  const countryLower = country.toLowerCase().trim();

  const matches = CAREER_SALARY_REFERENCE.filter(row => {
    const fieldOk = row.fieldKey === fieldKey || row.fieldKey === 'any';
    const levelOk = row.level === lvl || row.level === 'any';
    const countryOk =
      !row.countryPattern ||
      countryLower.includes(row.countryPattern.toLowerCase()) ||
      row.countryPattern.toLowerCase().includes(countryLower);
    return fieldOk && levelOk && countryOk;
  });

  const fromRef = matches.length > 0 ? matches[0].careers : CAREER_SALARY_REFERENCE.at(-1)!.careers;

  const seen = new Set<string>();
  const merged: CareerEntry[] = [];

  for (const c of fromRef) {
    if (!seen.has(c.role.toLowerCase())) {
      seen.add(c.role.toLowerCase());
      merged.push(c);
    }
  }

  for (const tag of extraRoles) {
    const role = tag.trim();
    if (!role || seen.has(role.toLowerCase())) continue;
    seen.add(role.toLowerCase());
    const salary = fromRef[0]?.salaryRange ?? 'Varies by market';
    merged.push({ role, salaryRange: salary });
  }

  return merged.slice(0, 4);
};

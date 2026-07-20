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

const currencyLabelForCountry = (country: string): string => {
  const c = country.toLowerCase();
  if (/united kingdom|\buk\b|britain|england|scotland|wales/.test(c)) return 'GBP';
  if (/australia|\bau\b|\baus\b/.test(c)) return 'AUD';
  if (/canada|\bca\b/.test(c)) return 'CAD';
  if (/new zealand|\bnz\b/.test(c)) return 'NZD';
  if (/germany|france|italy|spain|netherlands|ireland|europe|euro/.test(c)) return 'EUR';
  if (/singapore/.test(c)) return 'SGD';
  if (/india/.test(c)) return 'INR';
  if (/switzerland/.test(c)) return 'CHF';
  if (/united states|\busa\b|\bus\b/.test(c)) return 'USD';
  return 'local currency';
};

const band = (country: string, lo: string, hi: string): string => {
  const code = currencyLabelForCountry(country);
  if (code === 'GBP') return `£${lo}–${hi}`;
  if (code === 'local currency') return `${lo}–${hi} (varies by market)`;
  return `${code} ${lo}–${hi}`;
};

/** Curated career + salary bands (no DB table). Country pattern is matched with ILIKE contains. */
export const CAREER_SALARY_REFERENCE: CareerReferenceRow[] = [
  // —— Business ——
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
    fieldKey: 'business',
    level: 'any',
    countryPattern: 'united kingdom',
    careers: [
      { role: 'Graduate Analyst', salaryRange: '£28,000–38,000' },
      { role: 'Operations Associate', salaryRange: '£26,000–35,000' },
      { role: 'Management Trainee', salaryRange: '£27,000–36,000' },
    ],
  },
  {
    fieldKey: 'business',
    level: 'any',
    countryPattern: 'australia',
    careers: [
      { role: 'Business Analyst', salaryRange: 'AUD 65,000–90,000' },
      { role: 'Marketing Coordinator', salaryRange: 'AUD 55,000–75,000' },
      { role: 'Financial Analyst', salaryRange: 'AUD 70,000–95,000' },
    ],
  },
  {
    fieldKey: 'business',
    level: 'any',
    countryPattern: 'united states',
    careers: [
      { role: 'Business Analyst', salaryRange: 'USD 55,000–85,000' },
      { role: 'Marketing Associate', salaryRange: 'USD 50,000–75,000' },
      { role: 'Financial Analyst', salaryRange: 'USD 60,000–95,000' },
    ],
  },
  {
    fieldKey: 'business',
    level: 'any',
    countryPattern: '',
    careers: [
      { role: 'Business Analyst', salaryRange: 'Varies by market' },
      { role: 'Financial Analyst', salaryRange: 'Varies by market' },
      { role: 'Marketing Associate', salaryRange: 'Varies by market' },
    ],
  },

  // —— Computer / tech ——
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
    fieldKey: 'computer',
    level: 'any',
    countryPattern: 'united kingdom',
    careers: [
      { role: 'Software Developer', salaryRange: '£35,000–55,000' },
      { role: 'Data Analyst', salaryRange: '£32,000–48,000' },
      { role: 'IT Consultant', salaryRange: '£38,000–60,000' },
    ],
  },
  {
    fieldKey: 'computer',
    level: 'any',
    countryPattern: 'australia',
    careers: [
      { role: 'Software Engineer', salaryRange: 'AUD 85,000–120,000' },
      { role: 'Data Analyst', salaryRange: 'AUD 75,000–100,000' },
      { role: 'Cloud Engineer', salaryRange: 'AUD 90,000–130,000' },
    ],
  },
  {
    fieldKey: 'computer',
    level: 'any',
    countryPattern: 'united states',
    careers: [
      { role: 'Software Developer', salaryRange: 'USD 70,000–120,000' },
      { role: 'Systems Analyst', salaryRange: 'USD 65,000–95,000' },
      { role: 'Data Engineer', salaryRange: 'USD 85,000–130,000' },
    ],
  },
  {
    fieldKey: 'computer',
    level: 'any',
    countryPattern: '',
    careers: [
      { role: 'Software Developer', salaryRange: 'Varies by market' },
      { role: 'Data Analyst', salaryRange: 'Varies by market' },
      { role: 'IT Consultant', salaryRange: 'Varies by market' },
    ],
  },

  // —— STEM / engineering ——
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
    fieldKey: 'stem',
    level: 'any',
    countryPattern: 'united kingdom',
    careers: [
      { role: 'Graduate Engineer', salaryRange: '£30,000–42,000' },
      { role: 'Research Associate', salaryRange: '£32,000–45,000' },
      { role: 'Project Engineer', salaryRange: '£35,000–50,000' },
    ],
  },
  {
    fieldKey: 'stem',
    level: 'any',
    countryPattern: 'united states',
    careers: [
      { role: 'Engineer', salaryRange: 'USD 70,000–110,000' },
      { role: 'Research Associate', salaryRange: 'USD 55,000–85,000' },
    ],
  },
  {
    fieldKey: 'stem',
    level: 'any',
    countryPattern: '',
    careers: [
      { role: 'Graduate Engineer', salaryRange: 'Varies by market' },
      { role: 'Research Associate', salaryRange: 'Varies by market' },
      { role: 'Technical Analyst', salaryRange: 'Varies by market' },
    ],
  },

  // —— Law ——
  {
    fieldKey: 'law',
    level: 'any',
    countryPattern: 'united kingdom',
    careers: [
      { role: 'Solicitor (trainee / NQ)', salaryRange: '£32,000–55,000' },
      { role: 'Corporate Paralegal', salaryRange: '£28,000–40,000' },
      { role: 'Compliance Analyst', salaryRange: '£30,000–48,000' },
      { role: 'Legal Advisor', salaryRange: '£35,000–55,000' },
    ],
  },
  {
    fieldKey: 'law',
    level: 'any',
    countryPattern: 'australia',
    careers: [
      { role: 'Graduate Lawyer', salaryRange: 'AUD 70,000–95,000' },
      { role: 'Paralegal', salaryRange: 'AUD 55,000–75,000' },
      { role: 'Compliance Officer', salaryRange: 'AUD 75,000–100,000' },
    ],
  },
  {
    fieldKey: 'law',
    level: 'any',
    countryPattern: 'canada',
    careers: [
      { role: 'Articling Student / Associate', salaryRange: 'CAD 55,000–85,000' },
      { role: 'Legal Assistant', salaryRange: 'CAD 45,000–65,000' },
      { role: 'Compliance Analyst', salaryRange: 'CAD 55,000–80,000' },
    ],
  },
  {
    fieldKey: 'law',
    level: 'any',
    countryPattern: 'united states',
    careers: [
      { role: 'Associate Attorney', salaryRange: 'USD 70,000–130,000' },
      { role: 'Paralegal', salaryRange: 'USD 45,000–70,000' },
      { role: 'Compliance Specialist', salaryRange: 'USD 60,000–95,000' },
    ],
  },
  {
    fieldKey: 'law',
    level: 'any',
    countryPattern: '',
    careers: [
      { role: 'Corporate Lawyer / Associate', salaryRange: 'Varies by market' },
      { role: 'Compliance Analyst', salaryRange: 'Varies by market' },
      { role: 'Legal Counsel (in-house)', salaryRange: 'Varies by market' },
      { role: 'Paralegal', salaryRange: 'Varies by market' },
    ],
  },

  // —— Health / nursing ——
  {
    fieldKey: 'health',
    level: 'any',
    countryPattern: 'united kingdom',
    careers: [
      { role: 'Registered Nurse', salaryRange: '£28,000–40,000' },
      { role: 'Clinical Nurse Specialist', salaryRange: '£35,000–48,000' },
      { role: 'Healthcare Coordinator', salaryRange: '£26,000–36,000' },
    ],
  },
  {
    fieldKey: 'health',
    level: 'any',
    countryPattern: 'australia',
    careers: [
      { role: 'Registered Nurse', salaryRange: 'AUD 70,000–95,000' },
      { role: 'Clinical Specialist', salaryRange: 'AUD 80,000–110,000' },
      { role: 'Allied Health Professional', salaryRange: 'AUD 65,000–90,000' },
    ],
  },
  {
    fieldKey: 'health',
    level: 'any',
    countryPattern: '',
    careers: [
      { role: 'Registered Nurse', salaryRange: 'Varies by market' },
      { role: 'Clinical Specialist', salaryRange: 'Varies by market' },
      { role: 'Healthcare Administrator', salaryRange: 'Varies by market' },
    ],
  },

  // —— Arts / media / design ——
  {
    fieldKey: 'arts',
    level: 'any',
    countryPattern: '',
    careers: [
      { role: 'Content Designer', salaryRange: 'Varies by market' },
      { role: 'Communications Officer', salaryRange: 'Varies by market' },
      { role: 'Creative Producer', salaryRange: 'Varies by market' },
    ],
  },

  // —— Education ——
  {
    fieldKey: 'education',
    level: 'any',
    countryPattern: '',
    careers: [
      { role: 'Teacher / Lecturer', salaryRange: 'Varies by market' },
      { role: 'Curriculum Specialist', salaryRange: 'Varies by market' },
      { role: 'Education Coordinator', salaryRange: 'Varies by market' },
    ],
  },
];

const normalizeFieldKey = (field: string): string => {
  const f = field.toLowerCase();
  if (/law|legal|llm|llb|solicitor|barrister|compliance|corporate\s+and\s+financial\s+law/i.test(f)) {
    return 'law';
  }
  if (
    /nurs|health|medicine|medical|pharmacy|physiother|public\s+health|clinical|biomed/i.test(f)
  ) {
    return 'health';
  }
  if (/educat|teach|pedagog/i.test(f)) return 'education';
  if (/art|design|media|film|journalis|communica|creative/i.test(f)) return 'arts';
  if (/business|commerce|mba|management|finance|account|market|econom/i.test(f)) return 'business';
  if (/computer|software|cs|it|tech|data|cyber|ai|artificial|informat/i.test(f)) return 'computer';
  if (/stem|engineering|science|math|aviation|aerospace|physics|chemistry|biology/i.test(f)) {
    return 'stem';
  }
  return 'any';
};

/** Field-specific roles when the curated table has no hit — never use vague placeholders. */
const defaultCareersForField = (fieldKey: string, country: string): CareerEntry[] => {
  const c = country || 'target country';
  switch (fieldKey) {
    case 'law':
      return [
        { role: 'Corporate / Commercial Lawyer', salaryRange: band(c, '32,000', '60,000') },
        { role: 'Compliance Analyst', salaryRange: band(c, '30,000', '50,000') },
        { role: 'Legal Advisor (in-house)', salaryRange: band(c, '35,000', '65,000') },
      ];
    case 'health':
      return [
        { role: 'Registered Nurse', salaryRange: band(c, '28,000', '45,000') },
        { role: 'Clinical Specialist', salaryRange: band(c, '32,000', '50,000') },
        { role: 'Healthcare Coordinator', salaryRange: band(c, '26,000', '40,000') },
      ];
    case 'computer':
      return [
        { role: 'Software Developer', salaryRange: band(c, '35,000', '70,000') },
        { role: 'Data Analyst', salaryRange: band(c, '32,000', '60,000') },
        { role: 'IT Consultant', salaryRange: band(c, '38,000', '75,000') },
      ];
    case 'business':
      return [
        { role: 'Business Analyst', salaryRange: band(c, '28,000', '55,000') },
        { role: 'Financial Analyst', salaryRange: band(c, '30,000', '60,000') },
        { role: 'Marketing Associate', salaryRange: band(c, '26,000', '48,000') },
      ];
    case 'stem':
      return [
        { role: 'Graduate Engineer', salaryRange: band(c, '30,000', '55,000') },
        { role: 'Research Associate', salaryRange: band(c, '28,000', '50,000') },
        { role: 'Technical Project Coordinator', salaryRange: band(c, '32,000', '58,000') },
      ];
    case 'education':
      return [
        { role: 'Teacher / Lecturer', salaryRange: band(c, '28,000', '48,000') },
        { role: 'Education Coordinator', salaryRange: band(c, '26,000', '42,000') },
      ];
    case 'arts':
      return [
        { role: 'Content / Communications Specialist', salaryRange: band(c, '25,000', '45,000') },
        { role: 'Creative Producer', salaryRange: band(c, '28,000', '50,000') },
      ];
    default:
      return [
        { role: 'Policy / Research Analyst', salaryRange: band(c, '28,000', '50,000') },
        { role: 'Project Coordinator', salaryRange: band(c, '26,000', '45,000') },
        { role: 'Client Success Associate', salaryRange: band(c, '25,000', '42,000') },
      ];
  }
};

const normalizeLevel = (level: string): 'undergraduate' | 'postgraduate' | 'any' => {
  if (/undergrad|bachelor|ug|bsc|ba\b|llb/i.test(level)) return 'undergraduate';
  if (/postgrad|master|pg|graduate|mba|msc|llm|ma\b/i.test(level)) return 'postgraduate';
  return 'any';
};

const normalizeCountryForLookup = (country: string): string => {
  const c = country.toLowerCase().trim();
  if (/^(us|usa|u\.s\.?a?\.?|united states|america)\b/.test(c) || c.includes('united states')) {
    return 'united states';
  }
  if (/^(uk|u\.k\.|united kingdom|britain|england|scotland|wales)\b/.test(c) || c.includes('united kingdom')) {
    return 'united kingdom';
  }
  if (/australia|\bau\b|\baus\b/.test(c)) return 'australia';
  if (/canada|\bca\b/.test(c)) return 'canada';
  if (/new zealand|\bnz\b/.test(c)) return 'new zealand';
  if (/germany/.test(c)) return 'germany';
  return c;
};

const isVaguePlaceholderRole = (role: string): boolean =>
  /graduate professional|industry specialist/i.test(role);

/**
 * Resolve 2–4 concrete career roles for Course Mapping cards.
 * Infers field from the student query and optional course title / scrape tags.
 */
export const lookupCareers = (
  field: string,
  level: string,
  country: string,
  extraRoles: string[] = [],
  courseName?: string | null,
): CareerEntry[] => {
  const inferredFromCourse = courseName ? normalizeFieldKey(courseName) : 'any';
  const inferredFromField = normalizeFieldKey(field);
  const fieldKey =
    inferredFromField !== 'any'
      ? inferredFromField
      : inferredFromCourse !== 'any'
        ? inferredFromCourse
        : 'any';

  const lvl = normalizeLevel(level);
  const countryLower = normalizeCountryForLookup(country);

  const matches = CAREER_SALARY_REFERENCE.filter(row => {
    // When we know the field, only use that field's rows (not a global dump).
    const fieldOkStrict = fieldKey === 'any' ? row.fieldKey === 'any' : row.fieldKey === fieldKey;
    const levelOk = row.level === lvl || row.level === 'any';
    if (!row.countryPattern) {
      return fieldOkStrict && levelOk;
    }
    const pattern = row.countryPattern.toLowerCase();
    const countryOk =
      countryLower === pattern ||
      (pattern.length >= 4 && countryLower.includes(pattern)) ||
      (countryLower.length >= 4 && pattern.includes(countryLower));
    return fieldOkStrict && levelOk && countryOk;
  });

  matches.sort((a, b) => {
    const aSpecific = a.countryPattern ? 1 : 0;
    const bSpecific = b.countryPattern ? 1 : 0;
    if (bSpecific !== aSpecific) return bSpecific - aSpecific;
    const aLevel = a.level === lvl ? 1 : 0;
    const bLevel = b.level === lvl ? 1 : 0;
    return bLevel - aLevel;
  });

  const fromRef =
    matches.length > 0 ? matches[0].careers : defaultCareersForField(fieldKey, country);

  const seen = new Set<string>();
  const merged: CareerEntry[] = [];

  const push = (entry: CareerEntry) => {
    const key = entry.role.toLowerCase();
    if (!key || seen.has(key) || isVaguePlaceholderRole(entry.role)) return;
    seen.add(key);
    merged.push(entry);
  };

  for (const c of fromRef) push(c);

  for (const tag of extraRoles) {
    const role = tag.trim();
    if (!role || isVaguePlaceholderRole(role)) continue;
    push({
      role,
      salaryRange: fromRef[0]?.salaryRange ?? band(country, '28,000', '55,000'),
    });
  }

  if (merged.length < 2) {
    for (const c of defaultCareersForField(fieldKey, country)) push(c);
  }

  return merged.slice(0, 4);
};

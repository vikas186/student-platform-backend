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

/**
 * Curated career + salary bands.
 * Prefer level-specific rows (undergraduate vs postgraduate) — do not reuse the same
 * senior titles for both UG and PG.
 */
export const CAREER_SALARY_REFERENCE: CareerReferenceRow[] = [
  // —— Business ——
  {
    fieldKey: 'business',
    level: 'undergraduate',
    countryPattern: '',
    careers: [
      { role: 'Business Analyst (graduate)', salaryRange: 'Varies by market' },
      { role: 'Sales / Account Coordinator', salaryRange: 'Varies by market' },
      { role: 'Junior Financial Analyst', salaryRange: 'Varies by market' },
      { role: 'Marketing Assistant', salaryRange: 'Varies by market' },
    ],
  },
  {
    fieldKey: 'business',
    level: 'postgraduate',
    countryPattern: '',
    careers: [
      { role: 'Management Consultant', salaryRange: 'Varies by market' },
      { role: 'Product / Strategy Manager', salaryRange: 'Varies by market' },
      { role: 'Senior Financial Analyst', salaryRange: 'Varies by market' },
      { role: 'Operations Manager', salaryRange: 'Varies by market' },
    ],
  },
  {
    fieldKey: 'business',
    level: 'undergraduate',
    countryPattern: 'canada',
    careers: [
      { role: 'Business Analyst (graduate)', salaryRange: 'CAD 45,000–60,000' },
      { role: 'Account Coordinator', salaryRange: 'CAD 40,000–55,000' },
      { role: 'Junior Financial Analyst', salaryRange: 'CAD 48,000–62,000' },
    ],
  },
  {
    fieldKey: 'business',
    level: 'postgraduate',
    countryPattern: 'canada',
    careers: [
      { role: 'Management Consultant', salaryRange: 'CAD 70,000–100,000' },
      { role: 'Marketing Manager', salaryRange: 'CAD 60,000–85,000' },
      { role: 'Senior Financial Analyst', salaryRange: 'CAD 65,000–90,000' },
    ],
  },
  {
    fieldKey: 'business',
    level: 'undergraduate',
    countryPattern: 'united kingdom',
    careers: [
      { role: 'Graduate Analyst', salaryRange: '£26,000–34,000' },
      { role: 'Operations Associate', salaryRange: '£24,000–32,000' },
      { role: 'Management Trainee', salaryRange: '£25,000–33,000' },
    ],
  },
  {
    fieldKey: 'business',
    level: 'postgraduate',
    countryPattern: 'united kingdom',
    careers: [
      { role: 'Management Consultant', salaryRange: '£40,000–65,000' },
      { role: 'Strategy / Product Analyst', salaryRange: '£38,000–58,000' },
      { role: 'Finance Manager (entry)', salaryRange: '£42,000–60,000' },
    ],
  },
  {
    fieldKey: 'business',
    level: 'undergraduate',
    countryPattern: 'australia',
    careers: [
      { role: 'Graduate Business Analyst', salaryRange: 'AUD 55,000–72,000' },
      { role: 'Marketing Coordinator', salaryRange: 'AUD 50,000–68,000' },
      { role: 'Junior Financial Analyst', salaryRange: 'AUD 58,000–75,000' },
    ],
  },
  {
    fieldKey: 'business',
    level: 'postgraduate',
    countryPattern: 'australia',
    careers: [
      { role: 'Management Consultant', salaryRange: 'AUD 85,000–120,000' },
      { role: 'Marketing Manager', salaryRange: 'AUD 80,000–110,000' },
      { role: 'Senior Financial Analyst', salaryRange: 'AUD 90,000–125,000' },
    ],
  },
  {
    fieldKey: 'business',
    level: 'undergraduate',
    countryPattern: 'united states',
    careers: [
      { role: 'Business Analyst (associate)', salaryRange: 'USD 50,000–70,000' },
      { role: 'Marketing Associate', salaryRange: 'USD 45,000–65,000' },
      { role: 'Junior Financial Analyst', salaryRange: 'USD 55,000–75,000' },
    ],
  },
  {
    fieldKey: 'business',
    level: 'postgraduate',
    countryPattern: 'united states',
    careers: [
      { role: 'Management Consultant', salaryRange: 'USD 85,000–140,000' },
      { role: 'Product Manager', salaryRange: 'USD 90,000–145,000' },
      { role: 'Senior Financial Analyst', salaryRange: 'USD 80,000–120,000' },
    ],
  },

  // —— Computer / tech ——
  {
    fieldKey: 'computer',
    level: 'undergraduate',
    countryPattern: '',
    careers: [
      { role: 'Junior Software Developer', salaryRange: 'Varies by market' },
      { role: 'IT Support / Systems Associate', salaryRange: 'Varies by market' },
      { role: 'QA / Test Analyst', salaryRange: 'Varies by market' },
    ],
  },
  {
    fieldKey: 'computer',
    level: 'postgraduate',
    countryPattern: '',
    careers: [
      { role: 'Software Engineer', salaryRange: 'Varies by market' },
      { role: 'Data Scientist / ML Engineer', salaryRange: 'Varies by market' },
      { role: 'Solutions / Cloud Architect (associate)', salaryRange: 'Varies by market' },
    ],
  },
  {
    fieldKey: 'computer',
    level: 'undergraduate',
    countryPattern: 'canada',
    careers: [
      { role: 'Junior Developer', salaryRange: 'CAD 55,000–75,000' },
      { role: 'IT Support Specialist', salaryRange: 'CAD 45,000–60,000' },
      { role: 'QA Analyst', salaryRange: 'CAD 50,000–68,000' },
    ],
  },
  {
    fieldKey: 'computer',
    level: 'postgraduate',
    countryPattern: 'canada',
    careers: [
      { role: 'Software Engineer', salaryRange: 'CAD 75,000–110,000' },
      { role: 'Data Scientist', salaryRange: 'CAD 80,000–120,000' },
      { role: 'Product Manager (tech)', salaryRange: 'CAD 85,000–130,000' },
    ],
  },
  {
    fieldKey: 'computer',
    level: 'undergraduate',
    countryPattern: 'united kingdom',
    careers: [
      { role: 'Graduate Software Developer', salaryRange: '£28,000–40,000' },
      { role: 'Junior Data Analyst', salaryRange: '£26,000–36,000' },
      { role: 'IT Support Analyst', salaryRange: '£24,000–34,000' },
    ],
  },
  {
    fieldKey: 'computer',
    level: 'postgraduate',
    countryPattern: 'united kingdom',
    careers: [
      { role: 'Software Engineer', salaryRange: '£42,000–65,000' },
      { role: 'Data Scientist', salaryRange: '£45,000–70,000' },
      { role: 'Cloud / DevOps Engineer', salaryRange: '£48,000–75,000' },
    ],
  },
  {
    fieldKey: 'computer',
    level: 'undergraduate',
    countryPattern: 'australia',
    careers: [
      { role: 'Graduate Software Developer', salaryRange: 'AUD 65,000–85,000' },
      { role: 'Junior Data Analyst', salaryRange: 'AUD 60,000–78,000' },
      { role: 'IT Support Analyst', salaryRange: 'AUD 55,000–72,000' },
    ],
  },
  {
    fieldKey: 'computer',
    level: 'postgraduate',
    countryPattern: 'australia',
    careers: [
      { role: 'Software Engineer', salaryRange: 'AUD 95,000–135,000' },
      { role: 'Data Scientist', salaryRange: 'AUD 100,000–140,000' },
      { role: 'Cloud Engineer', salaryRange: 'AUD 105,000–145,000' },
    ],
  },
  {
    fieldKey: 'computer',
    level: 'undergraduate',
    countryPattern: 'united states',
    careers: [
      { role: 'Junior Software Developer', salaryRange: 'USD 60,000–85,000' },
      { role: 'Systems Analyst (associate)', salaryRange: 'USD 55,000–75,000' },
      { role: 'QA Engineer', salaryRange: 'USD 55,000–80,000' },
    ],
  },
  {
    fieldKey: 'computer',
    level: 'postgraduate',
    countryPattern: 'united states',
    careers: [
      { role: 'Software Engineer', salaryRange: 'USD 95,000–150,000' },
      { role: 'Data / ML Engineer', salaryRange: 'USD 100,000–160,000' },
      { role: 'Solutions Architect (associate)', salaryRange: 'USD 110,000–165,000' },
    ],
  },

  // —— STEM / engineering ——
  {
    fieldKey: 'stem',
    level: 'undergraduate',
    countryPattern: '',
    careers: [
      { role: 'Graduate Engineer', salaryRange: 'Varies by market' },
      { role: 'Engineering Technician / Associate', salaryRange: 'Varies by market' },
      { role: 'Project Coordinator (engineering)', salaryRange: 'Varies by market' },
    ],
  },
  {
    fieldKey: 'stem',
    level: 'postgraduate',
    countryPattern: '',
    careers: [
      { role: 'Design / Project Engineer', salaryRange: 'Varies by market' },
      { role: 'Research Scientist', salaryRange: 'Varies by market' },
      { role: 'Engineering Manager (entry)', salaryRange: 'Varies by market' },
    ],
  },
  {
    fieldKey: 'stem',
    level: 'undergraduate',
    countryPattern: 'united kingdom',
    careers: [
      { role: 'Graduate Engineer', salaryRange: '£28,000–38,000' },
      { role: 'Engineering Technician', salaryRange: '£26,000–35,000' },
      { role: 'Junior Project Engineer', salaryRange: '£30,000–40,000' },
    ],
  },
  {
    fieldKey: 'stem',
    level: 'postgraduate',
    countryPattern: 'united kingdom',
    careers: [
      { role: 'Project Engineer', salaryRange: '£40,000–58,000' },
      { role: 'Research Scientist', salaryRange: '£38,000–55,000' },
      { role: 'Lead Design Engineer (associate)', salaryRange: '£45,000–65,000' },
    ],
  },
  {
    fieldKey: 'stem',
    level: 'undergraduate',
    countryPattern: 'australia',
    careers: [
      { role: 'Graduate Engineer', salaryRange: 'AUD 65,000–85,000' },
      { role: 'Engineering Associate', salaryRange: 'AUD 60,000–78,000' },
    ],
  },
  {
    fieldKey: 'stem',
    level: 'postgraduate',
    countryPattern: 'australia',
    careers: [
      { role: 'Project Engineer', salaryRange: 'AUD 90,000–125,000' },
      { role: 'Research Scientist', salaryRange: 'AUD 85,000–120,000' },
    ],
  },
  {
    fieldKey: 'stem',
    level: 'undergraduate',
    countryPattern: 'united states',
    careers: [
      { role: 'Graduate Engineer', salaryRange: 'USD 60,000–85,000' },
      { role: 'Engineering Associate', salaryRange: 'USD 55,000–75,000' },
    ],
  },
  {
    fieldKey: 'stem',
    level: 'postgraduate',
    countryPattern: 'united states',
    careers: [
      { role: 'Project / Design Engineer', salaryRange: 'USD 85,000–125,000' },
      { role: 'Research Scientist', salaryRange: 'USD 80,000–120,000' },
    ],
  },

  // —— Law ——
  {
    fieldKey: 'law',
    level: 'undergraduate',
    countryPattern: '',
    careers: [
      { role: 'Paralegal / Legal Assistant', salaryRange: 'Varies by market' },
      { role: 'Compliance Assistant', salaryRange: 'Varies by market' },
      { role: 'Contracts Coordinator', salaryRange: 'Varies by market' },
    ],
  },
  {
    fieldKey: 'law',
    level: 'postgraduate',
    countryPattern: '',
    careers: [
      { role: 'Associate Lawyer / Counsel', salaryRange: 'Varies by market' },
      { role: 'Compliance Manager', salaryRange: 'Varies by market' },
      { role: 'Legal Advisor (in-house)', salaryRange: 'Varies by market' },
    ],
  },
  {
    fieldKey: 'law',
    level: 'undergraduate',
    countryPattern: 'united kingdom',
    careers: [
      { role: 'Paralegal', salaryRange: '£24,000–32,000' },
      { role: 'Compliance Assistant', salaryRange: '£25,000–34,000' },
      { role: 'Legal Administrator', salaryRange: '£23,000–30,000' },
    ],
  },
  {
    fieldKey: 'law',
    level: 'postgraduate',
    countryPattern: 'united kingdom',
    careers: [
      { role: 'Solicitor (trainee / NQ)', salaryRange: '£38,000–65,000' },
      { role: 'Compliance Analyst', salaryRange: '£35,000–55,000' },
      { role: 'Legal Advisor', salaryRange: '£40,000–60,000' },
    ],
  },
  {
    fieldKey: 'law',
    level: 'undergraduate',
    countryPattern: 'australia',
    careers: [
      { role: 'Paralegal', salaryRange: 'AUD 55,000–72,000' },
      { role: 'Legal Assistant', salaryRange: 'AUD 50,000–68,000' },
    ],
  },
  {
    fieldKey: 'law',
    level: 'postgraduate',
    countryPattern: 'australia',
    careers: [
      { role: 'Graduate Lawyer / Associate', salaryRange: 'AUD 80,000–110,000' },
      { role: 'Compliance Officer', salaryRange: 'AUD 85,000–115,000' },
    ],
  },
  {
    fieldKey: 'law',
    level: 'undergraduate',
    countryPattern: 'canada',
    careers: [
      { role: 'Legal Assistant', salaryRange: 'CAD 42,000–58,000' },
      { role: 'Paralegal (junior)', salaryRange: 'CAD 45,000–60,000' },
    ],
  },
  {
    fieldKey: 'law',
    level: 'postgraduate',
    countryPattern: 'canada',
    careers: [
      { role: 'Articling Student / Associate', salaryRange: 'CAD 65,000–95,000' },
      { role: 'Compliance Analyst', salaryRange: 'CAD 60,000–85,000' },
    ],
  },
  {
    fieldKey: 'law',
    level: 'undergraduate',
    countryPattern: 'united states',
    careers: [
      { role: 'Paralegal', salaryRange: 'USD 42,000–62,000' },
      { role: 'Legal Assistant', salaryRange: 'USD 40,000–58,000' },
    ],
  },
  {
    fieldKey: 'law',
    level: 'postgraduate',
    countryPattern: 'united states',
    careers: [
      { role: 'Associate Attorney', salaryRange: 'USD 80,000–140,000' },
      { role: 'Compliance Specialist', salaryRange: 'USD 70,000–105,000' },
    ],
  },

  // —— Health ——
  {
    fieldKey: 'health',
    level: 'undergraduate',
    countryPattern: '',
    careers: [
      { role: 'Registered Nurse (graduate)', salaryRange: 'Varies by market' },
      { role: 'Healthcare Assistant / Coordinator', salaryRange: 'Varies by market' },
      { role: 'Clinical Support Officer', salaryRange: 'Varies by market' },
    ],
  },
  {
    fieldKey: 'health',
    level: 'postgraduate',
    countryPattern: '',
    careers: [
      { role: 'Clinical Nurse Specialist', salaryRange: 'Varies by market' },
      { role: 'Public Health Specialist', salaryRange: 'Varies by market' },
      { role: 'Healthcare Manager', salaryRange: 'Varies by market' },
    ],
  },
  {
    fieldKey: 'health',
    level: 'undergraduate',
    countryPattern: 'united kingdom',
    careers: [
      { role: 'Registered Nurse (Band 5)', salaryRange: '£28,000–36,000' },
      { role: 'Healthcare Coordinator', salaryRange: '£24,000–32,000' },
    ],
  },
  {
    fieldKey: 'health',
    level: 'postgraduate',
    countryPattern: 'united kingdom',
    careers: [
      { role: 'Clinical Nurse Specialist', salaryRange: '£38,000–52,000' },
      { role: 'Public Health Analyst', salaryRange: '£35,000–48,000' },
      { role: 'Healthcare Manager', salaryRange: '£40,000–55,000' },
    ],
  },
  {
    fieldKey: 'health',
    level: 'undergraduate',
    countryPattern: 'australia',
    careers: [
      { role: 'Registered Nurse', salaryRange: 'AUD 65,000–85,000' },
      { role: 'Allied Health Graduate', salaryRange: 'AUD 60,000–80,000' },
    ],
  },
  {
    fieldKey: 'health',
    level: 'postgraduate',
    countryPattern: 'australia',
    careers: [
      { role: 'Clinical Specialist', salaryRange: 'AUD 90,000–120,000' },
      { role: 'Public Health Specialist', salaryRange: 'AUD 85,000–115,000' },
    ],
  },

  // —— Arts / education ——
  {
    fieldKey: 'arts',
    level: 'undergraduate',
    countryPattern: '',
    careers: [
      { role: 'Content / Communications Assistant', salaryRange: 'Varies by market' },
      { role: 'Junior Designer', salaryRange: 'Varies by market' },
      { role: 'Social Media Coordinator', salaryRange: 'Varies by market' },
    ],
  },
  {
    fieldKey: 'arts',
    level: 'postgraduate',
    countryPattern: '',
    careers: [
      { role: 'Creative Producer', salaryRange: 'Varies by market' },
      { role: 'Communications Manager', salaryRange: 'Varies by market' },
      { role: 'Design Lead (associate)', salaryRange: 'Varies by market' },
    ],
  },
  {
    fieldKey: 'education',
    level: 'undergraduate',
    countryPattern: '',
    careers: [
      { role: 'Teaching Assistant / Graduate Teacher', salaryRange: 'Varies by market' },
      { role: 'Education Support Officer', salaryRange: 'Varies by market' },
    ],
  },
  {
    fieldKey: 'education',
    level: 'postgraduate',
    countryPattern: '',
    careers: [
      { role: 'Teacher / Lecturer', salaryRange: 'Varies by market' },
      { role: 'Curriculum Specialist', salaryRange: 'Varies by market' },
      { role: 'Education Program Manager', salaryRange: 'Varies by market' },
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

const defaultCareersForField = (
  fieldKey: string,
  country: string,
  level: 'undergraduate' | 'postgraduate' | 'any',
): CareerEntry[] => {
  const c = country || 'target country';
  const ug = level !== 'postgraduate';
  switch (fieldKey) {
    case 'law':
      return ug
        ? [
            { role: 'Paralegal / Legal Assistant', salaryRange: band(c, '24,000', '38,000') },
            { role: 'Compliance Assistant', salaryRange: band(c, '25,000', '40,000') },
            { role: 'Contracts Coordinator', salaryRange: band(c, '26,000', '42,000') },
          ]
        : [
            { role: 'Associate Lawyer / Counsel', salaryRange: band(c, '40,000', '75,000') },
            { role: 'Compliance Manager', salaryRange: band(c, '38,000', '65,000') },
            { role: 'Legal Advisor (in-house)', salaryRange: band(c, '42,000', '80,000') },
          ];
    case 'health':
      return ug
        ? [
            { role: 'Registered Nurse (graduate)', salaryRange: band(c, '28,000', '42,000') },
            { role: 'Healthcare Coordinator', salaryRange: band(c, '24,000', '36,000') },
            { role: 'Clinical Support Officer', salaryRange: band(c, '25,000', '38,000') },
          ]
        : [
            { role: 'Clinical Nurse Specialist', salaryRange: band(c, '38,000', '55,000') },
            { role: 'Public Health Specialist', salaryRange: band(c, '36,000', '52,000') },
            { role: 'Healthcare Manager', salaryRange: band(c, '40,000', '60,000') },
          ];
    case 'computer':
      return ug
        ? [
            { role: 'Junior Software Developer', salaryRange: band(c, '28,000', '48,000') },
            { role: 'IT Support / Systems Associate', salaryRange: band(c, '24,000', '40,000') },
            { role: 'QA / Test Analyst', salaryRange: band(c, '26,000', '44,000') },
          ]
        : [
            { role: 'Software Engineer', salaryRange: band(c, '45,000', '85,000') },
            { role: 'Data Scientist / ML Engineer', salaryRange: band(c, '48,000', '90,000') },
            { role: 'Cloud / Solutions Engineer', salaryRange: band(c, '50,000', '95,000') },
          ];
    case 'business':
      return ug
        ? [
            { role: 'Business Analyst (graduate)', salaryRange: band(c, '26,000', '42,000') },
            { role: 'Junior Financial Analyst', salaryRange: band(c, '28,000', '45,000') },
            { role: 'Marketing Assistant', salaryRange: band(c, '24,000', '38,000') },
          ]
        : [
            { role: 'Management Consultant', salaryRange: band(c, '42,000', '75,000') },
            { role: 'Product / Strategy Manager', salaryRange: band(c, '45,000', '80,000') },
            { role: 'Senior Financial Analyst', salaryRange: band(c, '40,000', '70,000') },
          ];
    case 'stem':
      return ug
        ? [
            { role: 'Graduate Engineer', salaryRange: band(c, '28,000', '45,000') },
            { role: 'Engineering Associate', salaryRange: band(c, '26,000', '42,000') },
            { role: 'Project Coordinator (engineering)', salaryRange: band(c, '28,000', '44,000') },
          ]
        : [
            { role: 'Project / Design Engineer', salaryRange: band(c, '42,000', '70,000') },
            { role: 'Research Scientist', salaryRange: band(c, '40,000', '65,000') },
            { role: 'Engineering Lead (associate)', salaryRange: band(c, '48,000', '80,000') },
          ];
    case 'education':
      return ug
        ? [
            { role: 'Teaching Assistant / Graduate Teacher', salaryRange: band(c, '24,000', '38,000') },
            { role: 'Education Support Officer', salaryRange: band(c, '22,000', '35,000') },
          ]
        : [
            { role: 'Teacher / Lecturer', salaryRange: band(c, '32,000', '55,000') },
            { role: 'Curriculum Specialist', salaryRange: band(c, '35,000', '58,000') },
            { role: 'Education Program Manager', salaryRange: band(c, '38,000', '62,000') },
          ];
    case 'arts':
      return ug
        ? [
            { role: 'Content / Communications Assistant', salaryRange: band(c, '22,000', '36,000') },
            { role: 'Junior Designer', salaryRange: band(c, '24,000', '38,000') },
          ]
        : [
            { role: 'Creative Producer', salaryRange: band(c, '32,000', '55,000') },
            { role: 'Communications Manager', salaryRange: band(c, '35,000', '58,000') },
          ];
    default:
      return ug
        ? [
            { role: 'Research / Policy Assistant', salaryRange: band(c, '24,000', '38,000') },
            { role: 'Project Coordinator', salaryRange: band(c, '25,000', '40,000') },
            { role: 'Client Success Associate', salaryRange: band(c, '23,000', '36,000') },
          ]
        : [
            { role: 'Policy / Research Analyst', salaryRange: band(c, '35,000', '58,000') },
            { role: 'Program Manager', salaryRange: band(c, '38,000', '62,000') },
            { role: 'Strategy Associate', salaryRange: band(c, '40,000', '65,000') },
          ];
  }
};

const normalizeLevel = (level: string): 'undergraduate' | 'postgraduate' | 'any' => {
  const l = level.toLowerCase().trim();
  if (/undergrad|bachelor|^ug$|\bug\b|bsc|\bba\b|llb|b\.?eng|bba/i.test(l)) return 'undergraduate';
  if (/postgrad|master|^pg$|\bpg\b|mba|msc|llm|\bma\b|phd|doctoral|meng|mph/i.test(l)) {
    return 'postgraduate';
  }
  // Bare "graduate" (not undergraduate) → postgraduate
  if (/\bgraduate\b/i.test(l) && !/under/i.test(l)) return 'postgraduate';
  return 'any';
};

/** Infer UG/PG from a program title when the UI level is missing or "any". */
const levelFromCourseName = (courseName: string | null | undefined): 'undergraduate' | 'postgraduate' | 'any' => {
  if (!courseName?.trim()) return 'any';
  return normalizeLevel(courseName);
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

const countryMatches = (countryLower: string, pattern: string): boolean => {
  if (!pattern) return true;
  const p = pattern.toLowerCase();
  return (
    countryLower === p ||
    (p.length >= 4 && countryLower.includes(p)) ||
    (countryLower.length >= 4 && p.includes(countryLower))
  );
};

/**
 * Resolve 2–4 concrete career roles for Course Mapping cards.
 * Undergraduate and postgraduate return different seniority / salary bands.
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

  let lvl = normalizeLevel(level);
  if (lvl === 'any') {
    lvl = levelFromCourseName(courseName);
  }
  const countryLower = normalizeCountryForLookup(country);

  const fieldRows = CAREER_SALARY_REFERENCE.filter(row =>
    fieldKey === 'any' ? row.fieldKey === 'any' || row.fieldKey === 'business' : row.fieldKey === fieldKey,
  );

  // 1) Exact level + country (or exact level + global)
  // 2) Never fall back to the opposite level when UG/PG is known
  const pickRows = (wantLevel: 'undergraduate' | 'postgraduate' | 'any') => {
    const exactCountry = fieldRows.filter(
      row => row.level === wantLevel && row.countryPattern && countryMatches(countryLower, row.countryPattern),
    );
    if (exactCountry.length) return exactCountry;
    return fieldRows.filter(row => row.level === wantLevel && !row.countryPattern);
  };

  let matches: CareerReferenceRow[] = [];
  if (lvl === 'undergraduate' || lvl === 'postgraduate') {
    matches = pickRows(lvl);
  } else {
    matches = [
      ...fieldRows.filter(row => row.countryPattern && countryMatches(countryLower, row.countryPattern)),
      ...fieldRows.filter(row => !row.countryPattern),
    ];
  }

  matches.sort((a, b) => {
    const aSpecific = a.countryPattern ? 1 : 0;
    const bSpecific = b.countryPattern ? 1 : 0;
    if (bSpecific !== aSpecific) return bSpecific - aSpecific;
    const aLevel = a.level === lvl ? 2 : a.level === 'any' ? 1 : 0;
    const bLevel = b.level === lvl ? 2 : b.level === 'any' ? 1 : 0;
    return bLevel - aLevel;
  });

  const fromRef =
    matches.length > 0
      ? matches[0].careers
      : defaultCareersForField(fieldKey, country, lvl === 'any' ? 'undergraduate' : lvl);

  const seen = new Set<string>();
  const merged: CareerEntry[] = [];

  const push = (entry: CareerEntry) => {
    const key = entry.role.toLowerCase();
    if (!key || seen.has(key) || isVaguePlaceholderRole(entry.role)) return;
    seen.add(key);
    merged.push(entry);
  };

  for (const c of fromRef) push(c);

  // Extra scrape tags only if they don't collide with the wrong seniority for known levels
  for (const tag of extraRoles) {
    const role = tag.trim();
    if (!role || isVaguePlaceholderRole(role)) continue;
    if (lvl === 'undergraduate' && /\b(director|vp|chief|head of|principal)\b/i.test(role)) continue;
    if (lvl === 'postgraduate' && /\b(intern|trainee|assistant|junior support)\b/i.test(role)) continue;
    push({
      role,
      salaryRange: fromRef[0]?.salaryRange ?? band(country, '28,000', '55,000'),
    });
  }

  if (merged.length < 2) {
    for (const c of defaultCareersForField(fieldKey, country, lvl === 'any' ? 'undergraduate' : lvl)) {
      push(c);
    }
  }

  return merged.slice(0, 4);
};

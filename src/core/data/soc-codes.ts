/**
 * BLS SOC code mapping table.
 *
 * Maps common tech job titles to Bureau of Labor Statistics Standard Occupational
 * Classification codes. Each entry includes keywords used for fuzzy title matching.
 *
 * SOC codes are used to query the BLS OEWS API for wage percentile data.
 * See: https://www.bls.gov/soc/
 */
export interface SOCEntry {
  socCode: string;
  blsTitle: string;
  keywords: string[];
}

export const SOC_CODES: SOCEntry[] = [
  // Software Engineering
  {
    socCode: "15-1252",
    blsTitle: "Software Developers",
    keywords: [
      "software",
      "developer",
      "engineer",
      "sde",
      "swe",
      "full stack",
      "backend",
      "frontend",
      "fullstack",
      "back end",
      "front end",
      "full-stack",
      "back-end",
      "front-end",
      "web developer",
      "application developer",
      "platform engineer",
    ],
  },
  {
    socCode: "15-1251",
    blsTitle: "Computer Programmers",
    keywords: ["programmer", "coder"],
  },
  {
    socCode: "15-1253",
    blsTitle: "Software Quality Assurance Analysts and Testers",
    keywords: ["qa", "quality", "test", "sdet", "qa engineer", "test engineer", "automation engineer"],
  },
  {
    socCode: "15-1254",
    blsTitle: "Web Developers and Digital Designers",
    keywords: ["web developer", "web designer", "frontend developer", "ui developer", "ux developer"],
  },
  {
    socCode: "15-1255",
    blsTitle: "Web and Digital Interface Designers",
    keywords: ["web designer", "digital designer", "interaction designer"],
  },

  // Data Science & Analytics
  {
    socCode: "15-2051",
    blsTitle: "Data Scientists",
    keywords: ["data scientist", "machine learning", "ml engineer", "ai engineer", "deep learning"],
  },
  {
    socCode: "15-2050",
    blsTitle: "Data Analysts",
    keywords: ["data analyst", "business analyst", "bi analyst", "analytics", "business intelligence"],
  },
  {
    socCode: "15-2041",
    blsTitle: "Statisticians",
    keywords: ["statistician", "stats"],
  },

  // Product & Project Management
  {
    socCode: "15-1211",
    blsTitle: "Computer Systems Analysts",
    keywords: ["systems analyst", "it analyst", "technical analyst"],
  },
  {
    socCode: "13-1081",
    blsTitle: "Logisticians",
    keywords: ["supply chain", "logistics"],
  },
  {
    socCode: "13-1082",
    blsTitle: "Project Management Specialists",
    keywords: [
      "project manager",
      "program manager",
      "scrum master",
      "agile coach",
      "delivery manager",
      "technical program manager",
    ],
  },
  {
    socCode: "13-1199",
    blsTitle: "Business Operations Specialists",
    keywords: ["operations manager", "chief of staff", "business operations"],
  },

  // Design
  {
    socCode: "27-1024",
    blsTitle: "Graphic Designers",
    keywords: ["graphic designer", "visual designer", "brand designer"],
  },
  {
    socCode: "27-1025",
    blsTitle: "Interior Designers",
    keywords: ["interior designer"],
  },
  {
    socCode: "15-1212",
    blsTitle: "Information Security Analysts",
    keywords: [
      "security engineer",
      "security analyst",
      "infosec",
      "cybersecurity",
      "soc analyst",
      "penetration tester",
      "security",
    ],
  },

  // DevOps & Infrastructure
  {
    socCode: "15-1244",
    blsTitle: "Network and Computer Systems Administrators",
    keywords: [
      "systems administrator",
      "sysadmin",
      "devops",
      "site reliability",
      "sre",
      "infrastructure engineer",
      "platform engineer",
      "cloud engineer",
    ],
  },
  {
    socCode: "15-1241",
    blsTitle: "Computer Network Architects",
    keywords: ["network engineer", "network architect"],
  },
  {
    socCode: "15-1242",
    blsTitle: "Database Administrators and Architects",
    keywords: ["database administrator", "dba", "database engineer", "data engineer"],
  },

  // IT Management
  {
    socCode: "11-3021",
    blsTitle: "Computer and Information Systems Managers",
    keywords: [
      "it manager",
      "engineering manager",
      "cto",
      "vp engineering",
      "head of engineering",
      "director of engineering",
      "tech lead",
      "engineering director",
    ],
  },
  {
    socCode: "11-3028",
    blsTitle: "Information Technology Project Managers",
    keywords: ["it project manager", "technical project manager"],
  },

  // Product Management (mapped to closest SOC)
  {
    socCode: "13-1199",
    blsTitle: "Business Operations Specialists",
    keywords: ["product manager", "product owner", "pm"],
  },

  // UX/UI Design
  {
    socCode: "27-1029",
    blsTitle: "Designers",
    keywords: ["ux designer", "ui designer", "ux researcher", "product designer", "design lead"],
  },

  // Technical Writing
  {
    socCode: "27-3042",
    blsTitle: "Technical Writers",
    keywords: ["technical writer", "documentation", "tech writer", "content developer"],
  },

  // Sales Engineering
  {
    socCode: "41-4011",
    blsTitle: "Sales Engineers",
    keywords: ["sales engineer", "solutions engineer", "solutions consultant", "pre-sales", "presales"],
  },

  // Marketing
  {
    socCode: "13-1161",
    blsTitle: "Market Research Analysts and Marketing Specialists",
    keywords: [
      "marketing manager",
      "marketing specialist",
      "growth manager",
      "content marketing",
      "digital marketing",
      "seo",
      "sem",
      "marketing analyst",
    ],
  },

  // Human Resources
  {
    socCode: "13-1071",
    blsTitle: "Human Resources Specialists",
    keywords: ["hr", "human resources", "recruiter", "talent acquisition", "people operations"],
  },
  {
    socCode: "13-1075",
    blsTitle: "Labor Relations Specialists",
    keywords: ["labor relations", "employee relations"],
  },
  {
    socCode: "13-1079",
    blsTitle: "Human Resources Managers",
    keywords: ["hr manager", "people manager", "head of hr", "hr director"],
  },

  // Finance
  {
    socCode: "13-2011",
    blsTitle: "Accountants and Auditors",
    keywords: ["accountant", "auditor", "controller"],
  },
  {
    socCode: "13-2051",
    blsTitle: "Financial Analysts",
    keywords: ["financial analyst", "finance manager", "fp&a"],
  },
  {
    socCode: "13-2052",
    blsTitle: "Personal Financial Advisors",
    keywords: ["financial advisor", "wealth manager"],
  },
  {
    socCode: "13-2053",
    blsTitle: "Insurance Underwriters",
    keywords: ["underwriter"],
  },
  {
    socCode: "13-2061",
    blsTitle: "Financial Examiners",
    keywords: ["financial examiner", "compliance analyst"],
  },
  {
    socCode: "13-2081",
    blsTitle: "Tax Examiners and Collectors",
    keywords: ["tax analyst", "tax manager"],
  },

  // Legal
  {
    socCode: "23-2011",
    blsTitle: "Paralegals and Legal Assistants",
    keywords: ["paralegal", "legal assistant"],
  },
  {
    socCode: "23-2099",
    blsTitle: "Legal Support Workers",
    keywords: ["legal operations", "contract manager"],
  },

  // Customer Success
  {
    socCode: "41-3099",
    blsTitle: "Sales Representatives",
    keywords: ["customer success", "account manager", "account executive", "sales rep"],
  },

  // Data Engineering (mapped to closest)
  {
    socCode: "15-1242",
    blsTitle: "Database Administrators and Architects",
    keywords: ["data engineer", "etl developer", "data platform"],
  },

  // Mobile Development
  {
    socCode: "15-1252",
    blsTitle: "Software Developers",
    keywords: ["ios developer", "android developer", "mobile developer", "react native", "flutter"],
  },

  // Game Development
  {
    socCode: "15-1252",
    blsTitle: "Software Developers",
    keywords: ["game developer", "game engineer", "unity developer", "unreal developer"],
  },

  // Embedded/IoT
  {
    socCode: "17-2072",
    blsTitle: "Electronics Engineers",
    keywords: ["embedded engineer", "firmware engineer", "iot engineer", "hardware engineer"],
  },

  // Mechanical Engineering
  {
    socCode: "17-2141",
    blsTitle: "Mechanical Engineers",
    keywords: ["mechanical engineer", "mechanical design"],
  },

  // Electrical Engineering
  {
    socCode: "17-2071",
    blsTitle: "Electrical Engineers",
    keywords: ["electrical engineer"],
  },

  // Civil Engineering
  {
    socCode: "17-2051",
    blsTitle: "Civil Engineers",
    keywords: ["civil engineer"],
  },

  // Architecture
  {
    socCode: "17-1011",
    blsTitle: "Architects",
    keywords: ["architect", "building designer"],
  },

  // Healthcare
  {
    socCode: "29-1141",
    blsTitle: "Registered Nurses",
    keywords: ["registered nurse", "rn", "nurse"],
  },
  {
    socCode: "29-1216",
    blsTitle: "Physician Assistants",
    keywords: ["physician assistant", "pa"],
  },
  {
    socCode: "29-1215",
    blsTitle: "Family Medicine Physicians",
    keywords: ["physician", "doctor", "md", "general practitioner"],
  },
  {
    socCode: "29-1211",
    blsTitle: "Physicians",
    keywords: ["surgeon", "specialist", "cardiologist", "dermatologist", "neurologist", "oncologist"],
  },
  {
    socCode: "29-1123",
    blsTitle: "Physical Therapists",
    keywords: ["physical therapist", "pt"],
  },

  // Education
  {
    socCode: "25-2055",
    blsTitle: "Special Education Teachers",
    keywords: ["special education", "spec ed"],
  },

  // Executive
  {
    socCode: "11-1011",
    blsTitle: "Chief Executives",
    keywords: ["ceo", "chief executive", "coo", "cfo", "cto", "vp", "vice president", "director", "head of"],
  },

  // Operations
  {
    socCode: "11-1021",
    blsTitle: "General and Operations Managers",
    keywords: ["operations manager", "general manager", "branch manager"],
  },

  // Consulting
  {
    socCode: "13-1111",
    blsTitle: "Management Analysts",
    keywords: ["consultant", "management consultant", "strategy consultant", "advisor"],
  },
];

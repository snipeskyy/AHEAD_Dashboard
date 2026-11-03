/**
 * Word lists for FICTIONAL company names. Combinations are invented; any resemblance
 * to a real company is coincidental. Domains use the reserved ".example" TLD.
 */
export const NAME_ROOTS = [
  "Halvorsen",
  "Crestline",
  "Aurelian",
  "Brightwater",
  "Calloway",
  "Dunmore",
  "Everhart",
  "Fairhaven",
  "Granite Bay",
  "Harrowgate",
  "Ironvale",
  "Juniper Ridge",
  "Kestrel",
  "Larkspur",
  "Merrow Falls",
  "Norwyn",
  "Oakhurst",
  "Pellham",
  "Quarry Point",
  "Redcliff",
  "Silvermere",
  "Thornbury",
  "Umberfield",
  "Valewood",
  "Westbrook",
  "Yarrow",
  "Ashcombe",
  "Bellmont",
  "Cobalt Creek",
  "Driftwood",
  "Emberly",
  "Foxglove",
  "Glenmoor",
  "Harlowmere",
  "Islington",
  "Jasperfield",
  "Kinsbrook",
  "Lindqvist",
  "Marlowe",
  "Newhall",
  "Orchard Hill",
  "Pinecrest",
  "Quillon",
  "Rosedale",
  "Stonebridge",
  "Tidemoor",
  "Upland",
  "Verity",
  "Whitlock",
  "Alderwood",
  "Blackthorn",
  "Cedarline",
  "Delacroix",
  "Eastvale",
  "Fenwick",
  "Galloway",
  "Hartwell",
  "Ivorygate",
  "Keswick",
  "Lowell Park",
  "Mistral",
  "Norrland",
  "Ostrander",
  "Prescott Vale",
] as const;

export interface IndustryProfile {
  industry: string;
  subIndustries: string[];
  suffixes: string[];
  weight: number;
}

export const INDUSTRIES: IndustryProfile[] = [
  {
    industry: "Financial Services",
    subIndustries: ["Regional banking", "Asset management", "Payments", "Credit union"],
    suffixes: ["Financial", "Bancorp", "Capital", "Trust"],
    weight: 14,
  },
  {
    industry: "Insurance",
    subIndustries: ["Property & casualty", "Life & annuity", "Specialty"],
    suffixes: ["Mutual", "Assurance", "Insurance Group"],
    weight: 9,
  },
  {
    industry: "Healthcare",
    subIndustries: ["Health system", "Academic medical center", "Payer"],
    suffixes: ["Regional Health", "Health System", "Medical Partners", "Care Network"],
    weight: 14,
  },
  {
    industry: "Life Sciences",
    subIndustries: ["Biopharma", "Medical devices", "Contract research"],
    suffixes: ["Therapeutics", "Biosciences", "Life Sciences"],
    weight: 7,
  },
  {
    industry: "Manufacturing",
    subIndustries: [
      "Industrial equipment",
      "Automotive parts",
      "Specialty chemicals",
      "Aerospace components",
    ],
    suffixes: ["Industries", "Manufacturing", "Works", "Precision"],
    weight: 13,
  },
  {
    industry: "Retail & Consumer",
    subIndustries: ["Specialty retail", "Grocery", "Consumer goods"],
    suffixes: ["Brands", "Retail Group", "Markets", "Outfitters"],
    weight: 9,
  },
  {
    industry: "Logistics & Transportation",
    subIndustries: ["3PL", "Freight", "Airline services"],
    suffixes: ["Logistics", "Freight", "Transport"],
    weight: 8,
  },
  {
    industry: "Energy & Utilities",
    subIndustries: ["Electric utility", "Midstream", "Renewables"],
    suffixes: ["Energy", "Power & Light", "Utilities"],
    weight: 8,
  },
  {
    industry: "Media & Telecom",
    subIndustries: ["Regional carrier", "Broadcasting", "Streaming"],
    suffixes: ["Communications", "Media", "Networks"],
    weight: 6,
  },
  {
    industry: "Technology",
    subIndustries: ["SaaS", "Fintech platform", "Data services"],
    suffixes: ["Systems", "Software", "Labs", "Digital"],
    weight: 7,
  },
  {
    industry: "Higher Education",
    subIndustries: ["Public university", "Private university"],
    suffixes: ["University", "Institute of Technology"],
    weight: 3,
  },
  {
    industry: "Public Sector",
    subIndustries: ["State agency", "County government", "Transit authority"],
    suffixes: ["County", "Transit Authority", "State Services"],
    weight: 2,
  },
];

export const STATES = [
  "Chicago, IL",
  "Dallas, TX",
  "Charlotte, NC",
  "Columbus, OH",
  "Minneapolis, MN",
  "Denver, CO",
  "Atlanta, GA",
  "Nashville, TN",
  "Phoenix, AZ",
  "Boston, MA",
  "Indianapolis, IN",
  "Kansas City, MO",
  "Milwaukee, WI",
  "Pittsburgh, PA",
  "Raleigh, NC",
  "Salt Lake City, UT",
  "Tampa, FL",
  "Detroit, MI",
  "St. Louis, MO",
  "Omaha, NE",
];

export const EMPLOYEE_BANDS = ["1k–5k", "5k–10k", "10k–25k", "25k–50k", "50k+"] as const;
export const REVENUE_BANDS = ["$500M–$1B", "$1B–$5B", "$5B–$10B", "$10B–$25B", "$25B+"] as const;

/** Generic vendor/partner labels — user-editable; deliberately not real OEM names. */
export const GENERIC_PARTNERS = [
  "Compute OEM A",
  "Compute OEM B",
  "Storage OEM",
  "Networking OEM",
  "Hyperscaler A",
  "Hyperscaler B",
  "Security ISV",
  "ITSM Platform",
  "GPU Vendor",
  "Cooling Vendor",
];
export const GENERIC_COMPETITORS = [
  "National VAR",
  "Global SI",
  "Regional MSP",
  "OEM Direct",
  "Boutique Consultancy",
  "Cloud Native Partner",
];

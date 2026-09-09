import INDICATORS from "./indicators_descriptions.json";

// This is the json file from econdb :)

const econdbCountries = [
  {
    region: "Africa",
    verbose: "Algeria",
    iso2: "DZ",
  },
  {
    region: "Latin America",
    verbose: "Argentina",
    iso2: "AR",
  },
  {
    region: "G20",
    verbose: "Argentina",
    iso2: "AR",
  },
  {
    region: "Oceania",
    verbose: "Australia",
    iso2: "AU",
  },
  {
    region: "G20",
    verbose: "Australia",
    iso2: "AU",
  },
  {
    region: "Europe",
    verbose: "Austria",
    iso2: "AT",
  },
  {
    region: "Central Asia",
    verbose: "Azerbaijan",
    iso2: "AZ",
  },
  {
    region: "South Asia",
    verbose: "Bangladesh",
    iso2: "BD",
  },
  {
    region: "Europe",
    verbose: "Belarus",
    iso2: "BY",
  },
  {
    region: "Europe",
    verbose: "Belgium",
    iso2: "BE",
  },
  {
    region: "Latin America",
    verbose: "Brazil",
    iso2: "BR",
  },
  {
    region: "G20",
    verbose: "Brazil",
    iso2: "BR",
  },
  {
    region: "Europe",
    verbose: "Bulgaria",
    iso2: "BG",
  },
  {
    region: "Southeast Asia",
    verbose: "Cambodia",
    iso2: "KH",
  },
  {
    region: "North America",
    verbose: "Canada",
    iso2: "CA",
  },
  {
    region: "G20",
    verbose: "Canada",
    iso2: "CA",
  },
  {
    region: "Latin America",
    verbose: "Chile",
    iso2: "CL",
  },
  {
    region: "East Asia",
    verbose: "China",
    iso2: "CN",
  },
  {
    region: "G20",
    verbose: "China",
    iso2: "CN",
  },
  {
    region: "Latin America",
    verbose: "Colombia",
    iso2: "CO",
  },
  {
    region: "Europe",
    verbose: "Croatia",
    iso2: "HR",
  },
  {
    region: "Latin America",
    verbose: "Cuba",
    iso2: "CU",
  },
  {
    region: "Europe",
    verbose: "Czechia",
    iso2: "CZ",
  },
  {
    region: "Europe",
    verbose: "Denmark",
    iso2: "DK",
  },
  {
    region: "Latin America",
    verbose: "Dominican Republic",
    iso2: "DO",
  },
  {
    region: "Latin America",
    verbose: "Ecuador",
    iso2: "EC",
  },
  {
    region: "Africa",
    verbose: "Egypt",
    iso2: "EG",
  },
  {
    region: "Europe",
    verbose: "Estonia",
    iso2: "EE",
  },
  {
    region: "Africa",
    verbose: "Ethiopia",
    iso2: "ET",
  },
  {
    region: "Europe",
    verbose: "European Union",
    iso2: "EU",
  },
  {
    region: "Europe",
    verbose: "Euro Area",
    iso2: "EA",
  },
  {
    region: "G20",
    verbose: "European Union",
    iso2: "EU",
  },
  {
    region: "Europe",
    verbose: "Finland",
    iso2: "FI",
  },
  {
    region: "Europe",
    verbose: "France",
    iso2: "FR",
  },
  {
    region: "G20",
    verbose: "France",
    iso2: "FR",
  },
  {
    region: "Europe",
    verbose: "Germany",
    iso2: "DE",
  },
  {
    region: "G20",
    verbose: "Germany",
    iso2: "DE",
  },
  {
    region: "Europe",
    verbose: "Greece",
    iso2: "GR",
  },
  {
    region: "Latin America",
    verbose: "Guatemala",
    iso2: "GT",
  },
  {
    region: "Latin America",
    verbose: "Honduras",
    iso2: "HN",
  },
  {
    region: "East Asia",
    verbose: "Hong Kong",
    iso2: "HK",
  },
  {
    region: "Europe",
    verbose: "Hungary",
    iso2: "HU",
  },
  {
    region: "G20",
    verbose: "India",
    iso2: "IN",
  },
  {
    region: "South Asia",
    verbose: "India",
    iso2: "IN",
  },
  {
    region: "G20",
    verbose: "Indonesia",
    iso2: "ID",
  },
  {
    region: "Southeast Asia",
    verbose: "Indonesia",
    iso2: "ID",
  },
  {
    region: "Middle East",
    verbose: "Iran",
    iso2: "IR",
  },
  {
    region: "Middle East",
    verbose: "Iraq",
    iso2: "IQ",
  },
  {
    region: "Europe",
    verbose: "Ireland",
    iso2: "IE",
  },
  {
    region: "Middle East",
    verbose: "Israel",
    iso2: "IL",
  },
  {
    region: "Europe",
    verbose: "Italy",
    iso2: "IT",
  },
  {
    region: "G20",
    verbose: "Italy",
    iso2: "IT",
  },
  {
    region: "East Asia",
    verbose: "Japan",
    iso2: "JP",
  },
  {
    region: "G20",
    verbose: "Japan",
    iso2: "JP",
  },
  {
    region: "Central Asia",
    verbose: "Kazakhstan",
    iso2: "KZ",
  },
  {
    region: "Africa",
    verbose: "Kenya",
    iso2: "KE",
  },
  {
    region: "Middle East",
    verbose: "Kuwait",
    iso2: "KW",
  },
  {
    region: "Europe",
    verbose: "Latvia",
    iso2: "LV",
  },
  {
    region: "Middle East",
    verbose: "Lebanon",
    iso2: "LB",
  },
  {
    region: "Europe",
    verbose: "Lithuania",
    iso2: "LT",
  },
  {
    region: "Europe",
    verbose: "Luxembourg",
    iso2: "LU",
  },
  {
    region: "Southeast Asia",
    verbose: "Malaysia",
    iso2: "MY",
  },
  {
    region: "North America",
    verbose: "Mexico",
    iso2: "MX",
  },
  {
    region: "G20",
    verbose: "Mexico",
    iso2: "MX",
  },
  {
    region: "Central Asia",
    verbose: "Mongolia",
    iso2: "MN",
  },
  {
    region: "Africa",
    verbose: "Morocco",
    iso2: "MA",
  },
  {
    region: "Europe",
    verbose: "Netherlands",
    iso2: "NL",
  },
  {
    region: "Oceania",
    verbose: "New Zealand",
    iso2: "NZ",
  },
  {
    region: "Africa",
    verbose: "Nigeria",
    iso2: "NG",
  },
  {
    region: "Europe",
    verbose: "North Macedonia",
    iso2: "MK",
  },
  {
    region: "Europe",
    verbose: "Norway",
    iso2: "NO",
  },
  {
    region: "Middle East",
    verbose: "Oman",
    iso2: "OM",
  },
  {
    region: "South Asia",
    verbose: "Pakistan",
    iso2: "PK",
  },
  {
    region: "Latin America",
    verbose: "Panama",
    iso2: "PA",
  },
  {
    region: "Latin America",
    verbose: "Paraguay",
    iso2: "PY",
  },
  {
    region: "Latin America",
    verbose: "Peru",
    iso2: "PE",
  },
  {
    region: "Southeast Asia",
    verbose: "Philippines",
    iso2: "PH",
  },
  {
    region: "Europe",
    verbose: "Poland",
    iso2: "PL",
  },
  {
    region: "Europe",
    verbose: "Portugal",
    iso2: "PT",
  },
  {
    region: "Middle East",
    verbose: "Qatar",
    iso2: "QA",
  },
  {
    region: "Europe",
    verbose: "Romania",
    iso2: "RO",
  },
  {
    region: "Europe",
    verbose: "Russian Federation",
    iso2: "RU",
  },
  {
    region: "G20",
    verbose: "Russian Federation",
    iso2: "RU",
  },
  {
    region: "Middle East",
    verbose: "Saudi Arabia",
    iso2: "SA",
  },
  {
    region: "G20",
    verbose: "Saudi Arabia",
    iso2: "SA",
  },
  {
    region: "Europe",
    verbose: "Serbia",
    iso2: "RS",
  },
  {
    region: "Southeast Asia",
    verbose: "Singapore",
    iso2: "SG",
  },
  {
    region: "Europe",
    verbose: "Slovakia",
    iso2: "SK",
  },
  {
    region: "Europe",
    verbose: "Slovenia",
    iso2: "SI",
  },
  {
    region: "Africa",
    verbose: "Tanzania",
    iso2: "TZ",
  },
  {
    region: "Africa",
    verbose: "Namibia",
    iso2: "NA",
  },
  {
    region: "Africa",
    verbose: "Libya",
    iso2: "LY",
  },
  {
    region: "Africa",
    verbose: "South Africa",
    iso2: "ZA",
  },
  {
    region: "G20",
    verbose: "South Africa",
    iso2: "ZA",
  },
  {
    region: "East Asia",
    verbose: "South Korea",
    iso2: "KR",
  },
  {
    region: "G20",
    verbose: "South Korea",
    iso2: "KR",
  },
  {
    region: "Europe",
    verbose: "Spain",
    iso2: "ES",
  },
  {
    region: "Europe",
    verbose: "Sweden",
    iso2: "SE",
  },
  {
    region: "Europe",
    verbose: "Switzerland",
    iso2: "CH",
  },
  {
    region: "East Asia",
    verbose: "Taiwan",
    iso2: "TW",
  },
  {
    region: "Southeast Asia",
    verbose: "Thailand",
    iso2: "TH",
  },
  {
    region: "Africa",
    verbose: "Tunisia",
    iso2: "TN",
  },
  {
    region: "Europe",
    verbose: "Turkey",
    iso2: "TR",
  },
  {
    region: "G20",
    verbose: "Turkey",
    iso2: "TR",
  },
  {
    region: "Europe",
    verbose: "Ukraine",
    iso2: "UA",
  },
  {
    region: "Middle East",
    verbose: "United Arab Emirates",
    iso2: "AE",
  },
  {
    region: "Europe",
    verbose: "United Kingdom",
    iso2: "UK",
  },
  {
    region: "G20",
    verbose: "United Kingdom",
    iso2: "UK",
  },
  {
    region: "North America",
    verbose: "United States",
    iso2: "US",
  },
  {
    region: "G20",
    verbose: "United States",
    iso2: "US",
  },
  {
    region: "Central Asia",
    verbose: "Uzbekistan",
    iso2: "UZ",
  },
  {
    region: "Latin America",
    verbose: "Venezuela",
    iso2: "VE",
  },
  {
    region: "Southeast Asia",
    verbose: "Vietnam",
    iso2: "VN",
  },
] as const;

const countryFlags = {
  ALB: "🇦🇱",
  AGO: "🇦🇴",
  ARE: "🇦🇪",
  ARG: "🇦🇷",
  ARM: "🇦🇲",
  AUS: "🇦🇺",
  AUT: "🇦🇹",
  AZE: "🇦🇿",
  BDI: "🇧🇮",
  BEL: "🇧🇪",
  BGD: "🇧🇩",
  BGR: "🇧🇬",
  BLR: "🇧🇾",
  BIH: "🇧🇦",
  BRA: "🇧🇷",
  CAN: "🇨🇦",
  CHE: "🇨🇭",
  CHL: "🇨🇱",
  CHN: "🇨🇳",
  COL: "🇨🇴",
  CPV: "🇨🇻",
  CRI: "🇨🇷",
  CYP: "🇨🇾",
  CZE: "🇨🇿",
  DEU: "🇩🇪",
  DNK: "🇩🇰",
  DOM: "🇩🇴",
  EGY: "🇪🇬",
  ESP: "🇪🇸",
  EST: "🇪🇪",
  EU: "🇪🇺",
  FIN: "🇫🇮",
  FRA: "🇫🇷",
  GBR: "🇬🇧",
  GEO: "🇬🇪",
  GHA: "🇬🇭",
  GRC: "🇬🇷",
  HKG: "🇭🇰",
  HRV: "🇭🇷",
  HND: "🇭🇳",
  HUN: "🇭🇺",
  IDN: "🇮🇩",
  IND: "🇮🇳",
  IRL: "🇮🇪",
  IRN: "🇮🇷",
  ISL: "🇮🇸",
  ISR: "🇮🇱",
  ITA: "🇮🇹",
  JPN: "🇯🇵",
  KAZ: "🇰🇿",
  KEN: "🇰🇪",
  KGZ: "🇰🇬",
  KHM: "🇰🇭",
  KOR: "🇰🇷",
  KWT: "🇰🇼",
  LBN: "🇱🇧",
  LKA: "🇱🇰",
  LTU: "🇱🇹",
  LUX: "🇱🇺",
  LVA: "🇱🇻",
  MAC: "🇲🇴",
  MAR: "🇲🇦",
  MEX: "🇲🇽",
  MKD: "🇲🇰",
  MLT: "🇲🇹",
  MMR: "🇲🇲",
  MNG: "🇲🇳",
  MOZ: "🇲🇿",
  MNE: "🇲🇪",
  MUS: "🇲🇺",
  MYS: "🇲🇾",
  NGA: "🇳🇬",
  NLD: "🇳🇱",
  NOR: "🇳🇴",
  NZL: "🇳🇿",
  OMN: "🇴🇲",
  PAK: "🇵🇰",
  PER: "🇵🇪",
  PAN: "🇵🇦",
  PHL: "🇵🇭",
  POL: "🇵🇱",
  POR: "🇵🇹",
  PRT: "🇵🇹",
  PRY: "🇵🇾",
  QAT: "🇶🇦",
  ROU: "🇷🇴",
  RUS: "🇷🇺",
  RWA: "🇷🇼",
  SAU: "🇸🇦",
  SGP: "🇸🇬",
  SLV: "🇸🇻",
  SRB: "🇷🇸",
  SVK: "🇸🇰",
  SVN: "🇸🇮",
  SWE: "🇸🇪",
  SWZ: "🇸🇿",
  SYC: "🇸🇨",
  THA: "🇹🇭",
  TUN: "🇹🇳",
  TUR: "🇹🇷",
  TWN: "🇹🇼",
  TZA: "🇹🇿",
  UGA: "🇺🇬",
  UKR: "🇺🇦",
  URY: "🇺🇾",
  USA: "🇺🇸",
  UZB: "🇺🇿",
  VNM: "🇻🇳",
  WLD: "🌍",
  ZAF: "🇿🇦",
  ZMB: "🇿🇲",
  CMR: "🇨🇲",
  JOR: "🇯🇴",
  ERIT: "🇪🇷",
  LBY: "🇱🇾",
  MDV: "🇲🇻",
  MDG: "🇲🇬",
  IRQ: "🇮🇶",
  TJK: "🇹🇯",
  DZA: "🇩🇿",
} as const;

const countryNamesToCodes = {
  Libya: "LBY",
  Algeria: "DZA",
  Uganda: "UGA",
  Iraq: "IRQ",
  Maldives: "MDV",
  Rwanda: "RWA",
  Tajikistan: "TJK",
  Argentina: "ARG",
  Albania: "ALB",
  Australia: "AUS",
  Austria: "AUT",
  Azerbaijan: "AZE",
  Bangladesh: "BGD",
  Belgium: "BEL",
  Belarus: "BLR",
  Eritrea: "ERIT",
  Madagascar: "MDG",
  "Bosnia And Herzegovina": "BIH",
  Brazil: "BRA",
  Bulgaria: "BGR",
  Burundi: "BDI",
  Canada: "CAN",
  Cambodia: "KHM",
  Cameroon: "CMR",
  Chile: "CHL",
  China: "CHN",
  Colombia: "COL",
  "Costa Rica": "CRI",
  Croatia: "HRV",
  Cyprus: "CYP",
  "Czech Republic": "CZE",
  Czechia: "CZE",
  Denmark: "DNK",
  "Dominican Republic": "DOM",
  Egypt: "EGY",
  Estonia: "EST",
  "Euro Area": "EUR",
  "European Union": "EU",
  Finland: "FIN",
  France: "FRA",
  Germany: "DEU",
  Ghana: "GHA",
  Greece: "GRC",
  "Hong Kong": "HKG",
  Hungary: "HUN",
  Honduras: "HND",
  Iceland: "ISL",
  India: "IND",
  Indonesia: "IDN",
  Iran: "IRN",
  Ireland: "IRL",
  Israel: "ISR",
  Italy: "ITA",
  Japan: "JPN",
  Jordan: "JOR",
  Kazakhstan: "KAZ",
  Kenya: "KEN",
  Kuwait: "KWT",
  Latvia: "LVA",
  Lebanon: "LBN",
  Lithuania: "LTU",
  Luxembourg: "LUX",
  Malaysia: "MYS",
  Malta: "MLT",
  Mexico: "MEX",
  Mongolia: "MNG",
  Moldova: "MDA",
  Morocco: "MAR",
  Netherlands: "NLD",
  "New Zealand": "NZL",
  Nigeria: "NGA",
  "North Macedonia": "MKD",
  Norway: "NOR",
  Oman: "OMN",
  Panama: "PAN",
  Pakistan: "PAK",
  Peru: "PER",
  Philippines: "PHL",
  Poland: "POL",
  Portugal: "PRT",
  Qatar: "QAT",
  Romania: "ROU",
  Russia: "RUS",
  "Russian Federation": "RUS",
  "Saudi Arabia": "SAU",
  Serbia: "SRB",
  Singapore: "SGP",
  Slovakia: "SVK",
  Slovenia: "SVN",
  "South Africa": "ZAF",
  "South Korea": "KOR",
  Spain: "ESP",
  Sweden: "SWE",
  Switzerland: "CHE",
  Taiwan: "TWN",
  Tanzania: "TZA",
  Thailand: "THA",
  Turkey: "TUR",
  Tunisia: "TUN",
  Türkiye: "TUR",
  Ukraine: "UKR",
  Uruguay: "URY",
  "United Arab Emirates": "ARE",
  "United Kingdom": "GBR",
  "United States": "USA",
  Uzbekistan: "UZB",
  Vietnam: "VNM",
  World: "WLD",
} as const;

type CountryRegions<T extends (typeof econdbCountries)[number]> = {
  [K in T["region"]]: T["verbose"][];
};

const countryRegions = econdbCountries.reduce(
  (acc, country) => {
    if (!acc[country.region]) {
      acc[country.region] = [];
    }
    acc[country.region].push(country.verbose);
    return acc;
  },
  {} as CountryRegions<(typeof econdbCountries)[number]>,
);

export function getCountryFlag(country: string) {
  return countryFlags[countryNamesToCodes[country]] ?? "";
}

export function getIndicatorDescription(indicator: string, isPercent: boolean) {
  const description = INDICATORS[indicator] ?? "";

  if (isPercent) {
    return description ? `${description} (%)` : "";
  }
  return description;
}

export function getIndicators() {
  return Object.keys(INDICATORS).map((indicator) => ({
    label: INDICATORS[indicator],
    value: indicator,
  }));
}

const uniqueCountries = Array.from(
  new Set(econdbCountries.map((country) => country.iso2)),
);
const countryOptions = uniqueCountries.map((iso2) => {
  const country = econdbCountries.find((country) => country.iso2 === iso2);
  return {
    label: country.verbose,
    value: iso2,
  };
});

const countryData = Object.fromEntries(
  countryOptions.map((country) => [country.value, country]),
);

const transformOptions = [
  { label: "Default", value: null },
  { label: "Q/Q", value: "tpop" },
  { label: "Y/Y", value: "toya" },
];

const transformOptionsMap = Object.fromEntries(
  transformOptions.map((option) => [option.value, option.label]),
);

export {
  countryData,
  countryFlags,
  countryNamesToCodes,
  countryOptions,
  countryRegions,
  transformOptions,
  transformOptionsMap,
  uniqueCountries,
};

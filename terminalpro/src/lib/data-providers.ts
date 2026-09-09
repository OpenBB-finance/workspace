export const dataProviders = [
  {
    slug: "benzinga",
    name: "Benzinga",
    logo: "/assets/logos/benzinga.png",
    description:
      "Benzinga is a financial news and analysis service headquartered in Detroit, Michigan.",
    website: "https://www.benzinga.com/",
    tags: ["News", "Analyst Estimates"],
  },
  {
    slug: "intrinio",
    name: "Intrinio",
    logo: "/assets/logos/intrinio.png",
    description: "Intrinio is a financial data platform.",
    website: "https://intrinio.com/",
    isSilver: true,
    tags: ["Fundamental Analysis", "Equity Price"],
  },
  {
    slug: "fmp",
    name: "Financial Modeling Prep",
    logo: "/assets/logos/fmp.png",
    description:
      "Financial Modeling Prep is a new concept that informs you about stock markets information (news, currencies and stock prices).",
    website: "https://financialmodelingprep.com/",
    isEnterprise: true,
    tags: ["Fundamental Analysis", "Ownership", "Equity Price", "ETF", "Index"],
  },
] as const;

export type DataProvider = (typeof dataProviders)[number];
export type DataProviderSlug = DataProvider["slug"];

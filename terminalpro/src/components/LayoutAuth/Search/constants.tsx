export const defaultTabs = [
  {
    title: "Templates",
    items: [
      {
        id: "equity",
        category: "utilities",
        cmdId: "add_equity_template",
        description:
          "View a company's performance details, financials, comparisons, ownership, and events.",
        name: "Sandbox App (FMP Data)",
        type: "command",
      },
      {
        id: "calendars",
        category: "utilities",
        cmdId: "add_calendars_template",
        description:
          "Stay updated with near real-time historical performance of global currency pairs Country Indicators and Economic Overviews",
        name: "World Economics Template",
        type: "command",
      },
      {
        id: "countryEconomics",
        category: "utilities",
        cmdId: "add_country_template",
        description:
          "Research country-specific economic indicators, including GDP, inflation, and unemployment rates.",
        name: "Country Economics Template",
        type: "command",
      },
      {
        id: "etf",
        category: "utilities",
        cmdId: "add_etf_template",
        description:
          "Research ETFs with information on metadata, price performance, classification, and historical holdings.",
        name: "ETF Template",
        type: "command",
      },
    ],
  },

  {
    title: "Actions",
    items: [
      {
        category: "utilities",
        cmdId: "go_to_data_connectors",
        description: "Navigate to Data Connectors page",
        name: "Bring your own data",
        type: "command",
      },
      {
        category: "utilities",
        cmdId: "go_to_news",
        description: "Navigate to the News page",
        name: "Check latest news articles",
        type: "command",
      },
      {
        category: "utilities",
        cmdId: "go_to_charting",
        description: "Navigate to the Charting page",
        name: "Analyze in detail a chart",
        type: "command",
      },
      {
        category: "utilities",
        cmdId: "go_to_settings",
        description: "Navigate to the Settings page",
        name: "Go to Settings",
        type: "command",
      },
      {
        name: "Toggle theme",
        description: "Toggle between light and dark theme",
        category: "utilities",
        type: "command",
        cmdId: "toggle_theme",
      },
      {
        category: "utilities",
        cmdId: "add_tab",
        description: "Add dashboard",
        name: "Add dashboard",
        type: "command",
      },
      {
        category: "utilities",
        cmdId: "go_to_home",
        description: "Navigate to Home page",
        name: "Find tutorials, upcoming events and latest news from OpenBB",
        type: "command",
      },
    ],
  },
];

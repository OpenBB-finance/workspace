import NoteBox from "~/components/InAppOnboarding/Walkthrough/Analyst/Description/NoteBox";

export const CopilotPrompt =
  "Earnings Surprise Percentage = ((Actual EPS - Consensus EPS Estimate) / Consensus EPS Estimate) × 100 — Using the above formula, compute EPS surprise from the widget for the last 3 years. Then make a bar chart with Date on X axis and % surprise on Y";

const mockArtifactUuid = "36d49dbf-1bad-4f9e-9535-f930955b5f18";

export const CopilotResponse = {
  messageContent: `I have computed the EPS surprise percentages for AAPL over the last 3 years using the provided formula. A bar chart visualizing these percentages over time is available. You can view the chart here: <artifact>${mockArtifactUuid}</artifact>.`,
  citations: [
    {
      source_info: {
        type: "artifact",
        uuid: mockArtifactUuid,
        name: "chart_artifact_5f3f1",
        description:
          "The EPS surprise percentages for AAPL over the last 3 years have been calculated and are available in the attached artifact. The data shows varying levels of surprise, with some quarters exceeding expectations significantly. A bar chart visualizing these percentages over time is also included.",
      },
      details: [
        {
          "Data source": "chart_artifact_5f3f1",
        },
      ],
    },
  ],
  artifact: {
    type: "chart",
    name: "chart_artifact_ceae3",
    description:
      "The EPS surprise percentage for each date has been calculated and visualized in a bar chart. The chart displays the percentage surprise for each date over the last three years, showing how the actual EPS compared to the estimated EPS. The data is available in the attached artifact.",
    uuid: mockArtifactUuid,
    content: [
      { date: "2024-10-31 00:00:00.000000", eps_surprise_percentage: 2.5 },
      {
        date: "2024-08-01 00:00:00.000000",
        eps_surprise_percentage: 3.7037037037,
      },
      { date: "2024-05-02 00:00:00.000000", eps_surprise_percentage: 2 },
      {
        date: "2024-02-01 00:00:00.000000",
        eps_surprise_percentage: 3.8095238095,
      },
      {
        date: "2023-11-02 00:00:00.000000",
        eps_surprise_percentage: 5.035971223,
      },
      {
        date: "2023-08-03 00:00:00.000000",
        eps_surprise_percentage: 5.8823529412,
      },
      {
        date: "2023-05-04 00:00:00.000000",
        eps_surprise_percentage: 6.2937062937,
      },
      {
        date: "2023-02-02 00:00:00.000000",
        eps_surprise_percentage: -3.0927835052,
      },
      {
        date: "2022-10-27 00:00:00.000000",
        eps_surprise_percentage: 1.5748031496,
      },
      {
        date: "2022-07-28 00:00:00.000000",
        eps_surprise_percentage: 3.4482758621,
      },
      {
        date: "2022-04-28 00:00:00.000000",
        eps_surprise_percentage: 6.2937062937,
      },
      {
        date: "2022-01-27 00:00:00.000000",
        eps_surprise_percentage: 11.1111111111,
      },
    ],
    chart_params: {
      chartType: "bar",
      xKey: "date",
      yKey: ["eps_surprise_percentage"],
    },
  },
};

export const CopilotDevResponse = {
  messageContent: `Here is the bar plot of open interest against strike prices for AAPL options expiring around 50 days from now, with strike prices within 20% of the current stock price:\n\n<artifact>${mockArtifactUuid}</artifact>`,
  citations: [
    {
      source_info: {
        type: "widget",
        uuid: "866ede4d-2cbc-4c99-80a8-53295942b273",
        name: "Options Chains EOD",
        description: "Get the complete options chain for a ticker.",
        metadata: {
          symbol: "AAPL",
          source: "Intrinio",
          lastUpdated: 1736168537628,
        },
      },
      details: [
        {
          "Data source": "Options Chains EOD",
          Symbol: "AAPL",
        },
      ],
    },
    {
      source_info: {
        type: "artifact",
        uuid: "a2b7aae9-10b6-4961-886c-0604ea71f369",
        name: "table_artifact_3b90d",
        description:
          "The options chains for AAPL expiring around 50 days from now (February 21, 2025) with strike prices within 20% of the current stock price (approximately $143.45) are available in the attached artifact. The data includes contract symbols, expiration dates, strike prices, and open interest.",
        metadata: {
          query:
            "SELECT contract_symbol, expiration, strike, open_interest FROM options_chains_eod_bbafe \nWHERE expiration BETWEEN date('now', '+45 days') AND date('now', '+55 days')\nAND strike BETWEEN 143.45 * 0.8 AND 143.45 * 1.2",
        },
      },
      details: [
        {
          "Data source": "table_artifact_3b90d",
          Query:
            "SELECT contract_symbol, expiration, strike, open_interest FROM options_chains_eod_bbafe \nWHERE expiration BETWEEN date('now', '+45 days') AND date('now', '+55 days')\nAND strike BETWEEN 143.45 * 0.8 AND 143.45 * 1.2",
        },
      ],
    },
  ],
  artifact: {
    type: "chart",
    name: "chart_artifact_0a954",
    description:
      "The bar plot of open interest against strike prices for AAPL options expiring around 50 days from now shows varying levels of interest across different strike prices. The data is available in the attached artifact.",
    uuid: mockArtifactUuid,
    content: [
      { strike: 115, total_open_interest: 1212 },
      { strike: 120, total_open_interest: 689 },
      { strike: 125, total_open_interest: 172 },
      { strike: 130, total_open_interest: 1036 },
      { strike: 135, total_open_interest: 242 },
      { strike: 140, total_open_interest: 992 },
      { strike: 145, total_open_interest: 562 },
      { strike: 150, total_open_interest: 1004 },
      { strike: 155, total_open_interest: 1952 },
      { strike: 160, total_open_interest: 1121 },
      { strike: 165, total_open_interest: 1269 },
      { strike: 170, total_open_interest: 3112 },
    ],
    chart_params: {
      chartType: "bar",
      xKey: "strike",
      yKey: ["total_open_interest"],
    },
  },
};

export const CopilotDevPrompt =
  "Please do a bar plot of open interest at multiple strike price, with 20% below and above of the current stock price (around 50 days to expiration)";

interface SuggestionsNoteProps {
  isDeveloper?: boolean;
}

const AnalystText = () => {
  return (
    <>
      Using the widget we added as context, let's use Copilot to calculate Earnings
      Surprise using Earning History widget:
      <br />
      <br />
      <i>{CopilotPrompt}</i>
    </>
  );
};

const DeveloperText = () => {
  return (
    <>
      Using the widget we added as context to the Copilot, let's use the following
      prompt:
      <br />
      <br />
      <i>{CopilotDevPrompt}</i>
    </>
  );
};

const SuggestionsNote = ({ isDeveloper = false }: SuggestionsNoteProps) => {
  return (
    <>
      {isDeveloper ? <DeveloperText /> : <AnalystText />}
      <NoteBox>
        <div>
          If you don’t know where to start, Copilot suggests questions based on your
          dashboard’s content.
        </div>
        <img
          src="https://openbb-assets.s3.us-east-1.amazonaws.com/docs/pro/Suggestions.gif"
          className="w-full h-[182px] rounded mb-2"
          alt="Copilot suggestions demonstration"
        />
      </NoteBox>
    </>
  );
};

export default SuggestionsNote;

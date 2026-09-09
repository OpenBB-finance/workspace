import NoteBox from "~/components/InAppOnboarding/Walkthrough/Analyst/Description/NoteBox";
import { uuidv4 } from "~/lib/utils";

export const GeneralCopilotPrompt =
  "Earnings Surprise Percentage = ((Actual EPS - Consensus EPS Estimate) / Consensus EPS Estimate) × 100 — Using the above formula, compute EPS surprise from the widget for the last 3 years. Then make a bar chart with Date on X axis and % surprise on Y";

export const GeneralCopilotResponse = {
  uuid: uuidv4() as string,
  name: "walkthrough-eps-surprise",
  type: "chart",
  content: [
    { Date: "2021-12-31", "EPS Surprise %": 15.5 },
    { Date: "2022-12-31", "EPS Surprise %": -8.2 },
    { Date: "2023-12-31", "EPS Surprise %": 22.3 },
  ],
  description: "EPS Surprise Percentage for the last 3 years",
  chart_params: {
    chartType: "bar",
    xKey: "Date",
    yKey: ["EPS Surprise %"],
  },
};

const QueryingCopilotNote = () => {
  return (
    <>
      Using the widget we added as context, let's use Copilot to calculate Earnings
      Surprise using Earning History widget:
      <br />
      <br />"{GeneralCopilotPrompt}"
      <NoteBox>
        <div>
          If you don't know where to start, Copilot suggests questions based on your
          dashboard's content.
        </div>
        <img
          src="/assets/images/onboarding/single/04_copilot.png"
          className="w-full rounded mb-2"
          alt="Copilot suggestions"
        />
      </NoteBox>
    </>
  );
};

export default QueryingCopilotNote;

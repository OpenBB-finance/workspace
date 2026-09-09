import { useState } from "react";
import NoteBox from "~/components/InAppOnboarding/Walkthrough/Analyst/Description/NoteBox";

type ViewOption = "chartview" | "grouping";

const WidgetCapabilitiesNote = () => {
  const [selectedView, setSelectedView] = useState<ViewOption>("chartview");

  return (
    <>
      Once you bring data into the workspace, you can leverage our built-in
      capabilities:
      <br />
      <br />
      <strong>Chartview</strong>: Convert any table into a live chart.
      <br />
      <br />
      <strong>Grouping</strong>: Group widgets together to ensure they automatically
      update whenever you change the ticker symbol in one of them.
      <NoteBox>
        <div className="flex gap-2 mb-2 mt-4">
          <button
            className={`flex-1 px-4 py-2 rounded ${
              selectedView === "chartview"
                ? "bg-[#006699] text-white"
                : "bg-[#002D48] text-light-200"
            }`}
            onClick={() => setSelectedView("chartview")}
          >
            Chartview
          </button>
          <button
            className={`flex-1 px-4 py-2 rounded ${
              selectedView === "grouping"
                ? "bg-[#006699] text-white"
                : "bg-[#002D48] text-light-200"
            }`}
            onClick={() => setSelectedView("grouping")}
          >
            Grouping
          </button>
        </div>
        <img
          src={
            selectedView === "chartview"
              ? "https://openbb-assets.s3.us-east-1.amazonaws.com/docs/pro/Chartview.gif"
              : "https://openbb-assets.s3.us-east-1.amazonaws.com/docs/pro/Grouping.gif"
          }
          className="w-full h-[182px] rounded mb-2"
          alt={`${selectedView === "chartview" ? "Chartview" : "Grouping"} demonstration`}
        />
      </NoteBox>
    </>
  );
};

export default WidgetCapabilitiesNote;

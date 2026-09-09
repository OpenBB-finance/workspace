import NoteBox from "~/components/InAppOnboarding/Walkthrough/Analyst/Description/NoteBox";

const CopilotOutputNote = () => {
  return (
    <>
      You can create a widget from Copilot's output, either as text or a table, to
      generate compounded insights for your analysis.
      <NoteBox>
        <div>
          To generate just a table/chart widget without the text, you can click on the
          "Create widget from chart" button next to the clipboard icon.
        </div>
        <img
          src="https://openbb-assets.s3.us-east-1.amazonaws.com/docs/pro/Copilot_output.gif"
          className="w-full h-[182px] rounded mb-2"
          alt="Creating widget from Copilot output demonstration"
        />
      </NoteBox>
    </>
  );
};

export default CopilotOutputNote;

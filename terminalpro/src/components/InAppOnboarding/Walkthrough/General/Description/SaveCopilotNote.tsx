import NoteBox from "~/components/InAppOnboarding/Walkthrough/Analyst/Description/NoteBox";

const SaveCopilotNote = () => {
  return (
    <>
      You can create a widget from Copilot's output, either as text or a table, to
      generate compounded insights for your analysis.
      <NoteBox>
        <div>
          To generate just a table/chart widget without the text, you can click on the
          button closer to the element.
        </div>
        <img
          src="/assets/images/onboarding/single/05_artifact.png"
          className="w-full rounded mb-2"
          alt="Create widget from Copilot output"
        />
      </NoteBox>
    </>
  );
};

export default SaveCopilotNote;

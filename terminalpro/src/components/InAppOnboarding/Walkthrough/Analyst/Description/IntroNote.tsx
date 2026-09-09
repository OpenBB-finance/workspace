import NoteBox from "~/components/InAppOnboarding/Walkthrough/Analyst/Description/NoteBox";

interface IntroNoteProps {
  isDeveloper?: boolean;
}

const AnalystText = () => {
  return (
    <>
      We've started by adding an empty dashboard. Next, we'll show you how to set it up.
      <br />
      <br />
      Just click on “Show me” in the next tooltips and we'll perform the actions for you
      to see how it works.
      <br />
      <br />
      Ready? Click "Start" to begin.
    </>
  );
};

const DeveloperText = () => {
  return (
    <>
      We've started by adding an empty dashboard. Next, we'll show you how to build and
      create your proprietary dashboards.
      <br />
      <br />
      Just click on “Show me” in the next tooltips and we'll perform the actions for you
      to see how it works.
      <br />
      <br />
      Ready? Click "Start" to begin.
    </>
  );
};

const IntroNote = ({ isDeveloper = false }: IntroNoteProps) => {
  return (
    <>
      {isDeveloper ? <DeveloperText /> : <AnalystText />}
      <NoteBox>
        <div>
          <strong>Dashboard</strong> — Customizable blank canvas, where you can add any
          content and data.
        </div>
      </NoteBox>
    </>
  );
};

export default IntroNote;

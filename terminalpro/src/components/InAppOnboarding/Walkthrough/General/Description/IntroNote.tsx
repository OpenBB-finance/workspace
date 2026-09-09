import NoteBox from "~/components/InAppOnboarding/Walkthrough/Analyst/Description/NoteBox";

const IntroNote = () => {
  return (
    <>
      This is a new empty dashboard. Now, we'll show you how to build up and create your
      custom dashboards.
      <br />
      <br />
      In the next steps, just click "show me" and we'll perform the actions for you to
      see how it works.
      <br />
      <br />
      Ready to start?
      <NoteBox>
        <div>
          <strong>Dashboard</strong> — Customizable blank canvas, where you can add any
          data widgets.
        </div>
      </NoteBox>
    </>
  );
};

export default IntroNote;

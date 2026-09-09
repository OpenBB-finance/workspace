import NoteBox from "~/components/InAppOnboarding/Walkthrough/Analyst/Description/NoteBox";

const MeetCopilotNote = () => {
  return (
    <>
      The OpenBB Copilot is an AI agent that can fetch data from your dashboard and
      answer your questions.
      <NoteBox>
        <div>
          The [+] button allows you to "Add widget as context" to Copilot, forcing it to
          focus on the data from this specific widget.
        </div>
        <img
          src="/assets/images/onboarding/single/03_context.png"
          className="w-full rounded mb-2"
          alt="Copilot widget context"
        />
      </NoteBox>
    </>
  );
};

export default MeetCopilotNote;

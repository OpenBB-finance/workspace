import NoteBox from "~/components/InAppOnboarding/Walkthrough/Analyst/Description/NoteBox";

const ContextNote = () => {
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
          src="https://openbb-assets.s3.us-east-1.amazonaws.com/docs/pro/Context.gif"
          className="w-full h-[182px] rounded mb-2"
          alt="Adding widget as context demonstration"
        />
      </NoteBox>
    </>
  );
};

export default ContextNote;

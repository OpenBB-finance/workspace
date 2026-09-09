import NoteBox from "~/components/InAppOnboarding/Walkthrough/Analyst/Description/NoteBox";

const BringYourOwnCopilotNote = () => {
  return (
    <>
      Configure your LLM according to your security and compliance needs and integrate
      it into OpenBB. It's as simple as uploading data. But if you need help to set this
      up, feel free to contact us.
      <NoteBox>
        <div>
          To add your own copilot, you can click on the OpenBB Copilot dropdown and
          select ‘+’.
        </div>
        <img
          // TODO [AA-3652]: update image
          src="https://openbb-assets.s3.us-east-1.amazonaws.com/docs/pro/Copilot.gif"
          className="w-full h-[182px] rounded mb-2"
          alt="Bring your own Copilot"
        />
      </NoteBox>
    </>
  );
};

export default BringYourOwnCopilotNote;

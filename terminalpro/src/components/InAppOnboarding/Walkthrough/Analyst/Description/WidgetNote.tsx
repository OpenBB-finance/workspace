import NoteBox from "~/components/InAppOnboarding/Walkthrough/Analyst/Description/NoteBox";

const AnalystText = () => {
  return (
    <>
      You can view all the widgets that we offer out-of-the-box by clicking on this
      button.
      <br />
      <br />
      We'll now add the Earnings History widget for you.
    </>
  );
};

const DeveloperText = () => {
  return (
    <>
      Add widgets by clicking on the '+' icon. For demo purposes, we will now add 2
      widgets from the Sandbox App (FMP Data): Options Chains EOD and Watchlist.
    </>
  );
};
interface WidgetNoteProps {
  isDeveloper?: boolean;
}

const WidgetNote = ({ isDeveloper = false }: WidgetNoteProps) => {
  return (
    <>
      {isDeveloper ? <DeveloperText /> : <AnalystText />}
      <NoteBox>
        <div>
          <strong>Widget</strong> — Component within a dashboard that displays specific
          data or functions, like charts, tables, notes, images, and more.
        </div>
        <img
          src="https://openbb-assets.s3.us-east-1.amazonaws.com/docs/pro/Widgets.gif"
          className="w-full h-[182px] rounded mb-2"
          alt="Widget demonstration"
        />
      </NoteBox>
    </>
  );
};

export default WidgetNote;

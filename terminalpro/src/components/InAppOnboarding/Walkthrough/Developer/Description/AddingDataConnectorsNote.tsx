import { Link } from "react-router-dom";
import NoteBox from "~/components/InAppOnboarding/Walkthrough/Analyst/Description/NoteBox";

const AddingDataConnectorsNote = () => {
  return (
    <>
      We support data from multiple sources and in various formats, whether it's
      structured or unstructured. To bring your data into the workspace, you will need
      to set up an App.
      <br />
      <br />
      You can explore our{" "}
      <u>
        <Link to="/app/help-documentation">tutorials and documentation</Link>
      </u>{" "}
      to learn more about this process.
      <NoteBox>
        <div>
          App — Dashboard template that can include custom data widgets, specific AI
          agents, and pre-saved prompts—all carefully set up by each firm to improve
          their specific analysis work.
        </div>
        <img
          src="https://openbb-assets.s3.us-east-1.amazonaws.com/docs/pro/add+app.gif"
          className="w-full h-[182px] rounded mb-2"
          alt="Adding apps demonstration"
        />
      </NoteBox>
    </>
  );
};

export default AddingDataConnectorsNote;

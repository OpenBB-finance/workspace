import NoteBox from "~/components/InAppOnboarding/Walkthrough/Analyst/Description/NoteBox";

const AddingAppsNote = () => {
  return (
    <>
      OpenBB provides the interface so your team can own and optimize your workflow. Use
      OpenBB's built-in apps or explore apps added by your organization.
      <NoteBox>
        <div>
          <strong>App</strong> — Dashboard template that can include custom data
          widgets, specific AI agents, and pre-saved prompts—all carefully set up by
          each firm to improve their specific analysis work.
        </div>
        <img
          src="/assets/images/onboarding/single/07_apps.png"
          className="w-full rounded mb-2"
          alt="Apps overview"
        />
      </NoteBox>
    </>
  );
};

export default AddingAppsNote;

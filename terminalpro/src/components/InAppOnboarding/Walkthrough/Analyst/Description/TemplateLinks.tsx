import { useCallback, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BaseDialog } from "~/components/ds/dialogs/BaseDialog";
import { DialogTitle } from "~/components/ds/dialogs/Dialog";
import { TUTORIALS } from "~/components/InAppOnboarding/Tutorials";
import NoteBox from "~/components/InAppOnboarding/Walkthrough/Analyst/Description/NoteBox";
import { useShallowAppStore } from "~/lib/state/app";
import { useShallowWalkthroughStore } from "~/lib/state/walkthrough";
import { DEFAULT_TICKERS } from "~/lib/types";
import {
  createEquityTemplateTab,
  createOnBoardingTemplate,
} from "~/lib/utils/createTemplates";

interface TemplateLinksProps {
  isDeveloper?: boolean;
}

const TUTORIAL_MAPPINGS = Object.fromEntries(
  TUTORIALS.map((tutorial) => [tutorial.label, tutorial]),
);

const TemplateLinks = ({ isDeveloper = false }: TemplateLinksProps) => {
  const navigate = useNavigate();
  const { addTab } = useShallowAppStore((state) => ({
    addTab: state.addTab,
  }));
  const { items } = useShallowAppStore((state) => ({
    items: state.items,
  }));
  const { endWalkthrough } = useShallowWalkthroughStore((state) => ({
    endWalkthrough: state.endWalkthrough,
  }));
  const [selectedTutorial, setSelectedTutorial] = useState<string | null>(null);

  const handleTemplateClick = useCallback(
    (templateType: "onboarding" | "equity") => {
      endWalkthrough();
      switch (templateType) {
        case "onboarding":
          createOnBoardingTemplate({ addTab, navigate });
          break;
        case "equity":
          createEquityTemplateTab(
            { name: DEFAULT_TICKERS.AAPL.symbol },
            { addTab, navigate, items, defaultTicker: DEFAULT_TICKERS.AAPL },
          );
          break;
      }
    },
    [addTab, endWalkthrough, items, navigate],
  );

  const AnalystNoteBox = useMemo(() => {
    return (
      <NoteBox>
        <div>
          Here are a few templates we prepared for you:
          <ul className="list-disc ml-4 mt-1">
            <li>
              <button
                className="pointer-events-auto underline underline-offset-4 text-blue-500 hover:text-blue-700"
                onClick={() => handleTemplateClick("onboarding")}
              >
                Earning Update Workflow
              </button>
            </li>
            <li>
              <button
                className="pointer-events-auto underline underline-offset-4 text-blue-500 hover:text-blue-700"
                onClick={() => handleTemplateClick("equity")}
              >
                Equity
              </button>
            </li>
          </ul>
        </div>
      </NoteBox>
    );
  }, [handleTemplateClick]);

  const DeveloperNoteBox = useMemo(() => {
    return (
      <NoteBox>
        <div>
          Ready to build? You can also explore the tutorials we have prepared for you:
          <div className="flex flex-col mt-4">
            <button
              className="underline underline-offset-4 text-blue-500 hover:text-blue-700 pointer-events-auto"
              onClick={() => setSelectedTutorial("Custom Backend")}
            >
              <img
                className="rounded object-cover object-center"
                src={TUTORIAL_MAPPINGS["Custom Backend"]?.thumbnail}
                style={{ width: "100%", height: "100%" }}
              />
            </button>
            <p className="mt-1 text-left text-light-600 dark:text-light-400 min-h-[3em]">
              Custom Backend
            </p>
            <button
              className="underline underline-offset-4 text-blue-500 hover:text-blue-700 pointer-events-auto"
              onClick={() => setSelectedTutorial("Custom Copilots")}
            >
              <img
                className="rounded object-cover object-center"
                src={TUTORIAL_MAPPINGS["Custom Copilots"]?.thumbnail}
                style={{ width: "100%", height: "100%" }}
              />
            </button>
            <p className="mt-1 text-left text-light-600 dark:text-light-400 min-h-[3em]">
              Custom Copilots
            </p>
          </div>
        </div>
      </NoteBox>
    );
  }, []);

  return (
    <>
      {selectedTutorial !== null && (
        <BaseDialog
          open={true}
          onClose={() => {
            setSelectedTutorial(null);
            endWalkthrough();
          }}
          className="z-1000 _walkthrough-video-dialog max-h-[80vh] lg:max-w-2xl xl:max-w-4xl"
        >
          <DialogTitle>
            <p className="text-base font-bold p-2">
              {TUTORIAL_MAPPINGS[selectedTutorial]?.label}
            </p>
          </DialogTitle>
          <video
            className="h-full w-full rounded object-contain"
            src={TUTORIAL_MAPPINGS[selectedTutorial]?.videoUrl}
            controls={true}
            autoPlay={true}
          />
        </BaseDialog>
      )}
      You've completed the walkthrough! To explore more tutorials and learn how to get
      the most out of the product, visit our{" "}
      <Link to="/app/help-documentation" className="underline underline-offset-4">
        Help and Support
      </Link>{" "}
      page.
      {isDeveloper ? DeveloperNoteBox : AnalystNoteBox}
    </>
  );
};

export default TemplateLinks;

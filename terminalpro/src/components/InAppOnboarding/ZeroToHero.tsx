import clsx from "clsx";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "~/lib/state/app";
import { useThemeStore } from "~/lib/state/theme";
import { useTutorialStore } from "~/lib/state/tutorial";
import { cn } from "~/lib/utils";
import { createEquityTemplateTab } from "~/lib/utils/createTemplates";
import Icon from "../Icon";

interface Step {
  restart: () => void;
  title: string;
  // Please only use lowercase ASCII characters and underscores
  key: string;
  description: string;
}

type StepStatus = "completed" | "to do" | "in progress" | "unavailable";

const STEP_ICON = {
  completed: "checkmark-icon",
  "to do": "pencil-02",
  "in progress": "timer-icon",
  unavailable: "locker",
} as const;

function HeroCard({
  step,
  idx,
  setSelected,
  selected,
  stepCount,
}: {
  step: Step;
  idx: number;
  setSelected: (idx: number) => void;
  selected: number;
  stepCount: number;
}) {
  const { tutorials, restartTutorial } = useTutorialStore();

  const stepStatus = (tutorials[step.key] ? "completed" : "to do") as StepStatus;

  const icon = STEP_ICON[stepStatus] || ("" as any);

  const background =
    {
      completed: "bg-[#22C55E] dark:bg-[#16A34A]",
      "to do": "bg-[#EF7D00]",
      "in progress": "bg-[#33BBFF]",
      unavailable: "bg-light-300 dark:bg-[#36363F]",
    }[stepStatus] || "";

  const pillColor =
    {
      completed:
        "bg-[#6EE99B4D] text-[#16A34A] dark:bg-[#22C55E]/30 dark:text-[#22C55E]",
      "to do": "bg-[#FB923C4D] text-[#EA580C] dark:bg-[#FB923C]/30 dark:text-[#FB923C]",
      "in progress":
        "bg-[#60CAFF4D] text-[#0088CC] dark:bg-[#33BBFF]/30 dark:text-[#33BBFF]",
      unavailable:
        "bg-light-600/50 text-light-600 dark:bg-[#36363F] dark:text-[#8A8A90]",
    }[stepStatus] || "";

  return (
    <li className="relative flex flex-col mb-6 mr-2 sm:mb-0 w-full">
      <div className="flex items-center">
        <div
          className={clsx(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
            background,
          )}
        >
          <Icon id={icon} className="h-3 w-3 text-white" />
        </div>
        {idx !== stepCount - 1 && (
          <div className="mx-auto hidden h-px w-[80%] bg-light-200 dark:bg-light-600 sm:flex" />
        )}
      </div>
      <div
        onClick={() => setSelected(idx)}
        className={clsx("flex flex-col flex-1 gap-3 mt-3 p-2 min-h-[84px] rounded", {
          "bg-light-50 dark:bg-dark-750": selected === idx,
          "cursor-pointer hover:bg-light-50 dark:hover:bg-dark-750":
            selected !== idx && stepStatus !== "unavailable",
        })}
      >
        <div className="mb-1">
          <div
            className={clsx(
              "w-fit rounded-xl px-1.5 py-0.5 text-2xs/[12px] capitalize",
              pillColor,
            )}
          >
            {stepStatus}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <p className="subtitle-xs-regular text-dark-50">Challenge {idx + 1}</p>
          <div className="flex justify-between">
            <h3 className="body-xs-bold text-light-900 dark:text-white">
              {step.title}
            </h3>
            {["to do", "completed"].includes(stepStatus) && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  restartTutorial(step.key);
                  step.restart();
                }}
                className="obb-btn-secondary-v2 h-6 px-2 py-0.5 font-medium md:w-fit"
              >
                {stepStatus === "completed" ? "Restart" : "Start"}
              </button>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

function Timeline() {
  const { addTab, items } = useAppStore();
  const { defaultTicker } = useThemeStore();
  const navigate = useNavigate();
  const [selected, setSelected] = useState(0);

  function tableChartingReset() {
    let alreadyOpen = false;
    let foundId = "";
    if (items) {
      for (const itemId of Object.keys(items)) {
        if (
          items[itemId].data &&
          items[itemId].data.templateId === "equity" &&
          (!items[itemId].data.numberOfChanges ||
            items[itemId].data.numberOfChanges < 5)
        ) {
          alreadyOpen = true;
          foundId = itemId;
        }

        if (alreadyOpen) {
          break; // Exit the outer loop
        }
      }
    }
    if (alreadyOpen) {
      navigate(`/app/${foundId}?tab=financials`);
    } else {
      createEquityTemplateTab(
        {
          name: defaultTicker.symbol,
        },
        {
          addTab,
          navigate,
          items,
          defaultTicker,
        },
        "financials",
      );
    }
  }

  const steps: Step[] = [
    {
      restart: () =>
        createEquityTemplateTab(
          {
            name: defaultTicker.symbol,
          },
          {
            addTab,
            navigate,
            items,
            defaultTicker,
          },
          "financials",
        ),
      title: "Grouping Mechanism",
      key: "grouping",
      description:
        "This feature allows you to create groups of widgets and link them to a specific ticker. It simplifies the process of switching between different tickers across various widgets with just a few clicks.",
    },
    {
      restart: () => tableChartingReset(),
      title: "Generate charts from raw data",
      key: "table_charting",
      description:
        "Discover how to effortlessly transform tabular data into insightful visualizations directly within the OpenBB Workspace, eliminating the need for data downloads.",
    },
    {
      title: "Import your data",
      key: "data_connectors",
      description:
        "Learn the method for importing data into the OpenBB Workspace from any JSON-compatible APIs, leveraging OpenBB’s advanced capabilities like Generative AI and custom charting.",
      restart: () => navigate("/app/data-connectors"),
    },
    {
      title: "Charting",
      key: "charting",
      description:
        "Explore advanced charting effortlessly with this feature. Conduct Technical Analysis, compare securities, and analyze financials of different companies. Let's begin your journey into advanced charting.",
      restart: () => navigate("/app/charting"),
    },
  ];
  return (
    <div className="flex flex-col gap-4">
      <ol className="flex overflow-x-auto">
        {steps.map((step, idx) => (
          <HeroCard
            step={step}
            idx={idx}
            key={step.key}
            setSelected={setSelected}
            selected={selected}
            stepCount={steps.length}
          />
        ))}
      </ol>
      <div className="h-[112px] overflow-y-auto rounded bg-light-50 p-2.5 dark:bg-dark-750">
        <p className="subtitle-xs-regular text-dark-50">Challenge {selected + 1}</p>
        <div>
          <h3 className="mb-2 mt-2.5 font-semibold text-light-900 dark:text-white">
            {steps[selected].title}
          </h3>
        </div>
        <p className="text-light-750 dark:text-light-300">
          {steps[selected].description}
        </p>
      </div>
    </div>
  );
}

export default function ZeroToHero() {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="flex flex-col gap-2.5 mt-6 dark:bg-dark-850 rounded-lg bg-light-50 p-4 text-xs">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="text-sm font-bold inline-flex items-center gap-2"
      >
        <Icon
          id="chevron-right"
          className={cn(
            "size-4 min-w-4 ease-[cubic-bezier(0.87,_0,_0.13,_1)] transition-transform duration-300",
            { "rotate-90": isOpen },
          )}
        />
        Challenges
      </button>
      {isOpen && (
        <>
          <p className="text-xs mb-2">
            Complete these challenges to become a power user.
          </p>
          <Timeline />
        </>
      )}
    </div>
  );
}

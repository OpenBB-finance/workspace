import * as TabsPrimitive from "@radix-ui/react-tabs";
import type { ReactNode } from "react";
import { ExtensionOptions } from "~/lib/constants";
import { useTutorialStore } from "~/lib/state/tutorial";
import { cn } from "~/lib/utils";
import { BaseDialog } from "../ds/dialogs/BaseDialog";
import { DialogDescription, DialogTitle } from "../ds/dialogs/Dialog";
import Icon from "../Icon";
import type { IconId } from "../Icon.types";
import SingleApiEndpointContent from "./NewComponents/ApiEndpoint/Content";
import BackendContent from "./NewComponents/Backend/Content";
import CopilotTableContent from "./NewComponents/CopilotTables/Content";
import FileContent from "./NewComponents/File/Content";
import RSSContent from "./NewComponents/RSS/Content";
import WebsiteContent from "./NewComponents/Website/Content";
import YouTubeContent from "./NewComponents/YouTube/Content";
import { type DcTabT, useDataConnectorContext } from "./Providers/DataConnectorContext";

function MenuTab({
  value,
  label,
  icon,
  showIcon = true,
}: {
  value: string;
  label?: string | ReactNode;
  icon?: IconId;
  showIcon?: boolean;
}) {
  return (
    <TabsPrimitive.Trigger
      value={value}
      className={cn(
        "rounded flex gap-2.5 items-center p-2.5 text-left capitalize whitespace-nowrap flex-shrink-0 sm:flex-shrink only-sm:gap-1.5 only-sm:px-2 only-sm:py-1 only-sm:text-xs",
        "radix-state-active:bg-general-bg-secondary-hover radix-state-active:font-medium",
        "radix-state-inactive:text-ds-text-body",
        "radix-state-inactive:hover:bg-general-bg-primary-hover",
        value && `_button_${value}`,
      )}
    >
      {showIcon && (
        <Icon id={icon} className="size-4 text-brand-main dark:text-brand-lighter" />
      )}
      {label || value}
    </TabsPrimitive.Trigger>
  );
}

const dataTypes = [
  { id: "file", label: "File", icon: "file-attachment-01" },
  { id: "single", label: "Endpoint", icon: "layout-top" },
  { id: "website", label: "Iframe", icon: "globe-01" },
  { id: "youtube", label: "YouTube", icon: "transcript-icon" },
  { id: "rss", label: "RSS / Atom Feed", icon: "rss-01" },
] as const;

export const DataConnectionTabs = ({
  showAppsSection = true,
  showIcons = true,
}: {
  showAppsSection?: boolean;
  showIcons?: boolean;
}) => {
  const { dcTab, setTab, mode } = useDataConnectorContext();
  const { currentTutorial, currentStep, goToStep } = useTutorialStore();

  return (
    <TabsPrimitive.Root
      defaultValue={dcTab === "snowflake" ? "database" : dcTab}
      value={dcTab === "snowflake" ? "database" : dcTab}
      onValueChange={(value: DcTabT) => {
        if (currentTutorial === "data_connectors" && currentStep === 2) {
          setTimeout(() => goToStep(3), 500);
        }
        setTab(value);
      }}
      orientation="horizontal"
      className="flex h-full bg-tab-group-bg rounded border  border-secondary/20 only-sm:flex-col"
    >
      {mode === "create" && (
        <TabsPrimitive.List className="flex gap-1 overflow-auto p-2.5 sm:min-w-[180px] sm:flex-col sm:border-r sm:border-surface-divider only-sm:overflow-x-auto only-sm:flex-shrink-0">
          {showAppsSection && (
            <>
              <MenuTab
                value="backend"
                label="Apps"
                icon="grid-01"
                showIcon={showIcons}
              />
              <div className="obb-divider my-2 only-sm:hidden" />
              <p className="obb-uppercase-small-title ml-1 only-sm:hidden">
                My Widgets
              </p>
            </>
          )}
          {dataTypes.map(({ id, label, icon }) => (
            <MenuTab
              value={id}
              label={label}
              key={id}
              icon={icon}
              showIcon={showIcons}
            />
          ))}
        </TabsPrimitive.List>
      )}
      <Content
        value="file"
        title={
          mode === "edit" ? "File" : "Create New Widgets from Single or Multiple File"
        }
        description={`Supported file formats: ${ExtensionOptions.map((e) => e.toUpperCase()).join(", ")}.`}
      >
        <FileContent />
      </Content>
      <Content
        value="single"
        title="Endpoint"
        description={
          mode === "edit"
            ? "API Endpoint"
            : "Instantly create a table widget from an endpoint. Suitable for a single endpoint. Requires JSON output and CORS-enabled APIs."
        }
      >
        <SingleApiEndpointContent />
      </Content>
      {showAppsSection && (
        <Content
          value="backend"
          title={mode === "edit" ? "App" : "Integrate your own Apps"}
          description="Apps are tailored combinations of dashboard templates, widgets, AI agents and pre-saved prompts to enhance specific workflows. You can add apps by connecting a backend."
        >
          <BackendContent />
        </Content>
      )}
      {/* <Content
          value="database"
          title={mode === "edit" ? "Database" : "Database Integrations"}
          description="Connect to various database systems like SQLite, Snowflake, MySQL, and PostgreSQL to query and visualize your data."
        >
          <DatabaseContent />
        </Content> */}
      <Content
        value="website"
        title="Iframe"
        description="Add any embeddable iframe URL (e.g. Streamlit or Plotly dashboards) to your workspace."
      >
        <WebsiteContent />
      </Content>
      <Content
        value="youtube"
        title="YouTube"
        description="Add any YouTube video link."
      >
        <YouTubeContent />
      </Content>
      <Content
        value="rss"
        title="RSS / Atom Feed"
        description="Add any RSS or Atom feed to your workspace."
      >
        <RSSContent />
      </Content>
      <Content
        value="copilot_table"
        title="Copilot Table"
        description="Add a Copilot Table to your workspace."
      >
        <CopilotTableContent />
      </Content>
    </TabsPrimitive.Root>
  );
};

const AddConnectionModal = () => {
  const { open, setOpen, dcTab, mode } = useDataConnectorContext();

  return (
    <BaseDialog
      className={cn(
        mode === "edit"
          ? "min-w-[40vw] sm:max-w-[40vw] xl:min-w-[40vw] lg:max-w-[60vw] xl:max-w-[800px]"
          : "min-w-[60vw] sm:max-w-[60vw] xl:min-w-[40vw] lg:max-w-[60vw] xl:max-w-[800px]",
        "h-[90vh] w-[95vw] sm:h-[560px] lg:h-[640px] dark:bg-dark-900",
      )}
      open={open}
      onClose={() => setOpen(false)}
    >
      <DialogTitle className="capitalize">
        {mode === "create"
          ? "Add Data"
          : mode === "add-widget"
            ? `Add Widget To Connection — ${dcTab}`
            : `Edit Data — ${dcTab}`}
      </DialogTitle>
      <DialogDescription className="sr-only">
        Add data connections to OpenBB
      </DialogDescription>
      <div className="h-[calc(100%-30px)]">
        <DataConnectionTabs />
      </div>
    </BaseDialog>
  );
};

function Content({
  value,
  title,
  description,
  children,
}: {
  value: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  const { mode } = useDataConnectorContext();
  return (
    <TabsPrimitive.Content
      value={value}
      className={
        "relative overflow-y-auto w-full bg-tab-group-bg p-2.5 rounded only-sm:flex-1 only-sm:min-h-0"
      }
    >
      <div className="flex flex-col h-full">
        {mode === "create" && (
          <div className="only-sm:hidden">
            <p className="text-sm font-bold mb-1">{title}</p>
            <p className="text-general-label mb-2">{description}</p>
          </div>
        )}
        {children}
      </div>
    </TabsPrimitive.Content>
  );
}

export default AddConnectionModal;

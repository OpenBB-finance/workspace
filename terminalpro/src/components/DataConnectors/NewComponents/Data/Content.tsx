import { useState } from "react";
import { Button } from "~/components/ds/atoms/Button";
import Icon from "~/components/Icon";
import { getAllowedDBTypes } from "~/lib/onPremFeatureFlags";
import { getConfig } from "~/lib/runtimeConfig";
import { useShallowFeatureFlagsStore } from "~/lib/state/featureFlags";
import TerminalProOnlyTag from "../../../General/TerminalProOnlyTag";
import { useDataConnectorContext } from "../../Providers/DataConnectorContext";
import SnowflakeDialog from "../../SnowflakeDialog";
import SqlDatabaseDialog from "../../SqlDatabaseDialog";

interface State {
  type: "database" | "snowflake" | "";
}

export default function DataContent() {
  const { mode, dcTab } = useDataConnectorContext();
  const [state, setState] = useState<State>({
    type: ["add-widget", "edit"].includes(mode)
      ? (dcTab as "database" | "snowflake")
      : "",
  });

  const renderContent = () => {
    switch (state.type) {
      case "":
        return <EmptyState setState={setState} />;
      case "snowflake":
        return <SnowflakeDialog goBack={() => setState({ type: "" })} />;
      case "database":
        return <SqlDatabaseDialog goBack={() => setState({ type: "" })} />;
      default:
        return null;
    }
  };

  return <>{renderContent()}</>;
}

function EmptyState({ setState }: { setState: (state: State) => void }) {
  const featureFlags = useShallowFeatureFlagsStore((state) => state.featureFlags);
  const isProTier = featureFlags?.tier === "pro";
  const { mode } = useDataConnectorContext();
  const allowedDBTypes = getAllowedDBTypes();

  const providers = [
    ...(allowedDBTypes.includes("database")
      ? [
          {
            name: "SQL Database",
            icon: "database-icon" as const,
            description:
              "Seamlessly access and analyze data from your MySQL or SQLite database.",
            handleClick: () => {
              setState({ type: "database" });
            },
          },
        ]
      : []),
    ...(allowedDBTypes.includes("snowflake")
      ? [
          {
            name: "Snowflake",
            icon: "simple-icons-snowflake" as const,
            description:
              "Bring powerful data visualization and AI tools to your Snowflake data.",
            handleClick: () => {
              setState({ type: "snowflake" });
            },
          },
        ]
      : []),
    ...(allowedDBTypes.includes("databricks")
      ? [
          {
            name: "Databricks",
            icon: "simple-icons-databricks" as const,
            description: "Leverage Databricks integration for comprehensive analytics.",
          },
        ]
      : []),
    ...(allowedDBTypes.includes("clickhouse")
      ? [
          {
            name: "ClickHouse",
            icon: "simple-icons-clickhouse" as const,
            description:
              "Connect to ClickHouse to bring powerful data visualization and AI tools to your clickhouse data.",
          },
        ]
      : []),
  ];
  console.log(providers);

  const uiShowExternalDocumentationLinksFF = getConfig().ui.showExternalDocLinks;

  return (
    <>
      {uiShowExternalDocumentationLinksFF && mode === "create" && (
        <a
          href="https://docs.openbb.co/workspace/developers/data-integration"
          target="_blank"
          rel="noreferrer noopener"
          className="text-xs dark:text-brand-lighter text-brand-main inline-flex gap-1 items-center whitespace-nowrap mb-2"
        >
          <Icon id="play-icon" />
          Tutorial: How to add a database connection
        </a>
      )}
      <div className="space-y-2.5">
        {providers.map((provider) => {
          const available = !!provider.handleClick;
          return (
            <div
              key={provider.name}
              className="p-4 dark:bg-dark-700 flex items-center justify-between gap-6 rounded-lg bg-white"
            >
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center p-1 rounded-[2px] bg-light-10 dark:bg-dark-500">
                    <Icon id={provider.icon} className="w-4 h-4" />
                  </div>
                  <div className="font-bold text-xs">{provider.name}</div>
                  {available ? (
                    <TerminalProOnlyTag isVisible={!isProTier} />
                  ) : (
                    <div className="obb-tag">Coming Soon</div>
                  )}
                </div>
                <p>{provider.description}</p>
              </div>
              <Button
                size="sm"
                disabled={!(isProTier && available)}
                onClick={provider.handleClick}
              >
                Enable
              </Button>
            </div>
          );
        })}
      </div>
    </>
  );
}

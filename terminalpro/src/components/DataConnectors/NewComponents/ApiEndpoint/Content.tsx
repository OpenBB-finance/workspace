import Icon from "~/components/Icon";
import { getConfig } from "~/lib/runtimeConfig";
import { useDataConnectorContext } from "../../Providers/DataConnectorContext";
import { SingleWidgetProvider } from "../../SingleWidget";

export default function SingleApiEndpointContent() {
  const { mode } = useDataConnectorContext();
  const uiShowExternalDocumentationLinksFF = getConfig().ui.showExternalDocLinks;

  return (
    <>
      {uiShowExternalDocumentationLinksFF && mode === "create" && (
        <a
          href="https://docs.openbb.co/workspace/analysts/widgets/core-widgets"
          target="_blank"
          rel="noreferrer noopener"
          className="text-xs dark:text-brand-lighter text-brand-main inline-flex gap-1 items-center whitespace-nowrap mb-2"
        >
          <Icon id="play-icon" />
          Tutorial: How to add a Single API Endpoint
        </a>
      )}
      <SingleWidgetProvider />
    </>
  );
}

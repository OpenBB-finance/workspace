import { getConfig } from "~/lib/runtimeConfig";
import AdvancedWidgetDialog from "../../AdvancedWidgetDialog";
import { useDataConnectorContext } from "../../Providers/DataConnectorContext";

export default function BackendContent() {
  const { mode } = useDataConnectorContext();
  const uiShowExternalDocumentationLinksFF = getConfig().ui.showExternalDocLinks;

  return (
    <>
      {uiShowExternalDocumentationLinksFF && mode === "create" && (
        <a
          href="https://github.com/OpenBB-finance/backend-examples-for-openbb-workspace/tree/main/getting-started"
          target="_blank"
          rel="noreferrer noopener"
          className="text-xs obb-hyper-link inline-flex gap-1 items-center whitespace-nowrap mb-2"
        >
          Check out custom backend examples
        </a>
      )}
      <AdvancedWidgetDialog />
    </>
  );
}

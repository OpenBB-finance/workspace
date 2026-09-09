import { Link } from "react-router-dom";
import { DownloadLinks } from "~/components/DataConnectors/URLDialog";
import { useDataConnectorStore } from "~/lib/state/dataConnector";
import { updateVersion } from "~/utils/dataConnectorsHelpers";

export function OutOfDate() {
  const { dataConnectorUrl } = useDataConnectorStore();

  function handleClick(e) {
    e.preventDefault();
    updateVersion(dataConnectorUrl.toString());
  }

  return (
    <p className="text-red-500">
      Please download a new data connector <DownloadLinks />, or{" "}
      <Link
        onClick={(e) => handleClick(e)}
        to=""
        className="font-bold obb-hyper-link underline underline-offset-1"
      >
        check again.
      </Link>
    </p>
  );
}

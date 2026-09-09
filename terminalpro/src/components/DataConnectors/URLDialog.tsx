import { useState } from "react";
import { Link } from "react-router-dom";
import { useShallowDataConnectorStore } from "~/lib/state/dataConnector";
import { BaseDialog } from "../ds/dialogs/BaseDialog";
import DataConnectorUrl from "../Forms/DataConnectorUrl";

export function DownloadLinks() {
  const baseUrl = "https://openbb-installers.s3.amazonaws.com";
  return (
    <span>
      ({" "}
      <Link
        to={`${baseUrl}/openbb_data_connector_0.2.2.dmg`}
        className="obb-hyper-link underline underline-offset-1"
      >
        {" "}
        Mac
      </Link>{" "}
      or{" "}
      <Link
        to={`${baseUrl}/OpenBB+Data+Connector_0.2.2_x64_en-US.msi`}
        className="obb-hyper-link underline underline-offset-1"
      >
        {" "}
        Windows
      </Link>{" "}
      )
    </span>
  );
}

export function URLDialog() {
  const dataConnectorUrl = useShallowDataConnectorStore(
    (state) => state.dataConnectorUrl,
  );
  const [open, setOpen] = useState(!dataConnectorUrl);

  return (
    <BaseDialog open={open} onClose={() => setOpen(false)}>
      <div className="flex items-center gap-4">
        <h4 className="text-lg font-bold">Database Connector URL</h4>
      </div>
      <p>
        The Database Connector URL is used to connect your database to the OpenBB
        Workspace.
        <br />
        <br />
        In order to accomplish this you need to be running our Data Connector server
        application <DownloadLinks />, which will run locally on your machine.
      </p>
      <DataConnectorUrl buttonPosition="right" />
    </BaseDialog>
  );
}

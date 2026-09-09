import { useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { useDataConnectorContext } from "../../Providers/DataConnectorContext";
import EditFileTab from "./EditFileTab";
import ManageFileInfoTab2 from "./ManageFileInfoTab2";
import UploadFilesTab1 from "./UploadFilesTab1";

export default function FileContent() {
  const { mode } = useDataConnectorContext();
  const [tab, setTab] = useState("upload"); // "upload" or "edit-info"
  const methods = useForm();

  return (
    <FormProvider {...methods}>
      {mode === "create" ? (
        tab === "upload" ? (
          <UploadFilesTab1 next={() => setTab("edit-info")} />
        ) : (
          <ManageFileInfoTab2 prev={() => setTab("upload")} />
        )
      ) : (
        <EditFileTab />
      )}
    </FormProvider>
  );
}

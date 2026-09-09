import clsx from "clsx";
import { type FormEvent as ReactFormEvent, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { type DBType, getDatabases } from "~/api/dataConnectors";
import FieldError from "~/components/Forms/FieldError";
import { useStateReducer } from "~/hooks/useStateReducer";
import { getConfig } from "~/lib/runtimeConfig";
import { useAuthStore } from "~/lib/state/auth";
import { useDataConnectorStore } from "~/lib/state/dataConnector";
import { getHeaders } from "~/lib/utils/fetch";
import { updateVersion } from "~/utils/dataConnectorsHelpers";
import { Button } from "../ds/atoms/Button";

function validateURL(url: string): boolean {
  if (!url) return true;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

async function checkUrl(url: string): Promise<null | string> {
  if (!validateURL(url)) return "Improperly formatted URL";
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return "Please only include the URL origin";
    }
    return null;
  } catch {
    return "Server is not running at this URL";
  }
}

export default function DataConnectorUrl({
  buttonPosition = "left",
}: {
  buttonPosition?: "left" | "right";
}) {
  const { user } = useAuthStore();
  const {
    dataConnectorUrl,
    setDataConnectorUrl,
    setDataConnectorVersion,
    setDatabases,
    validVersion,
  } = useDataConnectorStore();
  const [state, dispatch] = useStateReducer({
    loading: false,
    temp: dataConnectorUrl ? dataConnectorUrl.toString() : "",
    error: "",
  });

  // On the very first render, check if the URL is valid
  useEffect(() => {
    if (dataConnectorUrl) {
      checkUrl(dataConnectorUrl.toString()).then((result) => {
        if (result) {
          dispatch({ error: result });
        }
      });
    }
  }, []);

  useEffect(() => {
    updateVersion(dataConnectorUrl?.toString());
  }, [dataConnectorUrl]);

  const saveSettings = useCallback(
    async (url: string) => {
      dispatch({ loading: true });
      try {
        const response = await fetch(
          `${getConfig().urls.backend}/pro/data-connector-url`,
          {
            method: "POST",
            body: JSON.stringify({ url }),
            headers: getHeaders(user?.token),
          },
        );
        // this makes it so that it is possible to update to empty URL
        if (response.ok || !dataConnectorUrl) {
          toast.success("Data Connector settings updated", {
            description: "Your Data Connector settings have been updated successfully",
          });
          for (const dbType of ["database", "snowflake"] as DBType[]) {
            getDatabases(dbType).then((response) =>
              setDatabases(dbType, response || []),
            );
          }
        } else {
          toast.error("Error updating settings", {
            description: "Your Data Connector settings were not updated",
          });
        }
      } catch (error) {
        console.error("Error:", error.message);
        toast.error("Error updating settings", {
          description: "Your Data Connector settings were not updated",
        });
      }
      dispatch({ loading: false });
    },
    [dataConnectorUrl, setDatabases, user?.token],
  );

  async function handleSubmit(e: ReactFormEvent<HTMLFormElement>) {
    e.preventDefault();
    const result = await checkUrl(state.temp);
    if (!state.temp) {
      setDataConnectorUrl(undefined);
      setDataConnectorVersion(undefined);
      dispatch({ error: "" });
    } else if (result) {
      dispatch({ error: result });
      return;
    } else {
      const url = new URL(state.temp);
      setDataConnectorUrl(url);
      dispatch({ error: "" });
    }
    saveSettings(state.temp || null);
  }

  function handleClear() {
    setDataConnectorUrl(undefined);
    setDataConnectorVersion(undefined);
    dispatch({ temp: "", error: "" });
    saveSettings(null);
  }

  const versionMessage =
    !validVersion() && "The current data connector has an invalid version";

  return (
    <form className="flex flex-col" onSubmit={handleSubmit}>
      <label className="mr-6 inline-flex w-[400px] flex-col text-black dark:text-white mb-3">
        Data Connector URL (must run in the background)
        <input
          className="obb-minimal-input-full mt-2 h-[32px] max-w-[400px] py-[0px] font-normal"
          value={state.temp}
          onChange={(e) => dispatch({ temp: e.target.value })}
        />
        <FieldError
          id="password-error"
          error={state.error || versionMessage}
          className="mt-2"
        />
      </label>
      <div className="flex">
        <Button
          disabled={!validateURL(state.temp) || state.loading}
          className={clsx({ "ml-auto": buttonPosition === "right" })}
          size="sm"
        >
          {dataConnectorUrl ? "Update" : "Add"}
        </Button>
        {dataConnectorUrl && (
          <Button
            size="sm"
            disabled={!validateURL(state.temp)}
            className="ml-2"
            onClick={handleClear}
          >
            Clear
          </Button>
        )}
      </div>
    </form>
  );
}

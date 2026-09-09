import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { getServerDatabasesExisting } from "~/api/dataConnectors";
import { OutOfDate } from "~/components/DataConnectors/OutOfDate";
import { Form1 } from "~/components/DataConnectors/SQLDatabase/Form1";
import { Form2 } from "~/components/DataConnectors/SQLDatabase/Form2";
import { useStateReducer } from "~/hooks/useStateReducer";
import { useDataConnectorStore } from "~/lib/state/dataConnector";
import { type SQLIntroForm, SQLIntroSchema } from "~/utils/zodForms";
import { useDataConnectorContext } from "./Providers/DataConnectorContext";
import { URLDialog } from "./URLDialog";

export default function SqlDatabaseDialog({ goBack }: { goBack: () => void }) {
  const { id, widgetId } = useDataConnectorContext();
  const { dataConnectorUrl, databases, validVersion } = useDataConnectorStore();
  const [items, setItems] = useState<string[]>([]);
  const [error, setError] = useState(false);

  const activeDatabase = useMemo(() => {
    return databases.find((database) => database.connection === Number(id));
  }, [id, databases]);

  const [state, dispatch] = useStateReducer({
    secondPage: activeDatabase !== undefined,
  });

  const form = useForm<SQLIntroForm>({
    resolver: zodResolver(SQLIntroSchema),
    defaultValues: { username: "", password: "", host: "" },
  });

  useEffect(() => {
    if (dataConnectorUrl) {
      fetch(dataConnectorUrl)
        .then((res) => setError(!res.ok))
        .catch(() => setError(true));
    } else {
      setError(false);
    }
  }, [dataConnectorUrl]);

  useEffect(() => {
    if (activeDatabase) {
      getServerDatabasesExisting("database", activeDatabase.id)
        .then((items) => {
          if (Array.isArray(items)) {
            setItems(items);
          }
        })
        .catch(console.error);
    }
  }, [activeDatabase]);

  const isValidVersion = validVersion();

  return (
    <>
      {error && (
        <p className="text-red-500">
          Data Connector is not reachable at {dataConnectorUrl.toString()}
        </p>
      )}
      {!dataConnectorUrl && <URLDialog />}
      {!validVersion() && <OutOfDate />}
      {state.secondPage ? (
        <Form2
          activeItem={activeDatabase}
          selectItems={items}
          error={error || !isValidVersion}
          data={form.getValues()}
          setSecondPage={(secondPage) => dispatch({ secondPage })}
        />
      ) : (
        <Form1
          goBack={goBack}
          form={form}
          setItems={setItems}
          error={error || !isValidVersion}
          setSecondPage={(secondPage) => dispatch({ secondPage })}
        />
      )}
    </>
  );
}

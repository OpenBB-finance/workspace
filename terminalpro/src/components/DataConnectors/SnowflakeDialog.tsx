import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { snowflakeRolesExisting } from "~/api/dataConnectors";
import { OutOfDate } from "~/components/DataConnectors/OutOfDate";
import { Form1 } from "~/components/DataConnectors/Snowflake/Form1";
import { Form2 } from "~/components/DataConnectors/Snowflake/Form2";
import { useStateReducer } from "~/hooks/useStateReducer";
import { useDataConnectorStore } from "~/lib/state/dataConnector";
import { type SnowflakeIntroForm, SnowflakeIntroSchema } from "~/utils/zodForms";
import { useDataConnectorContext } from "./Providers/DataConnectorContext";
import { URLDialog } from "./URLDialog";

export default function SnowflakeDialog({ goBack }: { goBack: () => void }) {
  const { id, widgetId } = useDataConnectorContext();
  /*
  if mode is "add-widget" means we are trying to add a new widget to an existing snowflake, then id is the snowflake id

  if mode is "edit" means we are editing an existing widget inside an existing snowflake, then widgetId is the widget id and id is the snowflake id
  */
  const { snowflakes, dataConnectorUrl, validVersion } = useDataConnectorStore();

  const activeSnowflake = useMemo(() => {
    return snowflakes.find((snowflake) => snowflake.connection === Number(id));
  }, [id, snowflakes]);

  const [state, dispatch] = useStateReducer({
    roles: activeSnowflake === undefined ? [] : [activeSnowflake.role],
    error: false,
    secondPage: activeSnowflake !== undefined,
  });

  const form = useForm<SnowflakeIntroForm>({
    resolver: zodResolver(SnowflakeIntroSchema),
    defaultValues: { username: "", password: "", account: "" },
  });

  // Check to see if the data connector is reachable
  useEffect(() => {
    if (dataConnectorUrl) {
      fetch(dataConnectorUrl)
        .then((res) => dispatch({ error: !res.ok }))
        .catch(() => dispatch({ error: true }));
    } else {
      dispatch({ error: false });
    }
  }, [dispatch, dataConnectorUrl]);

  // If this is an update, get roles based on the existing information
  useEffect(() => {
    if (activeSnowflake) {
      snowflakeRolesExisting(activeSnowflake.id).then((items) => {
        if (Array.isArray(items)) {
          dispatch({ roles: items });
        }
      });
    }
  }, [activeSnowflake, dispatch]);

  const isValidVersion = validVersion();

  return (
    <>
      {state.error && (
        <p className="text-red-500">
          Data Connector is not reachable at {dataConnectorUrl.toString()}.
        </p>
      )}
      {!dataConnectorUrl && <URLDialog />}
      {!isValidVersion && <OutOfDate />}
      {state.secondPage ? (
        <Form2
          activeItem={activeSnowflake}
          data={form.getValues()}
          selectItems={state.roles}
          error={state.error || !isValidVersion}
          setSecondPage={(secondPage) => dispatch({ secondPage })}
        />
      ) : (
        <Form1
          goBack={goBack}
          form={form}
          setItems={(roles) => dispatch({ roles })}
          error={state.error || !isValidVersion}
          setSecondPage={(secondPage) => dispatch({ secondPage })}
        />
      )}
    </>
  );
}

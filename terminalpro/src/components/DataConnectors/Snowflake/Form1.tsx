import { useCallback, useState } from "react";
import { toast } from "sonner";
import { snowflakeRoles } from "~/api/dataConnectors";
import { Button } from "~/components/ds/atoms/Button";
import { FormInput } from "~/components/ds/atoms/Input";
import { Form, FormField } from "~/components/ds/molecules/Form";
import { type Form1Type, formatUrl } from "~/utils/dataConnectorsHelpers";
import type { SnowflakeIntroForm } from "~/utils/zodForms";

export function Form1({
  goBack,
  form,
  setSecondPage,
  setItems,
  error,
}: Form1Type<SnowflakeIntroForm>) {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = useCallback(
    async (values: SnowflakeIntroForm) => {
      setLoading(true);
      const data = {
        username: values.username,
        password: values.password,
        account_identifier: formatUrl(values.account),
      };
      const selections = await snowflakeRoles(data);

      if (Array.isArray(selections)) {
        setItems(selections);
        setSecondPage(true);
      } else {
        setErrorMessage(selections.detail ?? "Unexpected error occurred");
        setLoading(false);
        toast.error("Error", {
          description: "Unable to add the snowflake database",
        });
      }
    },
    [setItems, setSecondPage],
  );

  return (
    <Form {...form}>
      <form
        className="h-full flex flex-col gap-3 text-xs text-[#A2A2A2] dark:text-[#8A8A90]"
        onSubmit={form.handleSubmit(handleSubmit)}
      >
        <FormField
          name="username"
          control={form.control}
          render={({ field }) => {
            return (
              <FormInput
                label="Username"
                placeholder="bobby_axelrood"
                {...field}
                autoComplete="new-username"
              />
            );
          }}
        />
        <FormField
          name="password"
          control={form.control}
          render={({ field }) => {
            return (
              <FormInput
                label="Password"
                placeholder="password"
                type="password"
                autoComplete="new-password"
                {...field}
              />
            );
          }}
        />
        <FormField
          name="account"
          control={form.control}
          render={({ field }) => {
            return (
              <FormInput
                label="Account"
                placeholder="ab12345.us-east-2.aws"
                {...field}
              />
            );
          }}
        />

        {errorMessage && <p className="text-red-500">{errorMessage}</p>}
        <div className="mt-auto flex gap-2.5 justify-end">
          <Button variant="outlined" size="sm" type="button" onClick={goBack}>
            Cancel
          </Button>
          <Button
            className="[&_svg]:h-4"
            disabled={error}
            type="submit"
            variant="primary"
            size="sm"
            loading={loading}
          >
            Next
          </Button>
        </div>
      </form>
    </Form>
  );
}

import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import ErrorContent from "~/components/Forms/Error";
import { type totpForm, totpSchema } from "~/utils/zodForms";
import { Button } from "../ds/atoms/Button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "../ds/molecules/Form";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "../ui/input-otp";

type TOTPEnterFormProps = {
  handleClose: () => void;
  handleSubmit: (open: number) => Promise<number>;
  onCancel?: () => void;
  isActive?: boolean;
};

export default function TOTPEnterForm({
  handleClose,
  handleSubmit,
  onCancel,
  isActive = true,
}: TOTPEnterFormProps) {
  const form = useForm({
    resolver: zodResolver(totpSchema),
    defaultValues: { totp: "" },
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = useCallback(
    async (values: totpForm) => {
      setLoading(true);
      setError("");
      try {
        const cleanValue = Number.parseInt(values.totp, 10);
        const statusCode = await handleSubmit(cleanValue);
        if (statusCode === 200) {
          if (!isActive) toast.success("2FA enabled successfully.");
          handleClose();
        } else if (statusCode === 401 || statusCode === 202) {
          setError("Invalid totp token submitted.");
          form.setValue("totp", "");
        } else {
          setError("An unknown error occurred.");
          form.setValue("totp", "");
        }
      } catch (e) {
        setError("An error occurred while processing your request.");
        form.setValue("totp", "");
      } finally {
        setLoading(false);
      }
    },
    [handleSubmit, handleClose, isActive, form],
  );

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="w-full mx-auto md:w-[408px]"
      >
        <FormField
          name="totp"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="pb-2">
                Enter the 6 digit code from your authenticator app.
              </FormLabel>
              <FormControl>
                <InputOTP
                  maxLength={6}
                  value={field.value}
                  onChange={(value) => field.onChange(value)}
                  onComplete={() => {
                    if (!loading) {
                      form.handleSubmit(onSubmit)();
                    }
                  }}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </FormControl>
            </FormItem>
          )}
        />
        <ErrorContent text={error} />
        <div className="mt-8 flex justify-end gap-3">
          <Button
            variant="outlined"
            type="button"
            size="sm"
            onClick={onCancel}
            className="h-8 px-3 py-1 font-medium md:w-fit"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            size="sm"
            disabled={loading || !form.formState.isValid}
            loading={loading}
            className="obb-btn-tertiary h-8 px-3 py-1 font-medium md:w-fit"
          >
            Submit
          </Button>
        </div>
      </form>
    </Form>
  );
}

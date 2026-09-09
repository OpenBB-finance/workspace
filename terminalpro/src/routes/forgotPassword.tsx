import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback } from "react";
import { useForm } from "react-hook-form";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { forgotPassword } from "~/api/auth.api";
import { Button } from "~/components/ds/atoms/Button";
import { FormInput } from "~/components/ds/atoms/Input";
import { Form, FormField } from "~/components/ds/molecules/Form";
import ErrorContent from "~/components/Forms/Error";
import { useStateReducer } from "~/hooks/useStateReducer";
import { getConfig } from "~/lib/runtimeConfig";
import { zodEmail } from "~/utils/zodForms";

const forgotSchema = z.object({ email: zodEmail });

type forgotForm = z.infer<typeof forgotSchema>;

const servicesEmailFF = getConfig().services.email;

export default function ForgotPasswordPage() {
  const [searchParams] = useSearchParams();
  const [state, dispatch] = useStateReducer({
    loading: false,
    formError: "",
  });

  const form = useForm({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: searchParams.get("email") ?? "" },
  });

  const onSubmit = useCallback(
    async (values: forgotForm) => {
      dispatch({ loading: true, formError: "" });
      let formError = "";
      try {
        const { status, detail } = await forgotPassword(values.email);

        if (status === 200) {
          return toast.success("Forgot password email sent", {
            description: "Check your email for a link to reset your password",
          });
        }

        if (status === 422) {
          formError = "Invalid form data.";
        } else if (status === 429) {
          formError = "Too many requests. Please try again later.";
        } else if (status === 404 || status === 409) {
          formError = detail;
        } else {
          formError = "An unknown error occurred";
        }
      } catch (error) {
        formError = "An unknown error occurred";
      } finally {
        dispatch({ loading: false, formError });
      }
    },
    [dispatch],
  );

  const allowForgotPasswordFF = getConfig().authentication.allowForgotPassword;

  if (!allowForgotPasswordFF) {
    return <Navigate to="/login" replace={true} />;
  }

  return (
    <div className="absolute top-0 left-0 w-full h-full overflow-y-auto hide-scrollbars">
      <div className="flex items-center justify-center min-h-screen w-full py-8 px-8">
        <div className="w-full max-w-[408px] p-10 rounded-lg bg-white">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="w-full space-y-6 force-light"
            >
              <img
                className="max-h-[130px] rounded-none"
                src={getConfig().whiteLabel.loginImage}
                alt="openbb"
              />
              <div>
                <h1 className="text-light-800 body-lg-bold mb-1.5">Forgot Password</h1>
                <Link to="/login" className="text-sm text-light-800 body-xs-regular">
                  Return to <span className="obb-hyper-link underline">Login</span>
                </Link>
              </div>
              {servicesEmailFF ? (
                <>
                  <p className="mt-6 text-sm text-light-800">
                    Please enter the email address associated with your account below.
                    We will send you a secure link to reset your password.
                  </p>
                  <div className="mt-6">
                    <FormField
                      name="email"
                      render={({ field }) => (
                        <FormInput
                          type="email"
                          label="Email"
                          placeholder="example@openbb.co"
                          clearable={false}
                          className="obb-autofill-light"
                          {...field}
                        />
                      )}
                    />
                  </div>
                  <ErrorContent text={state.formError} />
                  <div className="mt-[42px] flex flex-col gap-4 items-center justify-center">
                    <Button
                      className="w-full max-w-[240px]"
                      variant="primary"
                      type="submit"
                      size="md"
                      loading={state.loading}
                      disabled={state.loading}
                    >
                      Send request
                    </Button>
                  </div>
                </>
              ) : (
                <p className="mt-6 text-sm text-light-800">
                  Please contact your administrator to reset your password.
                </p>
              )}
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}

import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { forgotPasswordConfirmation } from "~/api/auth.api";
import { Button } from "~/components/ds/atoms/Button";
import { FormInput } from "~/components/ds/atoms/Input";
import { FormField } from "~/components/ds/molecules/Form";
import ErrorContent from "~/components/Forms/Error";
import { useStateReducer } from "~/hooks/useStateReducer";
import { getConfig } from "~/lib/runtimeConfig";
import { type resetForm, resetSchema } from "~/utils/zodForms";

export default function ForgotPasswordConfirmationPage() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email") || "";
  const token = searchParams.get("token");
  const navigate = useNavigate();

  const [state, dispatch] = useStateReducer({
    loading: false,
    formError: "",
  });

  const form = useForm<resetForm>({
    resolver: zodResolver(resetSchema),
    defaultValues: {
      password: "",
      confirm: "",
    },
    mode: "onChange",
  });

  const onSubmit = useCallback(
    async (values: resetForm) => {
      if (!token) {
        dispatch({
          loading: false,
          formError: "Reset token is missing or invalid",
        });
        return;
      }

      dispatch({ loading: true, formError: "" });
      let formError = "";
      try {
        const status = await forgotPasswordConfirmation(token, values.password);

        if (status === 200) {
          toast.success("Password successfully changed", {
            description: "You can now login with your new password",
          });
          const cleanEmail = encodeURIComponent(email);
          navigate(`/login?email=${cleanEmail}`);
          return;
        }

        if (status === 422) {
          formError = "An unknown error occurred";
        }
      } catch (error) {
        formError = "An unknown error occurred";
      } finally {
        dispatch({ loading: false, formError });
      }
    },
    [dispatch, email, navigate, token],
  );

  const allowForgotPasswordFF = getConfig().authentication.allowForgotPassword;

  if (!allowForgotPasswordFF) {
    return <Navigate to="/login" replace={true} />;
  }

  return (
    <div className="absolute top-0 left-0 w-full h-full overflow-y-auto hide-scrollbars">
      <div className="flex items-center justify-center min-h-screen w-full py-8 px-8">
        <div className="w-full max-w-[408px] p-10 rounded-lg bg-white">
          <FormProvider {...form}>
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
                <h1 className="text-light-800 body-lg-bold mb-1.5">Reset Password</h1>
                <Link to="/login" className="text-sm text-light-800 body-xs-regular">
                  Return to <span className="obb-hyper-link underline">Login</span>
                </Link>
              </div>
              <p className="mt-6 text-sm text-light-800">
                Your new password should be a minimum of 8 characters and include at
                least one uppercase letter, one lowercase letter, one number, and one
                special character.
              </p>
              <div className="mt-6 space-y-6">
                <FormField
                  name="password"
                  control={form.control}
                  render={({ field }) => (
                    <FormInput
                      type="password"
                      label="New Password"
                      placeholder="Enter your new password"
                      error={!!form.formState.errors.password}
                      message={form.formState.errors.password?.message}
                      {...field}
                    />
                  )}
                />
                <FormField
                  name="confirm"
                  control={form.control}
                  render={({ field }) => (
                    <FormInput
                      type="password"
                      label="Confirm Password"
                      placeholder="Confirm your new password"
                      error={!!form.formState.errors.confirm}
                      message={form.formState.errors.confirm?.message}
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
                  Submit
                </Button>
              </div>
            </form>
          </FormProvider>
        </div>
      </div>
    </div>
  );
}

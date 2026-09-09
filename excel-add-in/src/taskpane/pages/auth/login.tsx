import { zodResolver } from "@hookform/resolvers/zod";
import {
  Alert,
  Button,
  Checkbox,
  Form,
  FormControl,
  FormField,
  FormItem,
  Input,
} from "@openbb/ui";
import { AxiosError } from "axios";
import posthog from "posthog-js";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import * as backend from "~/backend/auth.api";

import { useAuthStore } from "~/store/auth";
import Layout from "~/taskpane/components/layout.tsx";

const formSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(6, "Password must contain at least 6 symbols")
    .max(50),
  remember: z.boolean(),
});

type TForm = z.infer<typeof formSchema>;

interface ErrorAlert {
  title: string;
  message?: string;
}

export default function Page() {
  const navigate = useNavigate();
  const location = useLocation();
  const authStore = useAuthStore();

  const form = useForm<TForm>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
      remember: false,
    },
  });

  const [alert, setAlert] = useState<ErrorAlert | null>(null);

  async function handleSubmit(values: TForm) {
    try {
      const user = await backend.login(values.email, values.password, values.remember);
      if (user && user.uuid) {
        posthog.identify(user.uuid, {
          name: user.username,
          email: user.email,
        });
      }
      if (user.feature_entitlements?.tier === "pro") {
        authStore.login(
          user.uuid,
          user.email,
          user.username || user.email,
          user.access_token,
          user.expiration_date,
          user.profile,
        );
        const from = location.state?.from || "/account";
        navigate(from);
      } else {
        setAlert({
          title: "Access denied",
          message:
            "Pro tier access required to sign in. Please contact sales@openbb.co for more information.",
        });
        posthog.capture("login_failed_tier", {
          tier: user.feature_entitlements?.tier,
        });
      }
    } catch (error) {
      posthog.capture("login_failed", {
        error_message: error.message,
        error_stack: error.stack,
      });
      if (error instanceof AxiosError) {
        if (error.response && error.response.status) {
          const { message } = error;
          const { status } = error.response;
          console.log(error, message, status);
          if (status === 400) {
            setAlert({
              title: "Trial expired",
              message: "Please contact sales@openbb.co for an extension",
            });
          } else if (status === 401) {
            setAlert({
              title: "Credentials are incorrect",
              message: "Enter a valid email and password",
            });
          } else if (status === 402) {
            setAlert({
              title: "Access denied",
              message: "OpenBB Pro access required to sign in",
            });
          } else {
            setAlert({ title: "Something went wrong" });
          }
        } else {
          setAlert({ title: "Something went wrong" });
        }
      } else {
        setAlert({ title: "Something went wrong" });
      }
      console.log(error);
    }
  }

  return (
    <Layout>
      <div className="flex flex-col items-center">
        <img className="h-10" src="/assets/logo/horizontal.svg" title="logo" />

        <div className="mt-12 w-full">
          <h1 className="subtitle-md-bold">Login</h1>
          <div className="mt-3">
            Don't have an account?&nbsp;
            <Link className="link whitespace-nowrap" to="/auth/signup">
              Sign up
            </Link>
          </div>
        </div>

        <Form {...form}>
          <form
            className="mt-8 w-full space-y-8"
            onSubmit={form.handleSubmit(handleSubmit)}
          >
            <div className="space-y-6">
              <FormField
                name="email"
                render={({ field }) => (
                  <Input label="Email" placeholder="Enter email" {...field} />
                )}
              />
              <FormField
                name="password"
                render={({ field }) => (
                  <Input
                    type="password"
                    label="Password"
                    placeholder="Enter password"
                    {...field}
                  />
                )}
              />
            </div>
            <div className="flex flex-wrap items-center">
              <FormField
                name="remember"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Checkbox
                        label="Remember me"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <div className="flex-1" />
              <Link
                className="link whitespace-nowrap"
                to="/auth/forgot-password"
              >
                Forgot password?
              </Link>
            </div>

            {alert && (
              <Alert variant="error" title={alert.title}>
                {alert.message}
              </Alert>
            )}

            <div className="flex justify-center">
              <Button className="px-10" type="submit">
                Login
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </Layout>
  );
}

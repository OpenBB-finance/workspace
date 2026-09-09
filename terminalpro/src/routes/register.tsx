import { zodResolver } from "@hookform/resolvers/zod";
import { InfoCircledIcon } from "@radix-ui/react-icons";
import { usePostHog } from "posthog-js/react";
import { useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { registerUser } from "~/api/auth.api";
import { Button } from "~/components/ds/atoms/Button";
import { Checkbox } from "~/components/ds/atoms/Checkbox";
import { FormInput } from "~/components/ds/atoms/Input";
import { FormSelect } from "~/components/ds/atoms/Select";
import { Form, FormField } from "~/components/ds/molecules/Form";
import ErrorContent from "~/components/Forms/Error";
import { Agreement } from "~/components/General/Agreement";
import Icon from "~/components/Icon";
import type { IconId } from "~/components/Icon.types";
import { GoogleRegister } from "~/components/LayoutUnauth/GoogleRegister";
import { MicrosoftRegister } from "~/components/LayoutUnauth/MicrosoftRegister";
import { OktaRegister } from "~/components/LayoutUnauth/OktaRegister";
import { type StateDispatch, useStateReducer } from "~/hooks/useStateReducer";
import { getEnabledIdentityProviders } from "~/lib/onPremFeatureFlags";
import { getConfig } from "~/lib/runtimeConfig";
import { useShallowAuthStore } from "~/lib/state/auth";
import { cn } from "~/lib/utils";
import { loginSuccess } from "~/routes/login";
import type { ProLoginResponse } from "~/types/auth.type";
import { zodEmail } from "~/utils/zodForms";

const HEAR_ABOUT_US_OPTIONS = [
  { value: "linkedin", label: "LinkedIn" },
  { value: "twitter", label: "X (Twitter)" },
  { value: "colleague", label: "Colleague/peer" },
  { value: "event", label: "Event/conference" },
  { value: "search", label: "Search (Google, Bing, etc.)" },
  { value: "ai_assistant", label: "AI assistant (ChatGPT, Perplexity, etc.)" },
  { value: "blog", label: "Blog post/article" },
  { value: "github", label: "GitHub" },
  { value: "webinar", label: "Webinar" },
  { value: "other", label: "Other (please specify)" },
];

const signupSchema = z
  .object({
    email: zodEmail,
    agreement: z.boolean(),
    newsletter: z.boolean(),
    hearAboutUs: z.string().min(1, "Field is Required."),
    otherHearAboutUs: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.hearAboutUs === "other") {
        return !!data.otherHearAboutUs?.trim();
      }
      return true;
    },
    {
      message: "Please specify how you heard about us.",
      path: ["otherHearAboutUs"],
    },
  );

type signupForm = z.infer<typeof signupSchema>;

const REGISTER_CAROUSEL: Array<{
  id: string;
  title: string;
  icon: IconId;
  text: string;
}> = [
  {
    id: "bring-all-your-data-together",
    title: "Bring all your data together",
    icon: "database-01",
    text: "Combine and visualize different datasets from multiple sources",
  },
  {
    id: "customize-your-dashboards",
    title: "Customize your dashboards",
    icon: "layout",
    text: "Build flexible dashboards without coding from scratch",
  },
  {
    id: "save-time-with-ai",
    title: "Save time with AI",
    icon: "sparkles-icon",
    text: "Integrate custom AI agents or use the OpenBB Copilot",
  },
  {
    id: "safeguard-your-data",
    title: "Safeguard your data",
    icon: "safe-check",
    text: "Deploy on-premises or in your private cloud",
  },
];

const defaultState = {
  loading: false,
  warnEmail: false,
  bookingOpen: false,
  formError: "",
  showQR: null,
  enterQR: false,
  showReset: false,
  loggedIn: false,
  movedToDeveloper: false,
  oauthLoading: false,
};

export type RegisterState = typeof defaultState;

export default function RegisterPage() {
  const enabledProviders = getEnabledIdentityProviders();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const posthog = usePostHog();

  const authStore = useShallowAuthStore((state) => ({
    login: state.login,
    needsOnboarding: state.needsOnboarding,
    lastVisitedPage: state.lastVisitedPage,
  }));

  const [state, dispatch] = useStateReducer<RegisterState>(defaultState);

  useEffect(() => {
    if (state.loggedIn && !(state.showQR || state.showReset)) {
      if (authStore.needsOnboarding) {
        navigate("/onboarding");
      } else {
        const nextPage = authStore.lastVisitedPage;
        const searchParams = new URLSearchParams();
        if (state.movedToDeveloper) {
          searchParams.append("moved_to_developer", "true");
        }
        const queryString = searchParams.toString();
        navigate(`${nextPage}${queryString ? `?${queryString}` : ""}`);
      }
    }
  }, [
    state.loggedIn,
    state.showQR,
    state.showReset,
    state.movedToDeveloper,
    authStore.needsOnboarding,
    navigate,
    authStore.lastVisitedPage,
  ]);

  const form = useForm({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: searchParams.get("email") ?? "",
      agreement: false,
      newsletter: false,
      hearAboutUs: "",
      otherHearAboutUs: "",
    },
  });

  const onSubmit = useCallback(
    async (values: signupForm) => {
      dispatch({ loading: true, formError: "" });
      let formError = "";
      try {
        const agreement = values.agreement;
        if (!agreement) {
          dispatch({
            formError: "You must agree to the terms and conditions.",
          });
          return;
        }
        if (import.meta.env.DEV) console.log("values", values);
        const hearAboutUsValue =
          values.hearAboutUs === "other"
            ? (values.otherHearAboutUs ?? "").trim()
            : values.hearAboutUs;
        const { status, detail } = await registerUser(
          values.email,
          values.newsletter,
          hearAboutUsValue,
        );
        if (status === 200) {
          window.localStorage.clear();
          window.sessionStorage.clear();
          dispatch({ warnEmail: true });
          setTimeout(() => {
            navigate("/login?fromRegister=true");
          }, 5000);
          return;
        }

        formError = "An error occurred, please try again later";

        if ([403, 409, 422].includes(status) && detail) {
          formError = detail;
        }
      } catch (e) {
        formError = "An error occurred, please try again later";
      } finally {
        dispatch({ loading: false, formError });
      }
    },
    [dispatch],
  );

  const captureError = useCallback(
    (error: Error, status: number, email?: string) => {
      console.error(error);
      if (posthog) {
        posthog.capture("login_error", {
          email,
          error: error.message,
          stack: error.stack,
          status,
        });
      }
      dispatch({
        formError: "An unexpected error occurred. Please try again or contact support.",
        loading: false,
        showQR: null,
        enterQR: false,
        oauthLoading: false,
      });
    },
    [posthog, dispatch],
  );

  const allowRegistrationFF = getConfig().authentication.allowRegistration;

  if (!allowRegistrationFF) {
    return <Navigate to="/login" replace={true} />;
  }

  return (
    <div className="absolute top-0 left-0 w-full h-full overflow-y-auto hide-scrollbars">
      <div className="flex flex-col min-h-screen">
        <div className="flex flex-col md:flex-row min-h-screen">
          <div className="hidden md:flex w-1/2 bg-brand-darker overflow-y-auto items-center justify-center">
            <div className="flex items-center justify-center min-h-screen py-8 px-20">
              <div className="[&_svg]:text-white">
                <img
                  className="max-h-[130px rounded-none"
                  src={getConfig().whiteLabel.loginImageDark}
                  alt="openbb"
                />
                <p className="body-xl-bold my-6 text-white">Bridge your data with AI</p>
                <div className="flex flex-col gap-4">
                  {REGISTER_CAROUSEL.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 bg-brand-main/50 rounded flex items-start gap-3"
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        <Icon id={item.icon} className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h1 className="body-sm-bold text-white">{item.title}</h1>
                        <p className="body-xs-regular text-justify mt-1 text-white">
                          {item.text}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="w-full md:w-1/2 bg-dark-850 overflow-y-hidden text-light-800! dark:text-light-800!">
            <div className="flex items-center justify-center min-h-screen w-full py-8 px-8">
              <div className="w-full max-w-[408px] p-10 rounded-lg bg-white">
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="w-full space-y-6 force-light"
                  >
                    <img
                      className="max-h-[130px] md:hidden rounded-none"
                      src={getConfig().whiteLabel.loginImage}
                      alt="openbb"
                    />
                    <h1 className="text-light-800 body-lg-bold mb-1.5">
                      Create your account
                    </h1>
                    <Link
                      to="/login"
                      className="text-sm text-light-800 body-xs-regular"
                    >
                      Already have an account?
                      <span className="obb-hyper-link ml-2">Login</span>
                    </Link>
                    <div className="mt-6 space-y-6">
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
                      <FormField
                        name="hearAboutUs"
                        control={form.control}
                        render={({ field }) => (
                          <FormSelect
                            placeholder="- Select Option -"
                            label={<p>How did you hear about us?</p>}
                            options={HEAR_ABOUT_US_OPTIONS}
                            forceLight={true}
                            {...field}
                          />
                        )}
                      />
                      {form.watch("hearAboutUs") === "other" && (
                        <FormField
                          name="otherHearAboutUs"
                          control={form.control}
                          render={({ field }) => (
                            <FormInput
                              label={<p>Please specify</p>}
                              placeholder="How did you found us?"
                              clearable={false}
                              className="obb-autofill-light"
                              {...field}
                            />
                          )}
                        />
                      )}
                    </div>
                    <FormField
                      name="agreement"
                      render={({ field }) => (
                        <Agreement
                          id="agreement"
                          errorMessage={state.formError}
                          {...field}
                        />
                      )}
                    />
                    <FormField
                      name="newsletter"
                      render={({ field }) => (
                        <div className="flex gap-3 items-start">
                          <Checkbox
                            id="newsletter"
                            checked={field.value}
                            className="border-light-600 dark:border-light-600 hover:border-light-700! dark:hover:border-light-700! dark:data-[state=checked]:border-brand-main! data-[state=checked]:border-brand-main"
                            onCheckedChange={field.onChange}
                          />
                          <label
                            htmlFor="newsletter"
                            className="-mt-1 text-xs text-light-800 text-left"
                          >
                            I want to receive monthly emails about product updates and
                            events.
                          </label>
                        </div>
                      )}
                    />
                    {state.warnEmail && (
                      <div
                        id="form-info-message"
                        className={cn(
                          "bg-[#C8E7FF] text-black",
                          "border-2 border-[#C8E7FF]",
                          "relative mt-8 rounded h-fit",
                          "flex items-center p-5 gap-2",
                        )}
                      >
                        <div className="self-start">
                          <InfoCircledIcon
                            strokeWidth={1.5}
                            className="text-[#065592]"
                          />
                        </div>
                        <p className="text-xs" role="alert">
                          <strong>Check email inbox.</strong> We sent an email to
                          complete your registration.
                        </p>
                      </div>
                    )}
                    <ErrorContent text={state.formError} />
                    <div className="mt-[42px] flex flex-col gap-4 items-center justify-center">
                      <Button
                        className="w-full max-w-[240px]"
                        variant="primary"
                        type="submit"
                        size="md"
                        loading={state.loading}
                      >
                        Create account
                      </Button>
                      {enabledProviders.length > 0 && (
                        <>
                          <span className="text-dark-100 text-xs px-4">or</span>
                          <div className="flex flex-col gap-4 w-full max-w-[240px]">
                            {enabledProviders.includes("google") && (
                              <div className="relative w-full notranslate">
                                <GoogleRegister
                                  dispatch={dispatch}
                                  form={form}
                                  loginSuccess={loginSuccess}
                                  captureError={captureError}
                                  state={state}
                                />
                              </div>
                            )}
                            {enabledProviders.includes("microsoft") && (
                              <div className="relative w-full notranslate">
                                <MicrosoftRegister
                                  dispatch={dispatch}
                                  form={form}
                                  loginSuccess={loginSuccess}
                                  captureError={captureError}
                                  state={state}
                                />
                              </div>
                            )}
                            {enabledProviders.includes("okta") && (
                              <div className="relative w-full notranslate">
                                <OktaRegister
                                  dispatch={dispatch}
                                  form={form}
                                  loginSuccess={loginSuccess}
                                  captureError={captureError}
                                  state={state}
                                />
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </form>
                </Form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export interface OAuthRegisterProps {
  dispatch: StateDispatch<RegisterState>;
  state: RegisterState;
  form: any;
  loginSuccess: (data: ProLoginResponse) => Promise<{
    showQR: string;
    showReset: boolean;
    loggedIn: boolean;
    movedToDeveloper: boolean;
  }>;
  captureError: (error: Error, status: number, email?: string) => void;
}

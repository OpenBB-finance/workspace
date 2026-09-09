import { zodResolver } from "@hookform/resolvers/zod";
import { memo, useCallback, useEffect } from "react";
import { useFormContext } from "react-hook-form";
import { Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import {
  getDeveloperOnboardingQuestions,
  submitDeveloperOnboardingQuestions,
  updateFullName,
  userHasEntity,
} from "~/api/auth.api";
import { getDashboards } from "~/api/dashboard.api";
import { Button } from "~/components/ds/atoms/Button";
import { FormInput } from "~/components/ds/atoms/Input";
import { FormSelect } from "~/components/ds/atoms/Select";
import { Form, FormField, useForm } from "~/components/ds/molecules/Form";
import { type StateDispatch, useStateReducer } from "~/hooks/useStateReducer";
import { getConfig } from "~/lib/runtimeConfig";
import { useShallowAppStore } from "~/lib/state/app";
import { useShallowAuthStore } from "~/lib/state/auth";
import { useShallowFeatureFlagsStore } from "~/lib/state/featureFlags";
import { useShallowThemeStore } from "~/lib/state/theme";
import { handleTemplatesCreation } from "~/lib/utils/createTemplates";
import { setupNewEntity } from "~/lib/utils/setupNewEntity";
import type { DashSync } from "~/types/auth.type";
import { ORGANIZATIONS, ROLES } from "../onboarding/constants";

const uiShowOnboardingQuestionsFF = getConfig().ui.showOnboardingQuestions;

const baseOnboardingSchema = z.looseObject({
  first: z.string().min(1, "Field is Required."),
  last: z.string().min(1, "Field is Required."),
});

const onboardingSchema = z
  .object({
    first: z.string().min(1, "Field is Required."),
    last: z.string().min(1, "Field is Required."),
    primaryUsage: z.string().optional(),
    organization: z.string().min(1, "Field is Required."),
    organizationName: z.string().optional(),
    otherOrganization: z.string().optional(),
    role: z.string().min(1, "Field is Required."),
    otherRole: z.string().optional(),
    programmingExperience: z.string().optional(),
    dataTypes: z.array(z.string()).optional().default([]),
    otherDataType: z.string().optional(),
  })
  .refine(
    (data) => {
      if (["professional", "academic"].includes(data.primaryUsage)) {
        return !!data.organizationName;
      }
      return true;
    },
    {
      message: "Company Name is required for Professional or Academic usage.",
      path: ["organizationName"],
    },
  );

const onboardingQuestionsSchema = z
  .union([baseOnboardingSchema, onboardingSchema])
  .refine((data) => {
    if (uiShowOnboardingQuestionsFF) {
      return onboardingSchema.safeParse(data).success;
    }

    return baseOnboardingSchema.safeParse(data).success;
  });

type OnboardingUnion = z.infer<typeof onboardingQuestionsSchema>;
type OnboardingQuestions = z.infer<typeof onboardingSchema>;

type State = {
  dashboardsData: DashSync | null;
  isLoading: boolean;
  showOtherRole: boolean;
  showOtherOrganization: boolean;
  hasLoadedEntity: boolean;
  hasEntity: boolean;
  pendingNavigation: string | null;
};

export default function DeveloperOnboardingHomepage() {
  const defaultTicker = useShallowThemeStore((state) => state.defaultTicker);
  const navigate = useNavigate();
  const { addTab, items, updateOnlyItems } = useShallowAppStore((state) => ({
    addTab: state.addTab,
    items: state.items,
    updateOnlyItems: state.updateOnlyItems,
  }));
  const { entityName } = useShallowAuthStore((state) => ({
    entityName: state.user?.entity_name,
  }));

  const { name, onBoardingData, updateOnboardingData, updateOnboarding, user } =
    useShallowAuthStore((s) => ({
      name: s.name,
      onBoardingData: s.onBoardingData,
      updateOnboardingData: s.updateOnboardingData,
      updateOnboarding: s.updateOnboarding,
      user: s.user,
    }));

  const [state, dispatch] = useStateReducer<State>({
    dashboardsData: null,
    isLoading: false,
    showOtherRole: false,
    showOtherOrganization: false,
    hasLoadedEntity: false,
    hasEntity: false,
    pendingNavigation: null,
  });

  const form = useForm<OnboardingUnion>({
    resolver: zodResolver(onboardingQuestionsSchema),
    defaultValues: {
      first: name?.first || "",
      last: name?.last || "",
      primaryUsage: onBoardingData.primaryUsage || "",
      organization: onBoardingData.organization || "",
      organizationName: onBoardingData.organizationName || "",
      otherOrganization: "",
      role: onBoardingData.role || "",
      otherRole: "",
      programmingExperience: onBoardingData.programmingExperience || "",
      dataTypes: onBoardingData.dataTypes || [],
      otherDataType: onBoardingData.otherDataType || "",
    },
    mode: "onChange",
  });
  const featureFlags = useShallowFeatureFlagsStore((state) => state.featureFlags);

  useEffect(() => {
    getDashboards()
      .then((res) => {
        dispatch({ dashboardsData: res });
      })
      .catch((error) => {
        console.error(error);
      });
  }, []);

  useEffect(() => {
    userHasEntity()
      .then((res) => {
        dispatch({ hasEntity: res.success, hasLoadedEntity: true });
      })
      .catch((error) => {
        console.error(error);
        dispatch({ hasLoadedEntity: true });
      });
  }, []);

  useEffect(() => {
    getDeveloperOnboardingQuestions()
      .then((onboardingQuestions) => {
        if (onboardingQuestions) {
          const role = onboardingQuestions?.role || "";
          const isOtherRole =
            role.length > 0 &&
            !ROLES.some((r) => r.toLowerCase() === role.toLowerCase());

          const organization = onboardingQuestions?.organization || "";
          const isOtherOrganization =
            organization.length > 0 &&
            !ORGANIZATIONS.some(
              (org) => org.toLowerCase() === organization.toLowerCase(),
            );

          form.reset({
            first: name?.first || "",
            last: name?.last || "",
            primaryUsage: onboardingQuestions?.primaryUsage || "",
            organization: isOtherOrganization ? "Other" : organization,
            organizationName: onboardingQuestions?.organizationName || "",
            otherOrganization: isOtherOrganization ? organization : "",
            role: isOtherRole ? "Other" : role,
            otherRole: isOtherRole ? role : "",
            programmingExperience: onboardingQuestions?.programmingExperience || "",
            dataTypes: onboardingQuestions?.dataTypes || [],
            otherDataType: onboardingQuestions?.otherDataType || "",
          });

          dispatch({
            showOtherRole: isOtherRole,
            showOtherOrganization: isOtherOrganization,
          });
        }
      })
      .catch((error) => {
        console.error(error);
      });
  }, [updateOnboardingData]);

  useEffect(() => {
    if (state.pendingNavigation) {
      setTimeout(() => navigate(state.pendingNavigation));
      dispatch({ pendingNavigation: null });
    }
  }, [state.pendingNavigation, navigate]);

  const handleSubmit = useCallback(
    async (data: OnboardingQuestions) => {
      dispatch({ isLoading: true });
      const toastError = { title: "" };
      try {
        const response = await updateFullName(data.first, data.last);
        if (response === 200) {
          const res = await submitDeveloperOnboardingQuestions({
            primaryUsage: data.primaryUsage,
            organization: data.organization.toLowerCase().includes("other")
              ? data.otherOrganization
              : data.organization,
            organizationName: data.organizationName,
            role: data.role.toLowerCase().includes("other")
              ? data.otherRole
              : data.role,
            programmingExperience: data.programmingExperience,
            dataTypes: data.dataTypes,
            otherDataType: data.otherDataType,
          });
          if (res.success) {
            updateOnboarding(false);
            if (state.hasEntity) {
              // Prepare entity name for URL
              const trimmedEntityName = entityName
                .trim()
                .toLowerCase()
                .replace(/\s+/g, "");
              // If the user has an entity but no dashboards, we create them
              // Since this should be a first time user
              if (Object.keys(state.dashboardsData?.owned || {}).length === 0) {
                const onboardingId = handleTemplatesCreation(
                  featureFlags?.data_bundle_info || null,
                  defaultTicker,
                  addTab,
                  items,
                );

                setTimeout(() => {
                  dispatch({
                    pendingNavigation: `/app/${onboardingId ? onboardingId : "data-connectors"}?welcome=${trimmedEntityName}`,
                  });
                }, 300);
              } else {
                navigate(`/app?welcome=${trimmedEntityName}`);
              }
            } else {
              const result = await setupNewEntity({
                defaultTicker,
                addTab,
                items,
                updateOnlyItems,
              });
              if (result.success) {
                setTimeout(() => {
                  dispatch({
                    pendingNavigation: `/app/${result.onboardingId ? result.onboardingId : "data-connectors"}?welcome=openbbdeveloper`,
                  });
                }, 300);
              } else {
                toastError.title = "Failed to setup your account";
              }
            }
            return;
          }
          toastError.title = "Failed to update your preferences";
          return;
        }

        toastError.title = "Failed to upload your name";
      } catch (error) {
        toastError.title = "Failed to update your preferences";
      } finally {
        if (toastError.title) {
          toast.error(toastError.title, {
            description: "Please try again later.",
          });
        }
        dispatch({ isLoading: false });
      }
    },
    [
      state.hasEntity,
      navigate,
      updateOnboarding,
      featureFlags,
      defaultTicker,
      items,
      updateOnlyItems,
      state.dashboardsData,
      dispatch,
    ],
  );

  const handleSkip = useCallback(
    async (data?: OnboardingQuestions) => {
      dispatch({ isLoading: true });

      const toastError = { title: "" };
      try {
        if (data) {
          const response = await updateFullName(data.first, data.last);
          if (response !== 200) {
            toastError.title = "Failed to upload your name";
            return;
          }
        }

        updateOnboarding(false);
        if (state.hasEntity) {
          // Prepare entity name for URL
          const trimmedEntityName =
            entityName?.trim().toLowerCase().replace(/\s+/g, "") || "";

          // Update the user's onboarding info to skip onboarding
          const res = await submitDeveloperOnboardingQuestions({
            skipOnboarding: true,
          });

          if (!res.success) {
            toastError.title = "Failed to update your preferences";
            return;
          }

          navigate(`/app?welcome=${trimmedEntityName}`);
        } else {
          const result = await setupNewEntity({
            defaultTicker,
            addTab,
            items,
            updateOnlyItems,
          });
          if (result.success) {
            setTimeout(() => {
              dispatch({
                pendingNavigation: `/app/${result.onboardingId ? result.onboardingId : "data-connectors"}?welcome=openbbdeveloper`,
              });
            }, 300);
          } else {
            toastError.title = "Failed to setup your account";
          }
        }
      } catch (error) {
        toastError.title = "Failed to update your preferences";
      } finally {
        if (toastError.title) {
          toast.error(toastError.title, {
            description: "Please try again later.",
          });
        }

        dispatch({ isLoading: false });
      }
    },
    [
      state.hasEntity,
      navigate,
      updateOnboarding,
      entityName,
      defaultTicker,
      addTab,
      items,
      updateOnlyItems,
    ],
  );

  if (!user) {
    return <Navigate to="/login" />;
  }

  return (
    <div className="w-full min-h-screen overflow-y-auto -mt-24 hide-scrollbars">
      <div
        className="container mx-auto px-4 pt-28 md:py-32 pb-32 flex flex-col items-center opacity-0 animate-fade-in-down"
        style={{ animationDelay: "500ms", animationFillMode: "forwards" }}
      >
        <div className="relative max-w-[408px] w-full">
          <div className="absolute left-1/2 -translate-x-1/2 top-[23px] bg-black w-[90.3px] h-[15.25px] rounded-2xl" />
          <div className="absolute left-1/2 -translate-x-1/2 -top-[140px] w-[62.15px] h-[171px] bg-brand-main" />
          <div
            className="rounded-lg bg-white p-6 md:p-8 w-full"
            style={{
              boxShadow: "0px 2px 10px 0px rgba(0, 0, 0, 0.8)",
            }}
          >
            <div className="flex flex-col items-center justify-center mb-6 mt-10">
              <img
                className="max-h-[130px] rounded-none"
                src={getConfig().whiteLabel.loginImage}
                alt="openbb"
              />
              <p className="text-center body-sm-regular text-light-900 max-w-[320px] mx-auto mt-2.5 mb-[28px]">
                Help us personalize your experience.
              </p>
              <img
                src="/assets/images/avatar.webp"
                alt="Avatar"
                className="rounded-full size-[180px]"
                loading="eager"
                onLoad={(e) => {
                  e.currentTarget.style.opacity = "1";
                }}
              />
            </div>

            <Form {...form}>
              <form
                className="force-light"
                onSubmit={form.handleSubmit(
                  uiShowOnboardingQuestionsFF ? handleSubmit : handleSkip,
                )}
                onBlur={(e) => {
                  const target = e.target;
                  if (!target.name) return;
                  form.setValue(
                    target.name as keyof OnboardingQuestions,
                    target.value,
                    {
                      shouldValidate: true,
                    },
                  );
                }}
              >
                <div className="mt-8 grid grid-cols-2 gap-3 mb-3">
                  <FormField
                    name="first"
                    control={form.control}
                    render={({ field }) => (
                      <FormInput
                        label={<span className="text-light-600">First Name</span>}
                        placeholder="Enter your first name"
                        {...field}
                        error={!!form.formState.errors.first}
                        message={form.formState.errors.first?.message}
                      />
                    )}
                  />
                  <FormField
                    name="last"
                    control={form.control}
                    render={({ field }) => (
                      <FormInput
                        label={<span className="text-light-600">Last Name</span>}
                        placeholder="Enter your last name"
                        {...field}
                        error={!!form.formState.errors.last}
                        message={form.formState.errors.last?.message}
                      />
                    )}
                  />
                </div>
                {uiShowOnboardingQuestionsFF && (
                  <OnboardingForm
                    dispatch={dispatch}
                    showOtherOrganization={state.showOtherOrganization}
                    showOtherRole={state.showOtherRole}
                  />
                )}

                <div className="mt-8">
                  <div
                    className="h-[1px]"
                    style={{
                      background:
                        "repeating-linear-gradient(to right, #374151 0, #374151 8px, transparent 8px, transparent 24px)",
                    }}
                  />
                  <div className="flex flex-col items-center justify-center gap-4 mt-8">
                    <Button
                      variant="primary"
                      type="submit"
                      size="md"
                      loading={state.isLoading}
                      className="w-full"
                      disabled={!form.formState.isValid}
                    >
                      Continue
                    </Button>
                    {state.hasEntity && uiShowOnboardingQuestionsFF && (
                      <Button
                        variant="secondary"
                        type="button"
                        size="md"
                        onClick={() => handleSkip()}
                        disabled={state.isLoading}
                        className="w-full"
                      >
                        Skip for now
                      </Button>
                    )}
                  </div>
                </div>
              </form>
            </Form>
          </div>
        </div>
      </div>
    </div>
  );
}

const OnboardingForm = memo(
  (props: {
    dispatch: StateDispatch<State>;
    showOtherOrganization: boolean;
    showOtherRole: boolean;
  }) => {
    const { dispatch, showOtherOrganization, showOtherRole } = props;
    const form = useFormContext<OnboardingQuestions>();
    return (
      <div className="space-y-3">
        <div className="flex gap-3">
          <div className="flex-1">
            <FormField
              name="role"
              control={form.control}
              render={({ field }) => (
                <FormSelect
                  label={<span className="text-light-600">Role</span>}
                  options={ROLES}
                  placeholder="- Select Option -"
                  forceLight={true}
                  {...field}
                  onChange={(value) => {
                    field.onChange(value);
                    const isOther = value.toLowerCase().includes("other");
                    dispatch({ showOtherRole: isOther });
                    if (!isOther) {
                      form.setValue("otherRole", "");
                    }
                  }}
                />
              )}
            />
          </div>
          {showOtherRole && (
            <div className="flex-1">
              <FormField
                name="otherRole"
                control={form.control}
                render={({ field }) => (
                  <FormInput
                    label={<span className="text-light-600">&nbsp;</span>}
                    placeholder="Please specify"
                    {...field}
                    error={!!form.formState.errors.otherRole}
                    message={form.formState.errors.otherRole?.message}
                  />
                )}
              />
            </div>
          )}
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <FormField
              name="organization"
              control={form.control}
              render={({ field }) => (
                <FormSelect
                  label={<span className="text-light-600">Organization Type</span>}
                  className="notranslate"
                  options={ORGANIZATIONS}
                  placeholder="- Select Option -"
                  forceLight={true}
                  {...field}
                  onChange={(value) => {
                    field.onChange(value);
                    const isOther = value.toLowerCase().includes("other");
                    dispatch({ showOtherOrganization: isOther });
                    if (!isOther) {
                      form.setValue("otherOrganization", "");
                    }
                  }}
                />
              )}
            />
          </div>
          {showOtherOrganization && (
            <div className="flex-1">
              <FormField
                name="otherOrganization"
                control={form.control}
                render={({ field }) => (
                  <FormInput
                    label={<span className="text-light-600">&nbsp;</span>}
                    placeholder="Please specify"
                    {...field}
                    error={!!form.formState.errors.otherOrganization}
                    message={form.formState.errors.otherOrganization?.message}
                  />
                )}
              />
            </div>
          )}
        </div>
      </div>
    );
  },
);

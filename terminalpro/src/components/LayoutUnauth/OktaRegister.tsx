import { useOktaAuth } from "@okta/okta-react";
import posthog from "posthog-js";
import { oktaLogin } from "~/api/auth.api";
import { oktaLoginRequest } from "~/lib/okta-auth-config";
import { getErrorMessage } from "~/routes/login";
import type { OAuthRegisterProps } from "~/routes/register";
import { isLoggedIn } from "~/types/auth.type";
import { Button } from "../ds/atoms/Button";
import Icon from "../Icon";

export const OktaRegister = ({
  dispatch,
  state,
  form,
  loginSuccess,
  captureError,
}: OAuthRegisterProps) => {
  const { oktaAuth } = useOktaAuth();

  const handleOktaLogin = async () => {
    dispatch({ oauthLoading: true, formError: "" });
    try {
      const tokenResponse = await oktaAuth.token.getWithPopup(oktaLoginRequest);
      const accessToken = tokenResponse.tokens.accessToken?.accessToken;
      const idToken = tokenResponse.tokens.idToken?.idToken;

      if (!accessToken) {
        throw new Error("Failed to get access token from Okta");
      }
      const newsletter = form.getValues("newsletter");

      const response = await oktaLogin(accessToken, newsletter);

      if (isLoggedIn(response)) {
        window.localStorage.clear();
        window.sessionStorage.clear();
        // we need to save the idToken so we can send later to custom backends
        response.oktaIdToken = idToken;

        localStorage.setItem("lastUsedLoginMethod", "okta");
        return loginSuccess(response)
          .then(dispatch)
          .catch((error) => {
            captureError(error, response.status);
          });
      }

      const cleanDetail = response?.detail;
      dispatch({
        formError: getErrorMessage(response.status, cleanDetail),
        oauthLoading: false,
      });
    } catch (error) {
      console.error(error);
      if (posthog) {
        posthog.capture("okta_login_error", {
          error: error.message,
          stack: error.stack,
        });
      }
      dispatch({
        oauthLoading: false,
        formError: "An unexpected error occurred. Please try again or contact support.",
      });
    }
  };

  const handleOktaClick = () => {
    const agreement = form.getValues("agreement");
    if (!agreement) {
      dispatch({
        formError: "You must agree to the terms and conditions.",
        oauthLoading: false,
      });
      setTimeout(() => {
        dispatch({ formError: "" });
      }, 3000);
      return;
    }
    handleOktaLogin();
  };

  return (
    <Button
      size="sm"
      onClick={handleOktaClick}
      loading={state.oauthLoading}
      disabled={state.oauthLoading}
      className="w-full h-[40px] _add_data_button body-sm-medium bg-[#F2F2F2] dark:bg-[#F2F2F2] hover:bg-[#e3e3e3] dark:hover:bg-[#e3e3e3] focus:bg-[#D9D9D9] dark:focus:bg-[#D9D9D9] text-dark-600 dark:text-dark-600"
      type="button"
    >
      <Icon id="logos-okta-icon" className="h-4 w-4" />
      Sign up with Okta
    </Button>
  );
};

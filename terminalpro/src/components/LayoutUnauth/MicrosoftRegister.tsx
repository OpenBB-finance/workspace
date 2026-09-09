import { useMsal } from "@azure/msal-react";
import { microsoftLogin } from "~/api/auth.api";
import { loginRequest } from "~/lib/microsoft-auth-config";
import { getErrorMessage } from "~/routes/login";
import type { OAuthRegisterProps } from "~/routes/register";
import { isLoggedIn } from "~/types/auth.type";
import { Button } from "../ds/atoms/Button";
import Icon from "../Icon";

export const MicrosoftRegister = ({
  dispatch,
  state,
  form,
  loginSuccess,
  captureError,
}: OAuthRegisterProps) => {
  const { instance } = useMsal();

  const handleMicrosoftLogin = async () => {
    dispatch({ oauthLoading: true, formError: "" });
    try {
      const res = await instance.loginPopup(loginRequest);
      const idToken = res?.idToken;

      const newsletter = form.getValues("newsletter");
      const response = await microsoftLogin(res?.accessToken, newsletter);

      if (isLoggedIn(response)) {
        window.localStorage.clear();
        window.sessionStorage.clear();

        // we need to save the idToken so we can send later to custom backends
        response.microsoftIdToken = idToken;

        // Remember which MSAL account this session belongs to; the silent
        // token refresh relies on it instead of matching the backend email
        instance.setActiveAccount(res.account);

        localStorage.setItem("lastUsedLoginMethod", "microsoft");
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
      dispatch({
        oauthLoading: false,
        formError: "An unexpected error occurred. Please try again or contact support.",
      });
    }
  };

  const handleMicrosoftClick = () => {
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
    handleMicrosoftLogin();
  };

  return (
    <Button
      size="sm"
      onClick={handleMicrosoftClick}
      loading={state.oauthLoading}
      disabled={state.oauthLoading}
      className="w-full h-[40px] _add_data_button body-sm-medium bg-[#F2F2F2] dark:bg-[#F2F2F2] hover:bg-[#e3e3e3] dark:hover:bg-[#e3e3e3] focus:bg-[#D9D9D9] dark:focus:bg-[#D9D9D9] text-dark-600 dark:text-dark-600"
      type="button"
    >
      <Icon id="logos-microsoft-icon" className="h-4 w-4" />
      Sign up with Microsoft
    </Button>
  );
};

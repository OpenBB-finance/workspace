import { useGoogleLogin } from "@react-oauth/google";
import { googleLogin } from "~/api/auth.api";
import Icon from "~/components/Icon";
import { getErrorMessage } from "~/routes/login";
import type { OAuthRegisterProps } from "~/routes/register";
import { isLoggedIn } from "~/types/auth.type";
import { Button } from "../ds/atoms/Button";

export const GoogleRegister = ({
  dispatch,
  state,
  form,
  loginSuccess,
  captureError,
}: OAuthRegisterProps) => {
  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      dispatch({ oauthLoading: true, formError: "" });
      try {
        const token = tokenResponse.access_token;

        const newsletter = form.getValues("newsletter");
        const response = await googleLogin(token, newsletter);

        if (isLoggedIn(response)) {
          window.localStorage.clear();
          window.sessionStorage.clear();
          localStorage.setItem("lastUsedLoginMethod", "google");
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
          formError:
            "An unexpected error occurred. Please try again or contact support.",
        });
      }
    },
    onError: () => {
      const error = "Google sign-in was unsuccessful. Please try again.";
      dispatch({ oauthLoading: false, formError: error });
    },
    onNonOAuthError: (error) => {
      const updatedState = { oauthLoading: false, formError: null };
      if (error.type === "popup_failed_to_open") {
        updatedState.formError = "Failed to open Google sign-in popup";
      }
      dispatch(updatedState);
    },
  });

  const handleGoogleError = () => {
    dispatch({
      formError: "Google sign-in was unsuccessful. Please try again.",
      loading: false,
    });
  };

  const handleGoogleClick = () => {
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
    handleGoogleLogin();
  };

  return (
    <Button
      size="sm"
      onClick={handleGoogleClick}
      loading={state.oauthLoading}
      disabled={state.oauthLoading}
      className="w-full h-[40px] _add_data_button body-sm-medium bg-[#F2F2F2] dark:bg-[#F2F2F2] hover:bg-[#e3e3e3] dark:hover:bg-[#e3e3e3] focus:bg-[#D9D9D9] dark:focus:bg-[#D9D9D9] text-dark-600 dark:text-dark-600"
      type="button"
    >
      <Icon id="google-icon" className="h-4 w-4" />
      Sign up with Google
    </Button>
  );
};

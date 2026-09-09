import { useGoogleLogin } from "@react-oauth/google";
import Icon from "~/components/Icon";
import type { StateDispatch } from "~/hooks/useStateReducer";
import type { LoginState } from "~/routes/login";
import { Button } from "../ds/atoms/Button";

interface GoogleLoginProps {
  dispatch: StateDispatch<LoginState>;
  handleGoogleSuccess: any;
  state: LoginState;
}

export const GoogleLogin = ({
  dispatch,
  handleGoogleSuccess,
  state,
}: GoogleLoginProps) => {
  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      dispatch({ oauthLoading: true, error: null });
      try {
        // handleGoogleSuccess owns the outcome: it dispatches the backend error
        // message itself (403, 402, ...). Only clear the spinner here - writing
        // `error: null` afterwards would erase the message it just set.
        await handleGoogleSuccess({ credential: tokenResponse.access_token });
        dispatch({ oauthLoading: false });
      } catch (error) {
        dispatch({
          oauthLoading: false,
          error: "Google sign-in was unsuccessful. Please try again.",
        });
      }
    },
    onError: () => {
      const error = "Google sign-in was unsuccessful. Please try again.";
      dispatch({ oauthLoading: false, error });
    },
    onNonOAuthError: (error) => {
      const updatedState = { oauthLoading: false, error: null };
      if (error.type === "popup_failed_to_open") {
        updatedState.error = "Failed to open Google sign-in popup";
      }

      dispatch(updatedState);
    },
  });

  return (
    <Button
      size="sm"
      onClick={() => {
        dispatch({ oauthLoading: true });
        googleLogin();
      }}
      disabled={state.oauthLoading}
      loading={state.oauthLoading}
      className="w-full h-[40px] _add_data_button body-sm-medium bg-[#F2F2F2] dark:bg-[#F2F2F2] hover:bg-[#e3e3e3] dark:hover:bg-[#e3e3e3] focus:bg-[#D9D9D9] dark:focus:bg-[#D9D9D9] text-dark-600 dark:text-dark-600"
    >
      <Icon id="google-icon" className="h-4 w-4" />
      Sign in with Google
    </Button>
  );
};

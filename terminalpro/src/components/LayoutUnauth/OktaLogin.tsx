import type { OktaAuth } from "@okta/okta-auth-js";
import { useOktaAuth } from "@okta/okta-react";
import { useState } from "react";
import { Button } from "../ds/atoms/Button";
import Icon from "../Icon";

export default function OktaLogin({
  handleLogin,
}: {
  handleLogin: (oktaAuth: OktaAuth) => Promise<void>;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const { oktaAuth } = useOktaAuth();

  return (
    <Button
      size="sm"
      type="button"
      className="w-full h-[40px] _add_data_button body-sm-medium bg-[#F2F2F2] dark:bg-[#F2F2F2] hover:bg-[#e3e3e3] dark:hover:bg-[#e3e3e3] focus:bg-[#D9D9D9] dark:focus:bg-[#D9D9D9] text-dark-600 dark:text-dark-600"
      onClick={async () => {
        try {
          setIsLoading(true);
          await handleLogin(oktaAuth);
          setIsLoading(false);
        } catch (error) {
          setIsLoading(false);
        }
      }}
      loading={isLoading}
    >
      <Icon id="logos-okta-icon" className="h-4 w-4" />
      Sign in with Okta
    </Button>
  );
}

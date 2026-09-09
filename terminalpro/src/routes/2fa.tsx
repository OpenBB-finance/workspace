import { Button } from "~/components/ds/atoms/Button";

export default function Setup2FA() {
  return (
    <div className="mt-20 flex items-center justify-center">
      <div className="w-min">
        <div className="flex justify-center">
          <img
            src="/assets/images/logo.svg"
            alt="OpenBB"
            className="border-none shadow-none"
          />
        </div>
        <h2 className="mt-12 text-center capitalize subtitle-lg-bold sm:whitespace-nowrap">
          set up two-factor authentication
        </h2>
        <p className="mt-4 body-sm-regular">
          Your company requires two-factor authentication (2FA) to add an extra layer of
          security when signing into your account.
        </p>
        <div className="mt-10 space-y-[10px]">
          <div className="flex flex-row gap-2">
            <img
              src="/assets/logos/google-authenticator.svg"
              alt="Google Authenticator"
              className="border-none shadow-none"
            />
            <span className="body-lg-medium">Google Authenticator</span>
          </div>
          <div className="body-xs-regular">
            You need to install Google Authenticator mobile app on your phone.
          </div>
          <Button className="w-1/2">Set Up</Button>
        </div>
      </div>
    </div>
  );
}

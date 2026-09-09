import Link from "~/taskpane/components/Link";

import Layout from "~/taskpane/components/layout.tsx";

export default function Page() {
  return (
    <Layout>
      <div className="flex flex-col items-center">
        <img className="h-10" src="/assets/logo/horizontal.svg" title="logo" />

        <div className="mt-12 w-full">
          <h1 className="subtitle-md-bold">Sign up</h1>
        </div>

        <div className="mt-6 w-full space-y-3">
          <p>Thanks for your interest in OpenBB!</p>
          <p>
            This add-in is a part of Terminal Pro subscription and can be used
            only by OpenBB Terminal Pro users. You can find more information or
            start the sign up process{" "}
            <Link to="https://my.openbb.co/app/pro">here</Link>.
          </p>
          <p>If you are already a Pro user, please sign in to your account.</p>
          <p>
            <Link to="/auth/login">&lt; Back to login</Link>
          </p>
        </div>
      </div>
    </Layout>
  );
}

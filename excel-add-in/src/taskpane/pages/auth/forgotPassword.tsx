import Link from "~/taskpane/components/Link";

import Layout from "~/taskpane/components/layout.tsx";

export default function Page() {
  return (
    <Layout>
      <div className="flex flex-col items-center">
        <img className="h-10" src="/assets/logo/horizontal.svg" title="logo" />

        <div className="mt-12 w-full">
          <h1 className="subtitle-md-bold">Reset Password</h1>
        </div>

        <div className="mt-6 w-full space-y-3">
          <p>
            Follow this{" "}
            <Link to="https://pro.openbb.co/forgot-password">link</Link> to
            reset your password.
          </p>
          <p>
            <Link to="/auth/login">&lt; Back to login</Link>
          </p>
        </div>
      </div>
    </Layout>
  );
}

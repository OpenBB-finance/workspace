import Link from "~/taskpane/components/Link";

import Layout from "~/taskpane/components/layout.tsx";

export default function PageNotFound() {
  return (
    <Layout>
      <div className="flex flex-col items-center">
        <img className="h-10" src="/assets/logo/horizontal.svg" title="logo" />

        <div className="mt-12 w-full">
          <h1 className="subtitle-md-bold">Page not found</h1>
        </div>

        <div className="mt-6 w-full space-y-3">
          <p>
            <Link to="/">&lt; Back to homepage</Link>
          </p>
        </div>
      </div>
    </Layout>
  );
}

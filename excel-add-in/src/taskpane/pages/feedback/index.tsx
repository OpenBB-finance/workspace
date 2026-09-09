import Feedback from "~/taskpane/components/Feedback";
import Layout from "~/taskpane/components/layout";

export default function Page() {
  // usePrivateRoute(); this causes a bug in Excel where 'Account' taskpane does not login
  // if the user logs in via the 'Feedback' taskpane
  return (
    <Layout bgClasses="!brightness-[0.3]">
      <Feedback />
    </Layout>
  );
}

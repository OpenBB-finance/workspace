import Icon from "~/components/Icon";
import { TOSDialogContent } from "~/components/LayoutAuth/TOSDialog";

export default function TOSPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <Icon id="terminal-pro-icon" className="w-[170px] h-[67px] mb-12 mx-auto" />
      <h1 className="mb-6 text-2xl font-bold">Terms of Service</h1>
      <TOSDialogContent className="h-[60vh] max-h-none" lastElementRef={() => {}} />
    </div>
  );
}

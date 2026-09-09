import { markdown } from "~/../CHANGELOG.md";
import { cn } from "~/lib/utils";
import { BaseDialog, type BaseDialogProps } from "../ds/dialogs/BaseDialog";
import { DialogDescription, DialogTitle } from "../ds/dialogs/Dialog";
import { Changelog, type ChangelogVersionChunk, parseMarkdown } from "./Changelog";
import { ScrollSpy, ScrollspyRoot, ScrollTrigger } from "./ScrollSpy";

const changelogChunks = parseMarkdown(markdown);
const versionChunks = changelogChunks.filter(
  (chunk) => "version" in chunk,
) as ChangelogVersionChunk[];

interface Props extends BaseDialogProps {}

export default function ChangelogDialog(props: Props) {
  return (
    <BaseDialog className="max-h-[80vh] lg:max-w-3xl xl:max-w-5xl" {...props}>
      <DialogTitle>Changelog</DialogTitle>
      <DialogDescription className="sr-only">
        View the changelog for the OpenBB Workspace.
      </DialogDescription>
      <div className="flex-1 flex h-full min-h-0 dark:bg-dark-750">
        <ScrollspyRoot>
          <div className="overflow-auto min-w-[120px] max-w-[200px] dark:bg-dark-800 bg-light-100 p-2.5">
            {versionChunks.map(({ version, slug }) => (
              <ScrollTrigger
                key={slug + version}
                id={slug}
                className={cn([
                  "w-full text-left body-xs-medium p-2.5 transition",
                  "rounded",
                  "data-scrollspy-active:bg-light-300 dark:data-scrollspy-active:bg-dark-600",
                ])}
              >
                {version.split("-")[0]}
              </ScrollTrigger>
            ))}
          </div>
          <div
            className="overflow-auto px-2.5 bg-light-50 dark:bg-dark-750"
            data-testid="changelog-content"
          >
            <ScrollSpy>
              <Changelog chunks={changelogChunks} />
            </ScrollSpy>
          </div>
        </ScrollspyRoot>
      </div>
    </BaseDialog>
  );
}

import { memo } from "react";
import type { Mention } from "~/lib/state/copilot";

type TextCompletionProps = {
  renderedPrompt?: string;
  completion: string;
  processMentions: (text: string) => { result: string; mentions: Mention[] };
};

function TextCompletion(props: TextCompletionProps) {
  const { renderedPrompt, processMentions, completion } = props;
  const { result: renderedCompletion } = processMentions(completion);
  if (!renderedPrompt) return null;
  const promptLines = renderedPrompt.split("\n");
  return (
    <div className="absolute items-center inset-0 overflow-hidden bg-transparent opacity-55 pointer-events-none whitespace-pre-wrap break-words">
      {renderedCompletion.split("\n").map((line, index) => {
        const promptLine = promptLines[index] || "";
        const before = line.slice(0, promptLine.length);
        const after = line.slice(promptLine.length);
        return (
          <div key={index} className="">
            <span className="text-transparent">{before}</span>
            <span className="opacity-55">{after}</span>
            {index < renderedCompletion.split("\n").length - 1 && <br />}
          </div>
        );
      })}
    </div>
  );
}

export default memo(TextCompletion);

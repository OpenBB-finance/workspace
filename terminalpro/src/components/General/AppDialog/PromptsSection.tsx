import {
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { type UseFormReturn, useFieldArray, useWatch } from "react-hook-form";
import { Button } from "~/components/ds/atoms/Button";
import Icon from "../../Icon";
import type { AppMetadataForm } from "./schema";

const MAX_PROMPTS = 5;

type PromptsSectionProps = {
  form: UseFormReturn<AppMetadataForm>;
};

export function PromptsSection({ form }: PromptsSectionProps) {
  const { append, remove } = useFieldArray<AppMetadataForm>({
    control: form.control,
    name: "prompts",
  });

  const watchedPrompts =
    useWatch({
      control: form.control,
      name: "prompts",
    }) ?? [];

  const [isInputOpen, setIsInputOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const count = watchedPrompts.length;
  const isMax = count >= MAX_PROMPTS;
  const canOpenInput = !isMax && !isInputOpen;
  const showEmptyZone = count === 0 && !isInputOpen;

  useEffect(() => {
    if (isInputOpen) {
      inputRef.current?.focus();
    }
  }, [isInputOpen]);

  const autoResize = useCallback((el: HTMLTextAreaElement | null) => {
    if (!el) return;
    const MAX_HEIGHT = 160;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
  }, []);

  const handleOpenInput = useCallback(() => {
    if (isMax || isInputOpen) return;
    setIsInputOpen(true);
  }, [isMax, isInputOpen]);

  const handleConfirm = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    append({ value: trimmed });
    setInputValue("");
    setIsInputOpen(false);
  }, [inputValue, append]);

  const handleCancel = useCallback(() => {
    setInputValue("");
    setIsInputOpen(false);
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        handleConfirm();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        handleCancel();
      }
    },
    [handleConfirm, handleCancel],
  );

  return (
    <div
      className="flex flex-col flex-1 min-h-0
        bg-general-bg-primary rounded border border-general-border-primary overflow-hidden"
    >
      <div className="flex items-center gap-2.5 p-2.5 bg-general-bg-primary-hover shrink-0">
        <h3 className="flex-1 body-xs-medium text-general-label-hover select-none">
          Prompts
          <span className="font-normal text-ds-text-body">
            {" "}
            — Suggestions that show up on the Copilot when using the app{" "}
          </span>
          <span className="text-ds-text-caption italic font-normal">(optional)</span>
        </h3>
        <div className="flex items-center gap-3">
          {count > 0 && (
            <span
              className="body-xs-regular text-ds-text-caption tabular-nums"
              aria-live="polite"
              data-testid="_prompts-counter"
            >
              {count} / {MAX_PROMPTS}
            </span>
          )}
          <Button
            type="button"
            variant="outlined"
            size="xs"
            onClick={handleOpenInput}
            disabled={!canOpenInput}
            data-testid="_prompts-new-button"
          >
            <Icon id="plus-icon" className="size-3.5 mr-1" />
            New prompt
          </Button>
        </div>
      </div>
      <div className="flex flex-col gap-2 flex-1 min-h-0 overflow-y-auto p-4">
        {watchedPrompts.map((prompt, index) => (
          <PromptChip
            key={index}
            value={prompt?.value ?? ""}
            ariaIndex={index + 1}
            onRemove={() => remove(index)}
          />
        ))}

        {isInputOpen && (
          <div className="flex items-end gap-2" data-testid="_prompts-input-row">
            <textarea
              ref={(el) => {
                inputRef.current = el;
                autoResize(el);
              }}
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              onInput={(event: FormEvent<HTMLTextAreaElement>) =>
                autoResize(event.currentTarget)
              }
              onKeyDown={handleKeyDown}
              placeholder="Insert prompt suggestion (Shift+Enter for newline)"
              rows={1}
              maxLength={2000}
              data-testid="_prompts-input"
              className="flex-1 min-h-8 max-h-40 resize-none overflow-y-auto
                px-3 py-1.5 rounded-sm body-xs-regular leading-[1.5]
                bg-general-bg-primary border border-general-border-primary
                text-ds-text-heading placeholder:text-ds-text-caption
                transition-[border-color,box-shadow]
                focus:outline-none focus:border-link-color
                focus:shadow-[0_0_0_2px_rgba(59,130,246,0.12)]"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleConfirm}
              data-testid="_prompts-confirm"
            >
              Add
            </Button>
            <Button
              type="button"
              variant="outlined"
              size="sm"
              onClick={handleCancel}
              data-testid="_prompts-cancel"
            >
              Cancel
            </Button>
          </div>
        )}

        {showEmptyZone && (
          <div
            aria-hidden="true"
            className="flex flex-1 w-full items-center justify-center gap-1.5
              rounded-md border-[1.5px] border-dashed border-general-border-secondary
              bg-general-bg-primary body-xs-regular text-ds-text-caption select-none"
          >
            <Icon id="plus-icon" className="size-3.5" />
            Add a prompt suggestion
          </div>
        )}
      </div>
    </div>
  );
}

type PromptChipProps = {
  value: string;
  ariaIndex: number;
  onRemove: () => void;
};

function PromptChip({ value, ariaIndex, onRemove }: PromptChipProps) {
  return (
    <div
      className="group/chip relative flex items-start gap-2 rounded-md
        bg-general-bg-primary border border-general-border-secondary
        pl-3 pr-2.5 py-[9px]"
      data-testid="_prompt-chip"
    >
      <p
        className="flex-1 body-xs-regular leading-[1.6] text-ds-text-body
          break-words whitespace-pre-wrap"
      >
        {value}
      </p>
      <button
        type="button"
        aria-label={`Remove prompt ${ariaIndex}`}
        onClick={onRemove}
        className="shrink-0 inline-flex items-center justify-center size-5 rounded-sm
          text-ds-text-caption opacity-40 transition-[color,opacity] duration-150
          group-hover/chip:opacity-100
          hover:!text-alert-error hover:!opacity-100
          focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1
          focus-visible:ring-general-border-primary"
        data-testid="_prompt-chip-remove"
      >
        <Icon id="cross-icon" className="size-3.5" />
      </button>
    </div>
  );
}

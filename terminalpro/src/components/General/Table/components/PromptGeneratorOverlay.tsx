import {
  memo,
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { Button } from "~/components/ds/atoms/Button";
import Icon from "~/components/Icon";
import Tooltip from "~/components/Tooltip";
import { useWidgetContext } from "~/components/Widget.context";
import { useShallowBackendConnectorStore } from "~/lib/state/backendConnector";
import { useCodeGeneration } from "../hooks/useCodeGeneration";
import { AgGridContext } from "../hooks/useTableContext";

const ALL_SCHEMAS_NAME = "ALL_DATABASES_ALL_SCHEMAS_ALL_TABLES";

export interface PromptGeneratorOverlayProps {
  language: "sql" | "python" | string;
  visible: boolean;
  onClose: () => void;
  onCodeGenerated: (code: string) => void;
  /** When set, the overlay will auto-populate and submit this prompt on mount. */
  initialPrompt?: string | null;
  /** Called after the initial prompt has been consumed (submitted). */
  onInitialPromptConsumed?: () => void;
}

export const PromptGeneratorOverlay = memo<PromptGeneratorOverlayProps>(
  ({
    language,
    visible,
    onClose,
    onCodeGenerated,
    initialPrompt,
    onInitialPromptConsumed,
  }) => {
    const widget = useWidgetContext().widget;
    // Check both 'query' (SQL) and 'prompt' (Python) param names
    const currentCode =
      widget.storage?.params?.query || widget.storage?.params?.prompt || "";
    const generationLanguage =
      language === "python" || language === "text" ? language : "sql";
    const contentLabel =
      generationLanguage === "text"
        ? "text content"
        : generationLanguage === "python"
          ? "Python code"
          : "SQL query";
    const { backendSchemas, semanticViews } = useShallowBackendConnectorStore(
      (state) => {
        const source = state.getApiSourceById(widget.sourceId || "");
        return {
          backendSchemas: source?.schemas,
          semanticViews: source?.semanticViews || state.semanticViews,
        };
      },
    );

    // Try to access grid context for column definitions (may be null if not in a table context)
    const agGridContext = useContext(AgGridContext);

    const sqlSchema = useMemo(() => {
      if (generationLanguage !== "sql" || !backendSchemas) return;

      const schemaName = widget.schemaName;
      if (schemaName === ALL_SCHEMAS_NAME) return backendSchemas;

      return backendSchemas[schemaName];
    }, [generationLanguage, widget.schemaName, backendSchemas]);

    const semanticModels = useMemo(() => {
      if (generationLanguage !== "sql") return [];
      return Object.values(semanticViews || {})
        .map((view) => view.fqn)
        .filter(Boolean)
        .map((semantic_view) => ({ semantic_view }));
    }, [generationLanguage, semanticViews]);

    const dataSample = useMemo(() => {
      if (generationLanguage !== "sql") return null;

      // Try grid context first (most reliable source for row data)
      const gridRowData = agGridContext?.gridState?.rowData;
      if (gridRowData?.length) {
        // Take first 5 rows as sample
        return gridRowData.slice(0, 5) as Record<string, unknown>[];
      }

      // Fall back to widget storage if available
      const storageRowData = widget.storage?.rowData as
        | Record<string, unknown>[]
        | undefined;
      if (storageRowData?.length) {
        return storageRowData.slice(0, 5);
      }

      return null;
    }, [
      generationLanguage,
      agGridContext?.gridState?.rowData,
      widget.storage?.rowData,
    ]);

    const [promptInput, setPromptInput] = useState("");
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const { mutate: generateCode, isPending: isGenerating } = useCodeGeneration();

    // Auto-focus input when becoming visible
    useEffect(() => {
      if (visible) {
        inputRef.current?.focus();
      }
    }, [visible]);

    // Handle escape key to close (only when visible)
    useEffect(() => {
      if (!visible) return;
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          onClose();
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onClose, visible]);

    // Auto-submit when an initial prompt is provided (e.g. "Fix error with AI")
    useEffect(() => {
      if (visible && initialPrompt) {
        setPromptInput(initialPrompt);
        handleGenerate(initialPrompt);
        onInitialPromptConsumed?.();
      }
    }, [visible, initialPrompt]);

    const handleClear = useCallback(() => {
      setPromptInput("");
      inputRef.current?.focus();
    }, []);

    const handleGenerate = useCallback(
      (overridePrompt?: string) => {
        const prompt = overridePrompt ?? promptInput;
        if (!prompt.trim()) {
          toast.warning("Please enter a prompt");
          return;
        }

        // Build a more descriptive prompt that includes the current code context
        const contextualPrompt = currentCode?.trim()
          ? `Current ${contentLabel}:\n\`\`\`${generationLanguage}\n${currentCode}\n\`\`\`\n\nUser request: ${prompt}`
          : prompt;

        generateCode(
          {
            widget_uuid: widget.id,
            user_prompt: contextualPrompt,
            current_code: currentCode || null,
            language: generationLanguage,
            sql_schema: sqlSchema || null,
            data_sample: dataSample,
            semantic_models: semanticModels.length ? semanticModels : null,
          },
          {
            onSuccess: (response) => {
              if (response.generated_code) {
                // Strip a single wrapping markdown code block if present.
                const cleanCode = response.generated_code
                  .replace(/^```[\w+-]*\n?/i, "")
                  .replace(/\n?```$/i, "")
                  .trim();
                onCodeGenerated(cleanCode);
                setPromptInput("");
              } else {
                toast.error("Failed to generate code", {
                  description: "No code was generated",
                  duration: 8000,
                });
              }
            },
            onError: (error) => {
              toast.error("Failed to generate code", {
                description: error.message,
                duration: 8000,
              });
            },
          },
        );
      },
      [
        promptInput,
        widget.id,
        currentCode,
        generationLanguage,
        contentLabel,
        sqlSchema,
        dataSample,
        semanticModels,
        generateCode,
        onCodeGenerated,
      ],
    );

    const handleKeyDown = useCallback(
      (e: ReactKeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          handleGenerate();
        }
      },
      [handleGenerate],
    );

    if (!visible) return null;

    return (
      <div className="rounded border border-general-border-primary mb-2 flex items-center gap-2 px-2 py-2 pr-2.5">
        <textarea
          ref={inputRef}
          value={promptInput}
          onChange={(e) => setPromptInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            currentCode?.trim()
              ? `Describe how to modify the current ${contentLabel}...`
              : `Describe the ${contentLabel} you want...`
          }
          className="body-xs-regular min-h-[32px] max-h-[80px] flex-1 resize-none border-0 bg-transparent px-2 py-1.5 placeholder:text-ds-text-caption focus:outline-none"
          rows={1}
          disabled={isGenerating}
        />
        <div className="flex items-center gap-1 flex-shrink-0">
          {promptInput.trim() && (
            <Tooltip message="Clear">
              <button
                type="button"
                className="obb-small-navbar-btn flex items-center justify-center"
                onClick={handleClear}
                disabled={isGenerating}
              >
                <Icon id="cross-icon" />
              </button>
            </Tooltip>
          )}
          <Button
            variant="primary"
            size="xs"
            icon
            onClick={() => handleGenerate()}
            disabled={!promptInput.trim()}
            loading={isGenerating}
            loadingChildren={null}
          >
            <Icon id="send" />
          </Button>
        </div>
      </div>
    );
  },
);

PromptGeneratorOverlay.displayName = "PromptGeneratorOverlay";

type GenerateCodeFooterProps = {
  generatedCode: string | null;
  onApply: () => void;
  onCancel: () => void;
};

export const GenerateCodeFooter = memo((props: GenerateCodeFooterProps) => {
  if (!props.generatedCode) return null;
  const { generatedCode, onApply, onCancel } = props;

  return (
    <>
      <div className="flex items-center gap-1">
        <Tooltip message="Copy generated code">
          <button
            className="obb-small-navbar-btn"
            onClick={() => {
              navigator.clipboard
                .writeText(generatedCode!)
                .then(() => toast.success("Code copied to clipboard"))
                .catch((err) =>
                  toast.error("Failed to copy", { description: err.message }),
                );
            }}
          >
            <Icon id="clipboard-icon" className="size-3.5" />
          </button>
        </Tooltip>
      </div>
      <div className="flex items-center gap-2">
        <button
          className="px-2 py-0.5 text-xs font-medium rounded transition-colors
            bg-light-200 dark:bg-dark-500 hover:bg-light-300 dark:hover:bg-dark-400"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          className="px-2 py-0.5 text-xs font-medium rounded transition-colors
            bg-brand-main text-white hover:bg-brand-main/85"
          onClick={onApply}
        >
          Apply
        </button>
      </div>
    </>
  );
});

GenerateCodeFooter.displayName = "GenerateCodeFooter";

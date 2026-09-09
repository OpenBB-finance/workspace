import Editor, { type Monaco } from "@monaco-editor/react";
import { useCallback } from "react";
import { useWidgetConfigContext } from "./WidgetConfigContext";
import widgetSchema from "./widget-schema.json";

export default function JSONConfiguration() {
  const { jsonValue, dispatch, updateConfigFromJson } = useWidgetConfigContext((s) => ({
    jsonValue: s.formState.jsonValue,
    dispatch: s.dispatchFormState,
    updateConfigFromJson: s.updateConfigFromJson,
  }));

  // Configure JSON schema before Monaco editor mounts
  const handleBeforeMount = useCallback((monaco: Monaco) => {
    // Configure Monaco's JSON language service with the widget schema
    monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
      validate: true,
      allowComments: false,
      schemas: [
        {
          uri: "http://terminalpro.io/schemas/widget-schema.json", // Unique URI for the schema
          fileMatch: ["*"], // Apply to all JSON files in this editor
          schema: widgetSchema,
        },
      ],
    });
  }, []);

  return (
    <div className="p-6 pt-0">
      <div className="flex flex-col gap-4 mb-4">
        <p className="text-sm text-light-600 dark:text-dark-50">
          Edit the widget configuration directly in JSON format. Changes made here will
          automatically update the UI configuration and preview. Schema validation and
          autocompletion are enabled.
        </p>

        {/* {jsonError && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
            <div className="flex items-start gap-2">
              <Icon
                id="warning-icon"
                className="size-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0"
              />
              <p className="text-sm text-red-600 dark:text-red-400">
                JSON Error: {jsonError}
              </p>
            </div>
          </div>
        )} */}

        <label className="text-sm font-medium text-light-700 dark:text-dark-100">
          Widget Configuration JSON
        </label>
      </div>

      <div className="border border-light-300 dark:border-dark-400 rounded-md h-96">
        <Editor
          height="100%"
          defaultLanguage="json"
          value={jsonValue}
          beforeMount={handleBeforeMount}
          onChange={(jsonValue) => {
            if (jsonValue !== undefined) {
              dispatch({ jsonValue });
              updateConfigFromJson(jsonValue);
            }
          }}
          options={{
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 14,
            wordWrap: "on",
            formatOnPaste: true,
            formatOnType: true,
            automaticLayout: true,
            tabSize: 2,
            insertSpaces: true,
            // Enhanced JSON editing options
            quickSuggestions: {
              other: true,
              comments: false,
              strings: true,
            },
            suggestOnTriggerCharacters: true,
            acceptSuggestionOnCommitCharacter: true,
            acceptSuggestionOnEnter: "on",
            tabCompletion: "on",
          }}
          theme="vs-dark"
        />
      </div>
    </div>
  );
}

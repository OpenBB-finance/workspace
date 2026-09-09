import { useCallback, useState } from "react";
import { fetchAgentsData } from "~/api/auth.api";
import type { AgentManagementState } from "~/components/AI/hooks/useAgentManagement";
import { Button } from "~/components/ds/atoms/Button";
import { Input } from "~/components/ds/atoms/Input";
import { BaseDialog } from "~/components/ds/dialogs/BaseDialog";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ds/dialogs/Dialog";
import { ConnectionTestResult } from "~/components/ds/molecules/ConnectionTestResult";
import Icon from "~/components/Icon";

export function AgentEditDialog({
  editGroup,
  onClose,
  onSave,
}: {
  editGroup: {
    uuid: string;
    url: string;
    headerPairs: { key: string; value: string }[];
  };
  onClose: () => void;
  onSave: (editGroup: AgentManagementState["editGroup"]) => Promise<void>;
}) {
  const [localEditGroup, setLocalEditGroup] = useState(editGroup);
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    agentCount?: number;
  } | null>(null);

  const handleTest = useCallback(async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const headers: Record<string, string> = {};
      for (const pair of localEditGroup.headerPairs) {
        if (pair.key && pair.value) {
          headers[pair.key] = pair.value;
        }
      }
      const agents = await fetchAgentsData({
        url: localEditGroup.url,
        headers,
      });
      setTestResult({
        success: true,
        message: `${agents.length} agent${agents.length !== 1 ? "s" : ""} found`,
        agentCount: agents.length,
      });
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : "Failed to connect",
      });
    } finally {
      setIsTesting(false);
    }
  }, [localEditGroup]);

  const handleSave = useCallback(async () => {
    setIsLoading(true);
    try {
      await onSave(localEditGroup);
    } finally {
      setIsLoading(false);
    }
  }, [localEditGroup, onSave]);

  const isUrlValid = localEditGroup.url.trim().length > 0;

  return (
    <BaseDialog open={true} onClose={onClose} className="w-[580px] max-w-[580px]">
      <DialogHeader>
        <DialogTitle>Edit agent</DialogTitle>
        <DialogDescription>
          Configure URL and authentication headers for this agent.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div>
          <label className="text-xs text-ds-text-caption mb-1 block">
            Endpoint URL
          </label>
          <Input
            size="sm"
            placeholder="https://example.com/agents.json"
            value={localEditGroup.url}
            onChange={(newUrl: string) => {
              setLocalEditGroup((prev) => ({ ...prev, url: newUrl }));
              setTestResult(null);
            }}
          />
        </div>

        {localEditGroup.headerPairs.length > 0 && (
          <div className="space-y-3">
            {localEditGroup.headerPairs.map((pair, index) => (
              <div key={`header-${index}`} className="flex gap-2 items-start">
                <div className="flex-1">
                  <label className="text-xs text-ds-text-caption mb-1 block">Key</label>
                  <Input
                    size="sm"
                    placeholder="Authorization"
                    defaultValue={pair.key}
                    onChange={(newKey: string) => {
                      setLocalEditGroup((prev) => {
                        const newPairs = [...prev.headerPairs];
                        newPairs[index] = { ...newPairs[index], key: newKey };
                        return { ...prev, headerPairs: newPairs };
                      });
                      setTestResult(null);
                    }}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-ds-text-caption mb-1 block">
                    Value
                  </label>
                  <Input
                    size="sm"
                    placeholder="Bearer token..."
                    defaultValue={pair.value}
                    onChange={(newValue: string) => {
                      setLocalEditGroup((prev) => {
                        const newPairs = [...prev.headerPairs];
                        newPairs[index] = { ...newPairs[index], value: newValue };
                        return { ...prev, headerPairs: newPairs };
                      });
                      setTestResult(null);
                    }}
                  />
                </div>
                <button
                  onClick={() => {
                    setLocalEditGroup((prev) => ({
                      ...prev,
                      headerPairs: prev.headerPairs.filter((_, i) => i !== index),
                    }));
                    setTestResult(null);
                  }}
                  className="mt-6 p-1"
                >
                  <Icon
                    id="circled-cross-icon"
                    className="h-4 w-4 text-light-600 dark:text-light-300"
                  />
                </button>
              </div>
            ))}
          </div>
        )}

        {testResult && (
          <ConnectionTestResult
            status={testResult.success ? "success" : "error"}
            message={testResult.message}
          />
        )}
      </div>
      <DialogFooter className="flex justify-between">
        <Button
          variant="outlined"
          size="sm"
          onClick={() =>
            setLocalEditGroup((prev) => ({
              ...prev,
              headerPairs: [...prev.headerPairs, { key: "", value: "" }],
            }))
          }
        >
          <Icon id="plus-icon" className="h-4 w-4 mr-1" />
          Add Authentication
        </Button>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleTest}
            disabled={!isUrlValid || isTesting}
            loading={isTesting}
          >
            Test
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!isUrlValid || isLoading || !testResult?.success}
            loading={isLoading}
          >
            Update
          </Button>
        </div>
      </DialogFooter>
    </BaseDialog>
  );
}

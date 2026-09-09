import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import TextArea from "~/components/AI/TextArea";
import { Button } from "~/components/ds/atoms/Button";
import { BaseDialog } from "~/components/ds/dialogs/BaseDialog";
import { DialogFooter, DialogTitle } from "~/components/ds/dialogs/Dialog";
import { Form, FormField } from "~/components/ds/molecules/Form";
import { CopilotProvider } from "~/lib/contexts/CopilotChatContext";
import { useShallowPromptLibraryStore } from "~/lib/state/promptLibrary";

const promptSchema = z.object({
  prompt: z.string().min(1, "Prompt is required"),
  widgets: z.array(z.string()).optional(),
});

type PromptFormData = z.infer<typeof promptSchema>;

export default function AddPromptDialog() {
  const {
    addPromptDialogOpen,
    setAddPromptDialogOpen,
    addPrompt,
    editingPromptId,
    updatePrompt,
    setEditingPromptId,
    getPromptById,
  } = useShallowPromptLibraryStore((state) => ({
    addPromptDialogOpen: state.addPromptDialogOpen,
    setAddPromptDialogOpen: state.setAddPromptDialogOpen,
    addPrompt: state.addPrompt,
    editingPromptId: state.editingPromptId,
    setEditingPromptId: state.setEditingPromptId,
    updatePrompt: state.updatePrompt,
    getPromptById: state.getPromptById,
  }));

  const prompt = editingPromptId ? getPromptById(editingPromptId) : null;
  const [completion, setCompletion] = useState("");

  const form = useForm<PromptFormData>({
    resolver: zodResolver(promptSchema),
    defaultValues: {
      prompt: prompt?.prompt || "",
      widgets: prompt?.widgets || [],
    },
  });

  useEffect(() => {
    if (!addPromptDialogOpen) return;
    form.reset({
      prompt: prompt?.prompt || "",
      widgets: prompt?.widgets || [],
    });
  }, [addPromptDialogOpen, prompt]);

  const onSubmit = (data: PromptFormData) => {
    if (editingPromptId) {
      updatePrompt(editingPromptId, {
        prompt: data.prompt,
        widgets: data.widgets,
      });
      toast.success("Prompt updated successfully");
    } else {
      addPrompt({
        prompt: data.prompt,
        widgets: data.widgets,
      });
      toast.success("Prompt added successfully");
    }
    onClose();
  };

  const onClose = () => {
    form.reset();
    setAddPromptDialogOpen(false);
    setEditingPromptId(null);
  };

  return (
    <BaseDialog
      open={addPromptDialogOpen}
      onClose={onClose}
      className="dark:bg-dark-900 overflow-visible"
    >
      <DialogTitle>{editingPromptId ? "Edit prompt" : "Add new prompt"}</DialogTitle>

      {addPromptDialogOpen && (
        <CopilotProvider>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <div className="flex flex-col gap-4">
                <FormField
                  name="prompt"
                  control={form.control}
                  render={({ field }) => (
                    <div className="relative">
                      <p className="text-light-400 dark:text-dark-100 mb-2">Prompt</p>
                      <div className="p-2 rounded border border-light-200 dark:border-dark-400">
                        <TextArea
                          type="promptDialog"
                          prompt={field.value}
                          setPrompt={(prompt) => field.onChange(prompt)}
                          handleSubmit={(prompt) => onSubmit({ prompt })}
                          completion={completion}
                          setCompletion={setCompletion}
                          openSuggestionsDown={true}
                          extraClassName="min-h-[80px]"
                          placeholder={`Enter prompt — e.g., "Summarize Walmart's management guidance in a table format."`}
                        />
                      </div>
                    </div>
                  )}
                />
              </div>
            </form>
          </Form>
        </CopilotProvider>
      )}

      <DialogFooter className="flex justify-end gap-3">
        <Button size="sm" variant="outlined" onClick={onClose}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={() => {
            setCompletion("");
            form.handleSubmit(onSubmit)();
          }}
        >
          {editingPromptId ? "Update" : "Add Prompt"}
        </Button>
      </DialogFooter>
    </BaseDialog>
  );
}

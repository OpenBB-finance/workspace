import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { createUserSkill, updateUserSkill } from "~/api/auth.api";
import { Button } from "~/components/ds/atoms/Button";
import { FormInput } from "~/components/ds/atoms/Input";
import { FormTextarea } from "~/components/ds/atoms/TextArea";
import { BaseDialog } from "~/components/ds/dialogs/BaseDialog";
import { DialogFooter, DialogTitle } from "~/components/ds/dialogs/Dialog";
import { Form, FormField } from "~/components/ds/molecules/Form";
import { type Skill, useShallowSkillsLibraryStore } from "~/lib/state/skillsLibrary";

const skillSchema = z.object({
  slug: z
    .string()
    .min(2, "Slug must be at least 2 characters")
    .max(50, "Slug must be at most 50 characters")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug must be lowercase letters, numbers, and hyphens only (no leading/trailing hyphens)",
    ),
  description: z
    .string()
    .min(1, "Description is required")
    .max(500, "Description must be at most 500 characters"),
  content: z.string().min(1, "Content is required"),
});

type SkillFormData = z.infer<typeof skillSchema>;

const SKILL_CONTENT_PLACEHOLDER = `# Financial Analysis Skill

When analyzing financial data, follow these steps:

1. **Identify key metrics**: Look for revenue, profit margins, debt ratios
2. **Compare trends**: Year-over-year and quarter-over-quarter
3. **Provide context**: Industry benchmarks and market conditions

## Output Format
- Use tables for numerical comparisons
- Highlight significant changes (>10%)
- Include a summary with key takeaways`;

export default function AddSkillDialog() {
  const {
    skillDialogOpen,
    skill,
    skillDialogPrefill,
    closeSkillDialog,
    isSlugUnique,
    updateSkills,
  } = useShallowSkillsLibraryStore((s) => ({
    skillDialogOpen: s.skillDialogOpen,
    skill:
      typeof s.skillDialogOpen === "string" ? s.getSkillById(s.skillDialogOpen) : null,
    skillDialogPrefill: s.skillDialogPrefill,
    closeSkillDialog: s.closeSkillDialog,
    isSlugUnique: s.isSlugUnique,
    updateSkills: s.updateSkills,
  }));

  const form = useForm<SkillFormData>({
    resolver: zodResolver(skillSchema),
    mode: "onSubmit",
    defaultValues: {
      slug: skill?.slug || skillDialogPrefill?.slug || "",
      description: skill?.description || skillDialogPrefill?.description || "",
      content: skill?.content || skillDialogPrefill?.content || "",
    },
  });

  useEffect(() => {
    if (!skillDialogOpen) return;
    form.reset({
      slug: skill?.slug || skillDialogPrefill?.slug || "",
      description: skill?.description || skillDialogPrefill?.description || "",
      content: skill?.content || skillDialogPrefill?.content || "",
    });
  }, [skillDialogOpen, skill, skillDialogPrefill]);

  const onClose = useCallback(() => {
    form.reset();
    closeSkillDialog();
  }, [form.reset, closeSkillDialog]);

  const onSubmit = useCallback(
    async (data: SkillFormData) => {
      // Validate slug uniqueness
      if (!isSlugUnique(data.slug, skill?.id ?? undefined)) {
        form.setError("slug", {
          type: "manual",
          message: "This slug is already in use. Please choose a different one.",
        });
        return;
      }

      const updatedSkill = {
        slug: data.slug,
        description: data.description,
        content: data.content,
      };

      let updatedSkills: Skill[] | null = null;
      if (skill) {
        updatedSkills = await updateUserSkill(skill.id, updatedSkill);
      } else {
        updatedSkills = await createUserSkill(updatedSkill);
      }

      if (!updatedSkills)
        return toast.error(`Failed to ${skill ? "update" : "create"} skill`);

      updateSkills(updatedSkills);
      toast.success(`Skill ${skill ? "updated" : "created"} successfully`);
      onClose();
    },
    [skill, isSlugUnique, form.setError, updateSkills, onClose],
  );

  const handleSlugChange = useCallback(
    (value: string) => {
      // Allow hyphens while sanitizing other invalid characters
      const sanitized = value
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-") // Replace invalid chars with hyphen
        .replace(/-+/g, "-") // Collapse multiple hyphens
        .replace(/^-/, "") // Remove leading hyphen
        .slice(0, 50);
      form.clearErrors("slug");
      form.setValue("slug", sanitized, { shouldDirty: true });
    },
    [form.clearErrors, form.setValue],
  );

  return (
    <BaseDialog
      open={Boolean(skillDialogOpen)}
      onClose={onClose}
      className="bg-general-bg-primary max-w-4xl sm:max-w-4xl"
    >
      <DialogTitle>{skill ? "Edit skill" : "Add new skill"}</DialogTitle>

      {skillDialogOpen && (
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="min-h-0 overflow-y-auto"
          >
            <div className="flex flex-col gap-4">
              <FormField
                name="slug"
                control={form.control}
                render={({ field }) => (
                  <FormInput
                    {...field}
                    onChange={handleSlugChange}
                    label="Slug"
                    placeholder="my-skill-name"
                    className="font-mono"
                  />
                )}
              />

              <FormField
                name="description"
                control={form.control}
                render={({ field }) => (
                  <FormTextarea
                    {...field}
                    label="Description"
                    placeholder="Analyzes financial statements and provides insights"
                    maxLength={500}
                    message={
                      <span className="text-ds-text-caption text-right block">
                        {field.value?.length || 0}/500
                      </span>
                    }
                    className="min-h-[80px] text-sm"
                  />
                )}
              />

              <FormField
                name="content"
                control={form.control}
                render={({ field }) => (
                  <FormTextarea
                    {...field}
                    label="Content"
                    placeholder={SKILL_CONTENT_PLACEHOLDER}
                    autoheight={false}
                    className="h-[400px] overflow-hidden
                    [&_textarea]:h-full [&_textarea]:min-h-0 [&_textarea]:overflow-y-auto
                    [&_textarea]:overflow-x-hidden [&_textarea]:whitespace-pre-wrap
                    [&_textarea]:[overflow-wrap:anywhere] [&_textarea]:font-mono [&_textarea]:text-sm"
                  />
                )}
              />
            </div>
          </form>
        </Form>
      )}

      <DialogFooter className="flex justify-end gap-3">
        <Button size="sm" variant="outlined" onClick={onClose}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={form.handleSubmit(onSubmit)}
          disabled={form.formState.isSubmitting}
          loading={form.formState.isSubmitting}
        >
          {skill ? "Update" : "Add Skill"}
        </Button>
      </DialogFooter>
    </BaseDialog>
  );
}

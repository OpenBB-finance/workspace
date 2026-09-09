import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { apiClient } from "~/api/api";
import { Button } from "~/components/ds/atoms/Button";
import { FormTextarea } from "~/components/ds/atoms/TextArea";
import { BaseDialog } from "~/components/ds/dialogs/BaseDialog";
import { DialogFooter, DialogTitle } from "~/components/ds/dialogs/Dialog";
import { Form, FormField } from "~/components/ds/molecules/Form";
import { cn } from "~/components/ds/utils";
import Icon from "~/components/Icon";
import { showNotification } from "~/lib/utils/toast";
import type { ListedApp } from "~/types/listedApps";

const rateAppSchema = z.object({
  rating: z.number().min(1, "Please select a rating"),
  feedback: z.string().optional(),
});

type RateAppForm = z.infer<typeof rateAppSchema>;

interface RateAppDialogProps {
  app: Pick<ListedApp, "id" | "appName">;
  isOpen: boolean;
  onClose: () => void;
  context?: "unsubscribe";
}

export function RateAppDialog({ app, isOpen, onClose }: RateAppDialogProps) {
  const [hoveredStar, setHoveredStar] = useState(0);

  const form = useForm<RateAppForm>({
    resolver: zodResolver(rateAppSchema),
    mode: "onChange",
    defaultValues: {
      rating: 0,
      feedback: "",
    },
  });

  const handleSubmit = useCallback(
    async (data: RateAppForm) => {
      // TODO: replace with API call when backend is ready
      try {
        const res = await apiClient.post(`/marketplace/apps/${app.id}/rate`, data);
        if (res.status !== 204) {
          throw new Error("Failed to submit rating");
        }
      } catch (error) {
        showNotification({
          message: "Error submitting rating",
          description: error instanceof Error ? error.message : "Unknown error",
          toastType: "error",
        });
        return;
      }

      showNotification({
        message: "Thanks for your feedback!",
        description: `You rated ${app.appName} ${data.rating}/5.`,
        toastType: "success",
      });
      form.reset();
      setHoveredStar(0);
      onClose();
    },
    [app.appName, form, onClose],
  );

  const handleClose = useCallback(() => {
    form.reset();
    setHoveredStar(0);
    onClose();
  }, [form, onClose]);

  return (
    <BaseDialog open={isOpen} onClose={handleClose}>
      <DialogTitle>Rate your experience</DialogTitle>
      <p className="body-sm-regular text-ds-text-body -mt-2 mb-1">
        Rate {app.appName} so we can inform the vendor and improve the app for you.
      </p>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <div className="flex flex-col gap-4 mb-4">
            <FormField
              name="rating"
              control={form.control}
              render={({ field }) => (
                <div className="flex gap-1" onMouseLeave={() => setHoveredStar(0)}>
                  {[1, 2, 3, 4, 5].map((star) => {
                    const isActive = star <= (hoveredStar || field.value);
                    return (
                      <button
                        key={star}
                        type="button"
                        className="p-0.5 transition-transform duration-100 hover:scale-110"
                        onMouseEnter={() => setHoveredStar(star)}
                        onClick={() => field.onChange(star)}
                      >
                        <Icon
                          id={isActive ? "star-fill-icon" : "star-outline-icon"}
                          className={cn(
                            "w-7 h-7 transition-colors duration-100",
                            isActive
                              ? "text-link-color"
                              : "text-ds-text-caption hover:text-link-color/50",
                          )}
                        />
                      </button>
                    );
                  })}
                </div>
              )}
            />

            <FormField
              name="feedback"
              control={form.control}
              render={({ field }) => (
                <FormTextarea
                  label="Additional Feedback (optional)"
                  placeholder="e.g. data coverage, missing metrics, data accuracy"
                  rows={4}
                  maxLength={1000}
                  {...field}
                />
              )}
            />
          </div>

          <DialogFooter>
            <Button variant="outlined" size="sm" type="button" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              disabled={!form.formState.isValid}
              loading={form.formState.isSubmitting}
              size="sm"
              type="submit"
            >
              Send
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </BaseDialog>
  );
}

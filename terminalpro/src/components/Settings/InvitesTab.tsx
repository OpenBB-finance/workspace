import { zodResolver } from "@hookform/resolvers/zod";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { getRemainingInvites, sendInvite } from "~/api/user.api";
import { useShallowAuthStore } from "~/lib/state/auth";
import { useShallowFeatureFlagsStore } from "~/lib/state/featureFlags";
import { validateEmail } from "~/utils/validators";
import { zodEmail } from "~/utils/zodForms";
import { Button } from "../ds/atoms/Button";
import { FormInput } from "../ds/atoms/Input";
import { FormTextarea } from "../ds/atoms/TextArea";
import { Form, FormField } from "../ds/molecules/Form";

const InviteForm = z.object({
  email: zodEmail,
  message: z.string().max(500, "The message cannot be more than 500 characters."),
});

export type TInviteForm = z.infer<typeof InviteForm>;

function InviteSection() {
  const [loading, setLoading] = useState(false);
  const { user } = useShallowAuthStore((state) => ({
    user: state.user,
  }));

  const form = useForm<TInviteForm>({
    resolver: zodResolver(InviteForm),
    defaultValues: { email: "", message: "" },
  });

  const message = form.watch("message");

  const invitesQuery = useQuery({
    queryKey: ["remainingInvites"],
    queryFn: getRemainingInvites,
  });

  const remaining = invitesQuery?.data?.remaining ?? null;
  const inviteDisabled = remaining === 0 || loading || message.length > 500;

  const { isProTier, isTrial } = useShallowFeatureFlagsStore((state) => ({
    isProTier: state.featureFlags?.tier === "pro",
    isTrial: state.featureFlags?.is_trial,
  }));

  useEffect(() => {
    invitesQuery.refetch();
  }, []);

  async function handleSubmit({ email, message: inviteMessage }: TInviteForm) {
    setLoading(true);

    try {
      if (!validateEmail(email)) return;
      if (inviteMessage.length > 500) return;
      const response = await sendInvite(email, inviteMessage);
      if (response.status === 200) {
        toast.success("Your invitation was successfully sent.");
        invitesQuery.refetch();
        // clear the form values after the invite is successfully sent
        form.reset();
      } else if (response.status === 400) {
        toast.error("You no longer have any invite codes remaining.");
      } else if (response.status === 422) {
        toast.error("Invalid data sent.");
      } else if (response.status === 409) {
        toast.error("This email has already been invited or began a trial.");
      } else {
        toast.error("An unknown error occurred.");
      }
    } catch (error) {
      toast.error("An unknown error occurred.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <div>
      {user.role === "Admin" ? (
        <div>
          <p>
            Manage team invites in the
            <Link to="/admin/users" className="ml-1 text-blue-500 underline">
              User Management
            </Link>{" "}
            section
          </p>
        </div>
      ) : isProTier && !isTrial ? (
        <div>
          <p>
            <strong className="mr-1">Contact Admin</strong>
            to invite colleagues
          </p>
        </div>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <FormField
              name="email"
              control={form.control}
              render={({ field }) => {
                return (
                  <FormInput
                    type="email"
                    className="max-w-[400px]"
                    label="Email"
                    placeholder="Enter email address"
                    {...field}
                  />
                );
              }}
            />
            {remaining !== null && (
              <p className="mt-2 inline-flex w-full flex-col text-xs text-[#46464F]">
                {remaining} invite codes remaining
              </p>
            )}
            <div className="mb-8" />
            <FormField
              name="message"
              control={form.control}
              render={({ field }) => {
                return (
                  <FormTextarea
                    label="Message (optional)"
                    placeholder="Send a message you want to include in the invite"
                    className="max-w-[400px]"
                    {...field}
                  />
                );
              }}
            />

            <Button
              type="submit"
              disabled={inviteDisabled}
              loading={loading}
              size="sm"
              className="mt-4"
            >
              Send invite
            </Button>
          </form>
        </Form>
      )}
    </div>
  );
}

export default function InvitesTab() {
  return (
    <TabsPrimitive.Content className="mt-5 pb-4 gap-4 text-xs" value="invites">
      <div className="mt-4 flex flex-col text-xs bg-general-bg-primary rounded-md p-4">
        <InviteSection />
      </div>
    </TabsPrimitive.Content>
  );
}

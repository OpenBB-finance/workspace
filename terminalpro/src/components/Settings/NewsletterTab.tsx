import * as TabsPrimitive from "@radix-ui/react-tabs";
import { type FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { getNewsletters, type NewsletterData, putNewsletters } from "~/api/auth.api";
import { RadioGroup, RadioGroupItem } from "~/components/ds/atoms/RadioGroup";
import { Button } from "../ds/atoms/Button";
import BrandedLoadingState from "../General/BrandedLoadingState";

const NEWSLETTERS_DESCRIPTION = {
  email_newsletter: "OpenBB Newsletter (product launches & company updates)",
  email_academia:
    "OpenBB Academia Newsletter (academic related updates & new features)",
  email_bot: "OpenBB Bot Newsletter (release updates & new features)",
};

export default function NewsletterTab() {
  const [newsletterData, setNewsletterData] = useState<NewsletterData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function fetchNewsletterInfo() {
      try {
        const data = await getNewsletters();
        setNewsletterData(data);
      } catch (error) {
        toast.error("Error loading newsletters", {
          description: "Failed to load newsletter preferences",
        });
        console.error("Error fetching newsletter info:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchNewsletterInfo();
  }, []);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSaving(true);

    const formData = new FormData(e.currentTarget);
    const payload: NewsletterData = {
      email_newsletter: formData.get("email_newsletter") === "yes",
      email_academia: formData.get("email_academia") === "yes",
      email_bot: formData.get("email_bot") === "yes",
      email_prowaitlist: formData.get("email_prowaitlist") === "yes",
    };

    try {
      const { status } = await putNewsletters(payload);

      if (status === 200) {
        toast.success("Newsletter subscriptions updated", {
          description: "Your newsletter preferences have been updated successfully",
        });
      } else {
        toast.error("Error updating newsletters", {
          description: "Your newsletter subscriptions were not updated",
        });
      }
    } catch (error) {
      toast.error("Error updating newsletters", {
        description: "Your newsletter subscriptions were not updated",
      });
      console.error("Error updating newsletters:", error);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <TabsPrimitive.Content className="mt-5 text-xs" value="newsletter">
        <div className="flex h-full items-center justify-center py-20">
          <BrandedLoadingState />
        </div>
      </TabsPrimitive.Content>
    );
  }

  if (!newsletterData) {
    return (
      <TabsPrimitive.Content className="mt-5 text-xs" value="newsletter">
        <div className="flex bg-general-bg-primary rounded-md p-4">
          Error loading newsletter data
        </div>
      </TabsPrimitive.Content>
    );
  }

  return (
    <TabsPrimitive.Content className="mt-5 mb-5 text-xs" value="newsletter">
      <form onSubmit={handleSubmit} className="flex gap-4 flex-col">
        <div className="flex flex-col gap-6 bg-general-bg-primary rounded-md p-4 py-5">
          <input
            type="hidden"
            name="email_prowaitlist"
            value={newsletterData.email_prowaitlist ? "yes" : "no"}
          />
          {Object.entries(NEWSLETTERS_DESCRIPTION).map(([key, description]) => (
            <div key={key} className="flex flex-col gap-2.5">
              <strong>{description}</strong>
              <RadioGroup
                name={key}
                defaultValue={
                  newsletterData[key as keyof typeof NEWSLETTERS_DESCRIPTION]
                    ? "yes"
                    : "no"
                }
                className="flex items-center gap-10"
              >
                <RadioGroupItem
                  value="yes"
                  id={`${key}-yes`}
                  data-testid={`${key}-yes`}
                  label="Yes"
                />
                <RadioGroupItem
                  value="no"
                  id={`${key}-no`}
                  data-testid={`${key}-no`}
                  label="No"
                />
              </RadioGroup>
            </div>
          ))}
          <Button type="submit" size="sm" className="w-fit" loading={isSaving}>
            Save Changes
          </Button>
        </div>
      </form>
    </TabsPrimitive.Content>
  );
}

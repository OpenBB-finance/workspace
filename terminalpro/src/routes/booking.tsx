import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { bookDemo } from "~/api/auth.api";
import { Button } from "~/components/ds/atoms/Button";
import { FormInput } from "~/components/ds/atoms/Input";
import {
  RadioGroup,
  RadioGroupItem,
  RadioGroupLabel,
} from "~/components/ds/atoms/RadioGroup";
import { Form, FormField } from "~/components/ds/molecules/Form";
import ErrorContent from "~/components/Forms/Error";
import Icon from "~/components/Icon";
import { zodEmail } from "~/utils/zodForms";

const bookingSchema = z.object({
  used_before: z.string(),
  email: zodEmail,
  first_name: z.string(),
  last_name: z.string(),
  message: z.string(),
});

type bookingForm = z.infer<typeof bookingSchema>;

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const urlError = searchParams.get("error");
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fromPro = searchParams.get("from_pro") === "true";

  const form = useForm({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      used_before: searchParams.get("used_before") || "",
      email: searchParams.get("email") || "",
      first_name: searchParams.get("first_name") || "",
      last_name: searchParams.get("last_name") || "",
      message: "",
    },
  });

  useEffect(() => {
    if (urlError) {
      toast.error("Error", { description: urlError });
    }
  }, [urlError]);

  const onSubmit = async (values: bookingForm) => {
    setLoading(true);
    const status = await bookDemo(values);
    if (status === 200) {
      toast.success("Your request has been successfully submitted", {
        description: "We will be in touch with you shortly.",
      });
      if (fromPro) {
        navigate("/app");
      } else {
        navigate("/login");
      }
    } else {
      setError("An error occurred, please try again later");
    }

    setLoading(false);
  };

  return (
    <div className="md:w-[408px] w-[90%] mx-auto">
      <Icon id="terminal-pro-icon" className="w-[170px] h-[67px] mb-12 mx-auto" />
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="mx-auto space-y-8">
          <div>
            <h1 className="text-xl font-bold uppercase tracking-widest">
              Request a demo
            </h1>
            <Link to="/register" className="text-xs text-light-50">
              Discover the full potential of OpenBB with our personalized demo,
              custom-tailored to your needs. Familiarize yourself with our features
              beforehand for a more seamless experience right from the start.
            </Link>
          </div>

          <FormField
            name="used_before"
            render={({ field }) => (
              <div className="space-y-2">
                <RadioGroupLabel>Have you ever used OpenBB?</RadioGroupLabel>
                <RadioGroup
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  className="flex gap-4"
                >
                  <RadioGroupItem value="Yes" label="Yes" />
                  <RadioGroupItem value="No" label="No" />
                </RadioGroup>
              </div>
            )}
          />

          <div className="grid grid-cols-2 gap-5">
            <FormField
              name="first_name"
              render={({ field }) => (
                <FormInput
                  type="text"
                  label="First Name"
                  placeholder="Bobby"
                  autoComplete="current-first-name"
                  {...field}
                />
              )}
            />
            <FormField
              name="last_name"
              render={({ field }) => (
                <FormInput
                  type="text"
                  label="Last Name"
                  placeholder="Axelrod"
                  autoComplete="current-last-name"
                  {...field}
                />
              )}
            />
          </div>
          <FormField
            name="email"
            render={({ field }) => (
              <FormInput
                type="email"
                label="Email"
                placeholder="bobby@axelrod.com"
                {...field}
              />
            )}
          />
          <FormField
            name="message"
            render={({ field }) => (
              <FormInput
                type="text"
                label="Please let us know what you're looking for in particular"
                className="h-[80px]"
                placeholder="Tell us more..."
                {...field}
              />
            )}
          />
          <ErrorContent text={error} />
          <div className="mt-[42px] flex justify-center">
            <Button
              variant="primary"
              type="submit"
              size="sm"
              loading={loading}
              className="md:w-fit h-[40px] w-[120px] px-4 py-2 whitespace-nowrap"
            >
              Request a demo
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

import { zodResolver } from "@hookform/resolvers/zod";
import { Button, FormField, FormInput, FormSelect, useForm } from "@openbb/ui";
import { ManagerForm } from "components/formItems";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "utils/auth";
import { apiLogin } from "utils/requests";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email().min(1, "This field is required"),
  password: z.string().min(8, "The password must be at least 8 characters long"),
});
type TLoginSchema = z.infer<typeof loginSchema>;

export default function Login(): JSX.Element {
  const [warning, setWarning] = useState("");
  const { login } = useAuthStore();
  const navigate = useNavigate();

  const form = useForm<TLoginSchema>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const handleSubmit = async (values: TLoginSchema): Promise<void> => {
    const response = await apiLogin(values.email, values.password, "", true);
    if (response.data) {
      login(response.data, navigate);
    } else {
      setWarning(response.message || "An unknown error occurred");
    }
  };

  return (
    <div className="min-h-screen bg-surface-page">
      <div className="obb-page-container flex justify-center pt-16">
        <div className="w-full max-w-2xl">
          <div className="mb-4">
            <h1 className="obb-admin-title">Admin Sign In</h1>
            <p className="obb-admin-subtitle">
              Use your admin credentials to manage entities, users, and entitlements.
            </p>
          </div>
      <ManagerForm onSubmit={handleSubmit} warning={warning} form={form}>
        <FormField
          name="email"
          control={form.control}
          render={({ field }) => {
            return <FormInput label="Email" {...field} />;
          }}
        />
        <FormField
          name="password"
          control={form.control}
          render={({ field }) => {
            return <FormInput type="password" label="Password" {...field} />;
          }}
        />
            <Button className="obb-btn-blue mt-2">Sign In</Button>
      </ManagerForm>
        </div>
      </div>
    </div>
  );
}

import { Form } from "@openbb/ui";
import React, { FormEvent } from "react";
import type { FieldValues, SubmitHandler, UseFormReturn } from "react-hook-form";

interface FormProps<T extends FieldValues> {
  children: JSX.Element[];
  onSubmit: SubmitHandler<T>;
  warning: string;
  form: UseFormReturn<T>;
}

export function ManagerForm<T extends FieldValues>({
  children,
  onSubmit,
  warning,
  form,
}: FormProps<T>): JSX.Element {
  return (
    <Form {...form}>
      <div className="obb-card w-full max-w-2xl">
        <div className="obb-card-content space-y-3">
          {warning && (
            <p className="rounded bg-red-500/10 px-3 py-2 text-xs text-red-500">{warning}</p>
          )}
          <form className="_form space-y-3" onSubmit={form.handleSubmit(onSubmit)}>
          {children}
          </form>
        </div>
      </div>
    </Form>
  );
}

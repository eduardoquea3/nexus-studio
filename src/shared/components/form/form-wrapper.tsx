import type { FormEvent, KeyboardEvent, ReactNode } from "react";
import {
  FormProvider,
  type FieldError,
  type FieldErrors,
  type FieldValues,
  type UseFormReturn,
} from "react-hook-form";
import { cn } from "@/lib/utils";

interface FormWrapperProps<T extends FieldValues>
  extends Omit<React.ComponentProps<"form">, "onSubmit"> {
  form: UseFormReturn<T>;
  children: ReactNode;
  onSubmit: (data: T) => void | Promise<void>;
}

function getFirstError(errors: FieldErrors): FieldError | undefined {
  for (const error of Object.values(errors)) {
    if (error && typeof error === "object" && "message" in error) {
      return error as FieldError;
    }

    if (error && typeof error === "object") {
      const nestedError = getFirstError(error as FieldErrors);
      if (nestedError) {
        return nestedError;
      }
    }
  }

  return undefined;
}

export function FormWrapper<T extends FieldValues>({
  form,
  children,
  className,
  onKeyDown,
  onSubmit,
  ...props
}: FormWrapperProps<T>) {
  const handleKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    onKeyDown?.(event);
  };

  const handleError = (errors: FieldErrors<T>) => {
    const error = getFirstError(errors);
    if (error?.message) {
      console.error(String(error.message));
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    void form.handleSubmit(onSubmit, handleError)(event);
  };

  return (
    <FormProvider {...form}>
      <form
        {...props}
        className={cn("flex flex-col gap-2", className)}
        onKeyDown={handleKeyDown}
        onSubmit={handleSubmit}
      >
        {children}
      </form>
    </FormProvider>
  );
}

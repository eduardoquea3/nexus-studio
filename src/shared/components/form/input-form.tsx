import type { ChangeEvent } from "react";
import { useController, useFormContext, type Path } from "react-hook-form";
import { z } from "zod";

import { Field } from "@/shared/components/ui/field";
import { Input, type InputProps } from "@/shared/components/ui/input";
import { cn } from "@/lib/utils";

interface InputFormProps<T extends z.ZodObject<z.ZodRawShape>>
  extends Omit<InputProps, "name" | "onChange"> {
  name: Path<z.infer<T>>;
  label?: string;
  orientation?: "horizontal" | "vertical";
  classContainer?: string;
  classLabel?: string;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
}

export function InputForm<T extends z.ZodObject<z.ZodRawShape>>({
  name,
  label,
  orientation,
  classContainer,
  classLabel,
  className,
  onChange,
  ...props
}: InputFormProps<T>) {
  const { control } = useFormContext<z.infer<T>>();
  const {
    field: { value, onChange: fieldOnChange, ...fieldRest },
    fieldState: { invalid },
  } = useController({
    control,
    name,
  });

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    fieldOnChange(event);
    onChange?.(event);
  };

  return (
    <Field
      label={label}
      htmlFor={String(name)}
      orientation={orientation}
      className={classContainer}
      classLabel={cn(classLabel, invalid && "text-destructive")}
    >
      <Input
        {...props}
        {...fieldRest}
        id={String(name)}
        value={String(value ?? "")}
        onChange={handleChange}
        aria-invalid={invalid || undefined}
        className={cn(className, invalid && "border-destructive focus-visible:ring-0")}
      />
    </Field>
  );
}

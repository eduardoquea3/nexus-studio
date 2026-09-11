import type { ChangeEvent } from "react";
import { useRef } from "react";
import { RiFolderOpenLine } from "@remixicon/react";
import { useController, useFormContext, type Path } from "react-hook-form";
import { z } from "zod";

import { Field } from "@/shared/components/ui/field";
import { Input, type InputProps } from "@/shared/components/ui/input";
import { cn } from "@/lib/utils";

interface FileFieldFormProps<T extends z.ZodObject<z.ZodRawShape>>
  extends Omit<InputProps, "name" | "onChange" | "value" | "readOnly" | "iconRight" | "iconRightClick"> {
  name: Path<z.infer<T>>;
  label?: string;
  orientation?: "horizontal" | "vertical";
  classContainer?: string;
  classLabel?: string;
  accept?: string;
  multiple?: boolean;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
}

export function FileFieldForm<T extends z.ZodObject<z.ZodRawShape>>({
  name,
  label,
  orientation,
  classContainer,
  classLabel,
  className,
  accept,
  multiple = false,
  onChange,
  ...props
}: FileFieldFormProps<T>) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { control } = useFormContext<z.infer<T>>();
  const {
    field: { value, onChange: fieldOnChange, ...fieldRest },
    fieldState: { invalid },
  } = useController({
    control,
    name,
  });

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    fieldOnChange(multiple ? files : (files[0] ?? null));
    onChange?.(event);
  };

  const fileName = multiple
    ? Array.isArray(value)
      ? value.map((file) => (file instanceof File ? file.name : "")).filter(Boolean).join(", ")
      : ""
    : value instanceof File
      ? value.name
      : "";

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
        id={`${String(name)}-display`}
        value={fileName}
        readOnly
        aria-invalid={invalid || undefined}
        iconRight={RiFolderOpenLine}
        iconRightClick={() => inputRef.current?.click()}
        className={cn(className, invalid && "border-destructive focus-visible:ring-0")}
      />
      <input
        {...fieldRest}
        ref={inputRef}
        id={String(name)}
        type="file"
        accept={accept}
        multiple={multiple}
        className="sr-only"
        onChange={handleChange}
      />
    </Field>
  );
}

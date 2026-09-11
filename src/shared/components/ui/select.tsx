import type { ComponentProps, ReactNode } from "react";
import { RiLoader4Line } from "@remixicon/react";

import {
  Select as BaseSelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SelectProps<T extends Record<string, unknown>>
  extends Omit<ComponentProps<typeof BaseSelect>, "children" | "onValueChange" | "value" | "defaultValue"> {
  options: readonly T[];
  valueKey?: keyof T;
  labelKey?: keyof T;
  placeholder?: string;
  className?: string;
  isLoading?: boolean;
  render?: (option: T) => ReactNode;
  value?: T | null;
  defaultValue?: T;
  onValueChange?: (value: T | null) => void;
}

function Select<T extends Record<string, unknown>>({
  options,
  valueKey,
  labelKey,
  placeholder = "Select an option",
  className,
  isLoading = false,
  render,
  value,
  defaultValue,
  onValueChange,
  ...props
}: SelectProps<T>) {
  const getOptionValue = (option: T, index: number) =>
    valueKey ? String(option[valueKey]) : String(index);

  const getOptionLabel = (option: T) => {
    if (labelKey) {
      return String(option[labelKey]);
    }

    if (valueKey) {
      return String(option[valueKey]);
    }

    return String(option);
  };

  const getOptionByValue = (selectedValue: string) => {
    const selectedIndex = valueKey
      ? options.findIndex((option) => String(option[valueKey]) === selectedValue)
      : Number(selectedValue);

    return options[selectedIndex];
  };

  const selectedValue = value
    ? getOptionValue(value, options.indexOf(value))
    : undefined;
  const initialValue = defaultValue
    ? getOptionValue(defaultValue, options.indexOf(defaultValue))
    : undefined;

  return (
    <BaseSelect
      {...props}
      disabled={isLoading || props.disabled}
      value={selectedValue}
      defaultValue={initialValue}
      onValueChange={(selectedValue) => {
        onValueChange?.(getOptionByValue(String(selectedValue)) ?? null);
      }}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder}>
          {(selectedValue) => {
            if (isLoading) {
              return (
                <span className="flex items-center gap-2">
                  <RiLoader4Line className="size-3.5 animate-spin" aria-hidden="true" />
                  <span>{placeholder}</span>
                </span>
              );
            }

            const option = selectedValue
              ? getOptionByValue(String(selectedValue))
              : undefined;
            return option && render ? render(option) : option ? getOptionLabel(option) : placeholder;
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((option, index) => {
          return (
            <SelectItem key={getOptionValue(option, index)} value={getOptionValue(option, index)}>
              {render ? render(option) : getOptionLabel(option)}
            </SelectItem>
          );
        })}
      </SelectContent>
    </BaseSelect>
  );
}

export { Select, type SelectProps };

import { Select as SelectPrimitive } from "@base-ui/react/select"

import { cn } from "@/lib/utils"

function Select<TValue, TMultiple extends boolean = false>({ ...props }: SelectPrimitive.Root.Props<TValue, TMultiple>) {
  return <SelectPrimitive.Root data-slot="select" {...props} />
}

function SelectTrigger({ className, ...props }: SelectPrimitive.Trigger.Props) {
  return <SelectPrimitive.Trigger data-slot="select-trigger" className={cn("flex h-9 w-full items-center justify-between rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground", className)} {...props} />
}

function SelectValue({ ...props }: SelectPrimitive.Value.Props) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />
}

function SelectContent({ className, ...props }: SelectPrimitive.Portal.Props) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner className="z-50">
        <SelectPrimitive.Popup className={cn("max-h-80 overflow-auto rounded-xl border border-border bg-card p-1 shadow-lg", className)} {...props} />
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  )
}

function SelectItem({ className, ...props }: SelectPrimitive.Item.Props) {
  return <SelectPrimitive.Item data-slot="select-item" className={cn("flex cursor-pointer items-center rounded-md px-3 py-2 text-sm text-foreground outline-none hover:bg-muted", className)} {...props} />
}

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue }

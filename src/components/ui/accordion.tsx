import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion"
import { AnimatePresence, LayoutGroup, motion } from "motion/react"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

function Accordion({ ...props }: AccordionPrimitive.Root.Props) {
  return (
    <LayoutGroup>
      <AccordionPrimitive.Root data-slot="accordion" {...props} />
    </LayoutGroup>
  )
}

function AccordionItem({ className, ...props }: AccordionPrimitive.Item.Props) {
  return <AccordionPrimitive.Item data-slot="accordion-item" className={cn("border-b border-border", className)} {...props} />
}

function AccordionTrigger({ className, children, ...props }: AccordionPrimitive.Trigger.Props & { className?: string; children: ReactNode }) {
  return (
    <AccordionPrimitive.Trigger
      data-slot="accordion-trigger"
      className={cn("flex w-full items-center justify-between py-3 text-left text-sm font-medium text-foreground", className)}
      {...props}
    >
      {children}
    </AccordionPrimitive.Trigger>
  )
}

function AccordionContent({ className, children, ...props }: AccordionPrimitive.Panel.Props & { className?: string; children?: ReactNode }) {
  return (
    <AnimatePresence initial={false} mode="popLayout">
      <AccordionPrimitive.Panel data-slot="accordion-content" {...props}>
        <motion.div
          layout
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className={cn("overflow-hidden pb-4", className)}
        >
          {children}
        </motion.div>
      </AccordionPrimitive.Panel>
    </AnimatePresence>
  )
}

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger }

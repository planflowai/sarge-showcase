"use client";

import { useState, createContext, useContext } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface AccordionContextType {
  openItems: Set<string>;
  toggle: (value: string) => void;
}

const AccordionContext = createContext<AccordionContextType>({
  openItems: new Set(),
  toggle: () => {},
});

interface AccordionProps {
  type?: "single" | "multiple";
  defaultValue?: string[];
  className?: string;
  children: React.ReactNode;
}

export function Accordion({ type = "multiple", defaultValue = [], className, children }: AccordionProps) {
  const [openItems, setOpenItems] = useState<Set<string>>(new Set(defaultValue));

  const toggle = (value: string) => {
    setOpenItems((prev) => {
      const next = new Set(prev);
      if (next.has(value)) {
        next.delete(value);
      } else {
        if (type === "single") next.clear();
        next.add(value);
      }
      return next;
    });
  };

  return (
    <AccordionContext.Provider value={{ openItems, toggle }}>
      <div className={className}>{children}</div>
    </AccordionContext.Provider>
  );
}

interface AccordionItemProps {
  value: string;
  className?: string;
  children: React.ReactNode;
}

function AccordionItemBase({ value, className, children }: AccordionItemProps) {
  return (
    <div className={cn("border-b border-zinc-200 dark:border-zinc-800", className)} data-value={value}>
      {children}
    </div>
  );
}

interface AccordionTriggerProps {
  className?: string;
  children: React.ReactNode;
}

export function AccordionTrigger({ className, children }: AccordionTriggerProps) {
  const { openItems, toggle } = useContext(AccordionContext);
  const item = useContext(AccordionItemContext);
  const isOpen = openItems.has(item);

  return (
    <button
      onClick={() => toggle(item)}
      className={cn(
        "flex w-full items-center justify-between py-2 text-sm font-medium transition-all",
        className
      )}
    >
      {children}
      <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
    </button>
  );
}

interface AccordionContentProps {
  className?: string;
  children: React.ReactNode;
}

export function AccordionContent({ className, children }: AccordionContentProps) {
  const { openItems } = useContext(AccordionContext);
  const item = useContext(AccordionItemContext);
  const isOpen = openItems.has(item);

  if (!isOpen) return null;

  return <div className={cn("pb-4 pt-0", className)}>{children}</div>;
}

// Internal context to pass value from AccordionItem to Trigger/Content
const AccordionItemContext = createContext<string>("");

// Wrap AccordionItem to provide context
export function AccordionItem({ value, className, children }: AccordionItemProps) {
  return (
    <AccordionItemContext.Provider value={value}>
      <AccordionItemBase value={value} className={className}>
        {children}
      </AccordionItemBase>
    </AccordionItemContext.Provider>
  );
};

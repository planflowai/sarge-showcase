"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-zinc-300 dark:border-zinc-700",
          "bg-white dark:bg-zinc-900 px-3 py-1 text-sm text-zinc-900 dark:text-zinc-100",
          "placeholder:text-zinc-500 dark:placeholder:text-zinc-400",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

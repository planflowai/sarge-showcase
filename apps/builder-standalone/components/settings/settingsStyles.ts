/**
 * Shared Tailwind class strings used across Settings section components.
 * Import from this file rather than duplicating strings.
 *
 * HIGH CONTRAST RULE: All text white on dark, black on light. No grey.
 */

export const inputCls =
  "bg-zinc-50 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-600 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-400 text-sm font-medium";

export const textareaCls =
  "w-full rounded border border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-400 focus:border-indigo-500 focus:outline-none resize-none";

export const cardCls =
  "rounded-lg border border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-800 p-4";

export const dashedCardCls =
  "rounded-lg border border-dashed border-zinc-300 dark:border-zinc-600 bg-zinc-50/50 dark:bg-zinc-800/50 p-4";

/** Standard label class — white, bold, readable */
export const labelCls =
  "text-xs font-bold text-zinc-800 dark:text-white uppercase tracking-wide block mb-1";

/** Section heading — large, bold */
export const sectionHeadingCls =
  "text-lg font-bold text-zinc-900 dark:text-white";

/** Description text — readable, not grey */
export const descCls =
  "text-sm font-semibold text-zinc-800 dark:text-white";

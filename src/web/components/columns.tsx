import { type ReactNode } from "react";

/**
 * Provides a two-column grid that stacks in reading order on narrow screens.
 * Markdown validation, not this component, requires exactly two columns.
 */
export function Columns({ children }: { children?: ReactNode }) {
  return (
    <div className="my-6 grid gap-4 sm:grid-cols-2" data-columns>
      {children}
    </div>
  );
}

/** One column of a two-column comparison. */
export function Column({ children }: { children?: ReactNode }) {
  return (
    <div className="space-y-3 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0" data-column>
      {children}
    </div>
  );
}

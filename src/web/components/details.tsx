import { type ReactNode } from "react";

export interface DetailsProps {
  title: string;
  children?: ReactNode;
}

/**
 * Collapsed-by-default disclosure for answers, proofs, and extra detail.
 * The native `details` element provides keyboard operation and the collapsed
 * state without extra script.
 */
export function Details({ title, children }: DetailsProps) {
  return (
    <details
      className="my-6 border-y border-border bg-background py-4 font-sans text-base"
      data-details
    >
      <summary className="cursor-pointer font-semibold text-foreground">{title}</summary>
      <div className="mt-3 space-y-3 text-foreground [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
        {children}
      </div>
    </details>
  );
}

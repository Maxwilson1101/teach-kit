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
    <details className="my-6 rounded-lg border border-slate-200 bg-white px-4 py-3" data-details>
      <summary className="cursor-pointer font-semibold text-slate-900">{title}</summary>
      <div className="mt-3 space-y-3 text-slate-700 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
        {children}
      </div>
    </details>
  );
}

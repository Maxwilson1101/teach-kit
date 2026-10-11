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
    <details className="disclosure" data-details>
      <summary>
        <svg
          aria-hidden="true"
          focusable="false"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m9 5 7 7-7 7" />
        </svg>
        <span>{title}</span>
      </summary>
      <div className="disclosure-body annotation-body">{children}</div>
    </details>
  );
}

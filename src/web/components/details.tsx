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
    <details className="disclosure group my-4" data-details>
      <summary className="flex min-h-11 cursor-pointer list-none items-start gap-2 py-2.5 font-serif font-semibold [font-size:inherit] leading-[inherit] hover:text-primary [&::-webkit-details-marker]:hidden">
        <svg
          aria-hidden="true"
          focusable="false"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mt-[0.4em] size-4 shrink-0 text-muted-foreground transition-transform duration-[120ms] group-open:[transform:rotate(90deg)]"
        >
          <path d="m9 5 7 7-7 7" />
        </svg>
        <span>{title}</span>
      </summary>
      <div className="annotation-body mt-1 mb-2 ml-2 border-l pl-[15px]">{children}</div>
    </details>
  );
}

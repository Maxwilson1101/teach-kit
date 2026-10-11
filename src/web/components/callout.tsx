import { cva } from "class-variance-authority";
import { type ReactNode } from "react";
import { type CalloutKind } from "../../markdown/callout-kind";

const CALLOUT_LABELS: Record<CalloutKind, string> = {
  note: "提示",
  tip: "小贴士",
  warning: "注意",
};

const CALLOUT_ICONS: Record<CalloutKind, ReactNode> = {
  note: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7h.01" />
    </>
  ),
  tip: <path d="M9 18h6M10 21h4M8 14a6 6 0 1 1 8 0c-1 1-1 2-1 2H9s0-1-1-2Z" />,
  warning: <path d="m12 3 10 18H2L12 3ZM12 9v5M12 17h.01" />,
};

const calloutVariants = cva("my-8 border-l-2 px-4 py-3", {
  variants: {
    kind: {
      note: "border-primary bg-background",
      tip: "border-tip-border bg-background",
      warning: "border-warning-border bg-warning",
    },
  },
});

const calloutHeadingVariants = cva(
  "callout-heading flex items-start gap-2 font-sans text-base leading-6 font-semibold",
  {
    variants: {
      kind: {
        note: "text-primary",
        tip: "text-tip-foreground",
        warning: "text-warning-foreground",
      },
    },
  },
);

export interface CalloutProps {
  kind: CalloutKind;
  title?: string;
  children?: ReactNode;
}

/** Highlights definitions, conclusions, tips, and risks. */
export function Callout({ kind, title, children }: CalloutProps) {
  const label = title ?? CALLOUT_LABELS[kind];
  return (
    <aside className={calloutVariants({ kind })} data-callout={kind}>
      <div className={calloutHeadingVariants({ kind })}>
        <svg
          aria-hidden="true"
          focusable="false"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mt-1 size-4 shrink-0"
        >
          {CALLOUT_ICONS[kind]}
        </svg>
        <span>{label}</span>
      </div>
      <div className="annotation-body mt-2 pl-6">{children}</div>
    </aside>
  );
}

import { type ReactNode } from "react";
import { type CalloutKind } from "../../markdown/callout-kind";

const CALLOUT_LABELS: Record<CalloutKind, string> = {
  note: "提示",
  tip: "小贴士",
  warning: "注意",
};

const CALLOUT_STYLES: Record<CalloutKind, string> = {
  note: "border-primary bg-secondary",
  tip: "border-tip-border bg-tip",
  warning: "border-warning-border bg-warning",
};

export interface CalloutProps {
  kind: CalloutKind;
  title?: string;
  children?: ReactNode;
}

/** Highlights definitions, conclusions, tips, and risks. */
export function Callout({ kind, title, children }: CalloutProps) {
  const label = title ?? CALLOUT_LABELS[kind];
  return (
    <aside
      className={`my-8 border-l-2 px-5 py-4 font-sans text-base leading-relaxed ${CALLOUT_STYLES[kind]}`}
      data-callout={kind}
    >
      <p className="mb-2 font-semibold text-foreground">{label}</p>
      <div className="space-y-3 text-foreground [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
        {children}
      </div>
    </aside>
  );
}

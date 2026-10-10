import { type ReactNode } from "react";

const CALLOUT_LABELS = {
  note: "Note",
  tip: "Tip",
  warning: "Warning",
} as const;

const CALLOUT_STYLES: Record<CalloutKind, string> = {
  note: "border-sky-300 bg-sky-50",
  tip: "border-emerald-300 bg-emerald-50",
  warning: "border-amber-300 bg-amber-50",
};

export type CalloutKind = keyof typeof CALLOUT_LABELS;

/** Narrow a directive attribute to a supported callout kind. */
export function isCalloutKind(value: string | null | undefined): value is CalloutKind {
  return value === "note" || value === "tip" || value === "warning";
}

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
      className={`my-6 rounded-r-lg border-l-4 py-3 pr-4 pl-4 ${CALLOUT_STYLES[kind]}`}
      data-callout={kind}
    >
      <p className="mb-2 font-semibold text-slate-900">{label}</p>
      <div className="space-y-3 text-slate-700 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
        {children}
      </div>
    </aside>
  );
}

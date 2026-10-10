/** Environment-independent callout kinds shared by validation and rendering. */
export const CALLOUT_KINDS = ["note", "tip", "warning"] as const;

export type CalloutKind = (typeof CALLOUT_KINDS)[number];

/** Narrows a directive attribute to a supported callout kind. */
export function isCalloutKind(value: string | null | undefined): value is CalloutKind {
  return CALLOUT_KINDS.some((kind) => kind === value);
}

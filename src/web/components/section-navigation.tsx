import {
  autoUpdate,
  FloatingPortal,
  flip,
  offset,
  safePolygon,
  shift,
  useDismiss,
  useFloating,
  useFocus,
  useHover,
  useInteractions,
  useRole,
} from "@floating-ui/react";
import { type Dispatch, type MouseEvent, type SetStateAction, useEffect, useState } from "react";
import { type MarkdownSection } from "../../markdown/sections";
import { useActiveSection } from "../hooks/use-active-section";

/** Preserve native fragment navigation and history while moving focus into the article. */
function focusHeading(event: MouseEvent<HTMLAnchorElement>, id: string) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
    return;
  const heading = document.getElementById(id);
  if (heading) {
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }
}

function SectionLink({
  section,
  index,
  active,
  openId,
  setOpenId,
}: {
  section: MarkdownSection;
  index: number;
  active: boolean;
  openId: string | null;
  setOpenId: Dispatch<SetStateAction<string | null>>;
}) {
  const open = openId === section.id;
  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange(next, _event, reason) {
      if (
        !next &&
        (reason === "hover" || reason === "safe-polygon") &&
        document.activeElement === refs.domReference.current
      )
        return;
      if (
        !next &&
        reason === "focus" &&
        (refs.domReference.current?.matches(":hover") || refs.floating.current?.matches(":hover"))
      )
        return;
      setOpenId((current) => (next ? section.id : current === section.id ? null : current));
    },
    placement: "right-start",
    strategy: "fixed",
    middleware: [offset(10), flip(), shift({ padding: 12 })],
    whileElementsMounted: autoUpdate,
  });
  const hover = useHover(context, { handleClose: safePolygon(), move: false, mouseOnly: true });
  const focus = useFocus(context, { visibleOnly: false });
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: "tooltip" });
  const { getReferenceProps, getFloatingProps } = useInteractions([hover, focus, dismiss, role]);
  const title = section.title || `Section ${index + 1}`;
  return (
    <li>
      <a
        ref={refs.setReference}
        href={`#${section.id}`}
        aria-current={active ? "location" : undefined}
        {...getReferenceProps({
          onClick: (event: MouseEvent<HTMLAnchorElement>) => focusHeading(event, section.id),
        })}
      >
        <span aria-hidden="true" className="section-tick" />
        <span className="sr-only">{title}</span>
      </a>
      {open && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            className="section-preview"
            {...getFloatingProps()}
          >
            <p className="section-preview-title">{title}</p>
            {section.summary && <p className="section-preview-summary">{section.summary}</p>}
          </div>
        </FloatingPortal>
      )}
    </li>
  );
}

export function SectionNavigation({ sections }: { sections: readonly MarkdownSection[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const activeId = useActiveSection(sections);
  useEffect(() => {
    const close = () => setOpenId(null);
    window.addEventListener("resize", close);
    return () => window.removeEventListener("resize", close);
  }, []);
  if (!sections.length) return null;
  return (
    <nav aria-label="Section navigation" className="section-rail">
      <ol>
        {sections.map((section, index) => (
          <SectionLink
            key={section.id}
            section={section}
            index={index}
            active={activeId === section.id}
            openId={openId}
            setOpenId={setOpenId}
          />
        ))}
      </ol>
    </nav>
  );
}

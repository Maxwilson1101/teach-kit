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
import {
  type Dispatch,
  type MouseEvent,
  type SetStateAction,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { type MarkdownSection } from "../../markdown/sections";
import { useActiveSection } from "../hooks/use-active-section";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";

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

/** Tick width and opacity grow toward the hovered or focused section. */
function tickWaveClass(distance: number | null): string {
  switch (distance) {
    case 0:
      return "w-[33px] opacity-100";
    case 1:
      return "w-6 opacity-80";
    case 2:
      return "w-[18px] opacity-65";
    case 3:
      return "w-3 opacity-55";
    default:
      return "w-2 opacity-45";
  }
}

const OUTLINE_LINK =
  "block border-l-2 border-transparent px-2 py-2.5 leading-[1.6] hover:border-primary hover:text-primary aria-[current=location]:border-primary aria-[current=location]:text-primary";

function SectionLink({
  section,
  index,
  active,
  openId,
  setOpenId,
  waveDistance,
  setHoveredIndex,
  setFocusedIndex,
}: {
  section: MarkdownSection;
  index: number;
  active: boolean;
  openId: string | null;
  setOpenId: Dispatch<SetStateAction<string | null>>;
  waveDistance: number | null;
  setHoveredIndex: Dispatch<SetStateAction<number | null>>;
  setFocusedIndex: Dispatch<SetStateAction<number | null>>;
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
        className="group/tick flex min-h-[13px] w-11 items-center justify-start rounded-[3px] pl-4"
        {...getReferenceProps({
          onPointerEnter: () => setHoveredIndex(index),
          onFocus: () => setFocusedIndex(index),
          onBlur: () => setFocusedIndex(null),
          onClick: (event: MouseEvent<HTMLAnchorElement>) => focusHeading(event, section.id),
        })}
      >
        <span
          aria-hidden="true"
          className={cn(
            "section-tick block h-0.5 transition-[width,opacity] duration-[120ms]",
            tickWaveClass(waveDistance),
            active
              ? "bg-primary opacity-100"
              : waveDistance === 0
                ? "bg-foreground"
                : "bg-muted-foreground",
            "group-hover/tick:bg-primary group-hover/tick:opacity-100 group-focus-visible/tick:bg-primary group-focus-visible/tick:opacity-100",
          )}
        />
        <span className="sr-only">{title}</span>
      </a>
      {open && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            className="section-preview z-30 w-[min(400px,calc(100vw_-_24px))] max-h-[calc(100dvh_-_24px)] overflow-y-auto rounded-2xl border bg-card p-3 text-sm leading-normal text-card-foreground shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
            {...getFloatingProps({
              onPointerEnter: () => setHoveredIndex(index),
              onPointerLeave: () => setHoveredIndex(null),
            })}
          >
            <p className="section-preview-title m-0 text-base leading-[1.4] font-semibold">
              {title}
            </p>
            {section.summary && (
              <p className="section-preview-summary mt-1.5 line-clamp-4 text-muted-foreground">
                {section.summary}
              </p>
            )}
          </div>
        </FloatingPortal>
      )}
    </li>
  );
}

export function SectionNavigation({ sections }: { sections: readonly MarkdownSection[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [wide, setWide] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const outlineId = useId();
  const button = useRef<HTMLButtonElement>(null);
  const activeId = useActiveSection(sections);
  const waveIndex = hoveredIndex ?? focusedIndex;
  useEffect(() => {
    // 760px reading column plus a gutter on each side, without shifting the article.
    const media = window.matchMedia("(min-width: 1000px)");
    const changeLayout = () => {
      setWide(media.matches);
      setExpanded(false);
      setOpenId(null);
    };
    const close = () => setOpenId(null);
    changeLayout();
    media.addEventListener("change", changeLayout);
    window.addEventListener("resize", close);
    return () => {
      media.removeEventListener("change", changeLayout);
      window.removeEventListener("resize", close);
    };
  }, []);
  if (!sections.length) return null;
  return (
    <nav
      aria-label="章节导航"
      className={
        wide
          ? "section-rail fixed top-1/2 left-[max(24px,calc((100vw_-_760px)_/_2_-_80px))] z-20 hidden max-h-[calc(100dvh_-_48px)] -translate-y-1/2 overflow-y-auto min-[1000px]:block"
          : "section-outline mb-8 border-y py-3 text-sm min-[1000px]:hidden"
      }
      onKeyDown={(event) => {
        if (event.key === "Escape" && !wide && expanded) {
          event.preventDefault();
          setExpanded(false);
          button.current?.focus();
        }
      }}
      onPointerLeave={() => setHoveredIndex(null)}
    >
      {wide ? (
        <ol>
          {sections.map((section, index) => (
            <SectionLink
              key={section.id}
              section={section}
              index={index}
              active={activeId === section.id}
              openId={openId}
              setOpenId={setOpenId}
              waveDistance={waveIndex === null ? null : Math.abs(index - waveIndex)}
              setHoveredIndex={setHoveredIndex}
              setFocusedIndex={setFocusedIndex}
            />
          ))}
        </ol>
      ) : (
        <>
          <Button
            ref={button}
            type="button"
            variant="ghost"
            className="w-full justify-between px-0 text-muted-foreground"
            aria-expanded={expanded}
            aria-controls={outlineId}
            onClick={() => setExpanded((current) => !current)}
          >
            本页内容
            <span aria-hidden="true">{expanded ? "−" : "+"}</span>
          </Button>
          <ol
            id={outlineId}
            className="mt-3 max-h-[min(50dvh,360px)] overflow-y-auto p-1"
            hidden={!expanded}
          >
            {sections.map((section, index) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  aria-current={activeId === section.id ? "location" : undefined}
                  className={OUTLINE_LINK}
                  onClick={(event) => {
                    focusHeading(event, section.id);
                    setExpanded(false);
                  }}
                >
                  {section.title || `Section ${index + 1}`}
                </a>
              </li>
            ))}
          </ol>
        </>
      )}
    </nav>
  );
}

import { type MouseEvent } from "react";
import { type MarkdownSection } from "../../markdown/sections";

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

export function SectionNavigation({ sections }: { sections: readonly MarkdownSection[] }) {
  if (!sections.length) return null;
  return (
    <nav aria-label="Section navigation" className="section-rail">
      <ol>
        {sections.map((section, index) => (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              aria-label={section.title || `Section ${index + 1}`}
              onClick={(event) => focusHeading(event, section.id)}
            >
              <span aria-hidden="true" className="section-tick" />
              <span className="sr-only">{section.title || `Section ${index + 1}`}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

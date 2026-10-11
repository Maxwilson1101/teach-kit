import { useEffect, useState } from "react";
import { type MarkdownSection } from "../../markdown/sections";

/** Pick the last section reached by the reading line; short final sections win at the bottom. */
export function findActiveSection(
  headings: readonly { id: string; top: number }[],
  readingLine: number,
  atBottom: boolean,
): string | undefined {
  if (atBottom) return headings.at(-1)?.id;
  let current: string | undefined;
  for (const heading of headings) {
    if (heading.top <= readingLine) current = heading.id;
  }
  return current;
}

/** Scroll state is independent of fragment history and hover/focus previews. */
export function useActiveSection(sections: readonly MarkdownSection[]) {
  const [activeId, setActiveId] = useState<string>();
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const headings = sections.flatMap(({ id }) => {
        const element = document.getElementById(id);
        return element ? [{ id, top: element.getBoundingClientRect().top }] : [];
      });
      const atBottom =
        window.scrollY > 0 &&
        Math.ceil(window.scrollY + window.innerHeight) >= document.documentElement.scrollHeight;
      setActiveId(findActiveSection(headings, 80, atBottom));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("hashchange", schedule);
    const observer = new ResizeObserver(schedule);
    observer.observe(document.body);
    const article = document.querySelector("article");
    if (article) observer.observe(article);
    update();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("hashchange", schedule);
    };
  }, [sections]);
  return activeId;
}

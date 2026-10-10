import { type KeyboardEvent, type ReactNode, useId, useState } from "react";

export interface TabItem {
  /** Stable identity within the tab group, used as the React key. */
  id: string;
  title: string;
  content: ReactNode;
}

/**
 * Alternative perspectives or implementations shown one at a time.
 *
 * The first tab is initially selected. Left/Right move focus and selection
 * with wraparound; Home/End select the first/last tab. Only the selected tab
 * is in the tab order, and each tab references its mounted panel; inactive
 * panels are hidden. An empty group renders nothing. Markdown validation,
 * not this component, rejects nested tab groups.
 */
export function Tabs({ tabs }: { tabs: TabItem[] }) {
  const [active, setActive] = useState(0);
  const id = useId();

  if (tabs.length === 0) return null;

  const last = tabs.length - 1;

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    let next: number | undefined;
    if (event.key === "ArrowRight") next = active === last ? 0 : active + 1;
    else if (event.key === "ArrowLeft") next = active === 0 ? last : active - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    if (next === undefined) return;

    event.preventDefault();
    setActive(next);
    const buttons =
      event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    buttons?.[next]?.focus();
  };

  return (
    <div className="my-6" data-tabs>
      <div
        role="tablist"
        aria-orientation="horizontal"
        className="flex flex-wrap gap-1 border-b border-slate-200"
        onKeyDown={handleKeyDown}
      >
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`${id}-tab-${index}`}
            aria-selected={index === active}
            aria-controls={`${id}-panel-${index}`}
            tabIndex={index === active ? 0 : -1}
            onClick={() => setActive(index)}
            className={
              index === active
                ? "rounded-t-md border border-b-0 border-slate-200 bg-white px-4 py-2 font-medium text-slate-900"
                : "rounded-t-md px-4 py-2 text-slate-600 hover:text-slate-900"
            }
          >
            {tab.title}
          </button>
        ))}
      </div>
      {tabs.map((tab, index) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`${id}-panel-${index}`}
          aria-labelledby={`${id}-tab-${index}`}
          hidden={index !== active}
          className="space-y-3 pt-4 text-slate-700 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}

import * as TabsPrimitive from "@radix-ui/react-tabs";
import { type ReactNode, useState } from "react";
import { cn } from "../lib/utils";

export interface TabItem {
  /** Stable identity within the tab group, used as the React key and tab value. */
  id: string;
  title: string;
  content: ReactNode;
}

const TAB_TRIGGER =
  "lesson-tab relative shrink-0 max-w-full min-h-11 cursor-pointer rounded-xs px-1 py-2.5 font-medium text-muted-foreground [outline:none] hover:text-foreground data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:after:absolute data-[state=active]:after:bottom-1 data-[state=active]:after:left-1 data-[state=active]:after:h-0.5 data-[state=active]:after:w-6 data-[state=active]:after:bg-current data-[state=active]:after:content-['']";

const TAB_FOCUS =
  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring";

/**
 * Alternative perspectives shown one at a time using Radix's accessible tabs.
 * Left/Right wrap focus and selection; Home/End select the first/last tab.
 * The first tab is initially selected, and Tab moves into its focusable panel.
 * Inactive panels remain mounted but hidden to preserve nested component state.
 * An empty group renders nothing. Markdown validation rejects nested groups.
 */
export function Tabs({ tabs }: { tabs: TabItem[] }) {
  const [active, setActive] = useState(tabs[0]?.id ?? "");
  const [pointerFocus, setPointerFocus] = useState(false);
  if (tabs.length === 0) return null;

  return (
    <TabsPrimitive.Root
      value={active}
      onValueChange={setActive}
      activationMode="automatic"
      orientation="horizontal"
      className="lesson-tabs group my-8 min-w-0"
      data-tabs
      data-pointer-focus={pointerFocus}
      // Radix focuses on mouse down, which can retain the browser's keyboard focus indicator.
      onPointerDownCapture={() => setPointerFocus(true)}
      onKeyDownCapture={() => setPointerFocus(false)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPointerFocus(false);
      }}
    >
      <TabsPrimitive.List
        loop
        className="lesson-tab-list flex items-start gap-6 overflow-x-auto p-1 font-sans text-sm leading-5 [scrollbar-width:thin]"
      >
        {tabs.map((tab) => (
          <TabsPrimitive.Trigger
            key={tab.id}
            value={tab.id}
            className={cn(TAB_TRIGGER, !pointerFocus && TAB_FOCUS)}
          >
            {tab.title}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      {tabs.map((tab) => (
        <TabsPrimitive.Content
          key={tab.id}
          value={tab.id}
          forceMount
          hidden={tab.id !== active}
          tabIndex={tab.id === active ? 0 : -1}
          className="lesson-tab-panel annotation-body relative mt-3 pt-1 [outline:none] focus-visible:before:absolute focus-visible:before:top-1 focus-visible:before:-left-2 focus-visible:before:h-6 focus-visible:before:w-0.5 focus-visible:before:bg-ring focus-visible:before:content-['']"
        >
          {tab.content}
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  );
}

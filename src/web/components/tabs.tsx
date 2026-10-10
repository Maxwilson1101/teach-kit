import * as TabsPrimitive from "@radix-ui/react-tabs";
import { type ReactNode, useState } from "react";

export interface TabItem {
  /** Stable identity within the tab group, used as the React key and tab value. */
  id: string;
  title: string;
  content: ReactNode;
}

/**
 * Alternative perspectives shown one at a time using Radix's accessible tabs.
 * Left/Right wrap focus and selection; Home/End select the first/last tab.
 * The first tab is initially selected, and Tab moves into its focusable panel.
 * Inactive panels remain mounted but hidden to preserve nested component state.
 * An empty group renders nothing. Markdown validation rejects nested groups.
 */
export function Tabs({ tabs }: { tabs: TabItem[] }) {
  const [active, setActive] = useState(tabs[0]?.id ?? "");
  if (tabs.length === 0) return null;

  return (
    <TabsPrimitive.Root
      value={active}
      onValueChange={setActive}
      activationMode="automatic"
      orientation="horizontal"
      className="my-8 font-sans text-base leading-relaxed"
      data-tabs
    >
      <TabsPrimitive.List loop className="flex flex-wrap gap-1 border-b border-border">
        {tabs.map((tab) => (
          <TabsPrimitive.Trigger
            key={tab.id}
            value={tab.id}
            className={
              tab.id === active
                ? "border-b-2 border-foreground px-4 py-3 font-medium text-foreground"
                : "border-b-2 border-transparent px-4 py-3 text-muted-foreground hover:text-foreground"
            }
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
          className="space-y-3 pt-4 text-foreground [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
        >
          {tab.content}
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  );
}

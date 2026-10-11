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
  const [pointerFocus, setPointerFocus] = useState(false);
  if (tabs.length === 0) return null;

  return (
    <TabsPrimitive.Root
      value={active}
      onValueChange={setActive}
      activationMode="automatic"
      orientation="horizontal"
      className="lesson-tabs"
      data-tabs
      data-pointer-focus={pointerFocus}
      // Radix focuses on mouse down, which can retain the browser's keyboard focus indicator.
      onPointerDownCapture={() => setPointerFocus(true)}
      onKeyDownCapture={() => setPointerFocus(false)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPointerFocus(false);
      }}
    >
      <TabsPrimitive.List loop className="lesson-tab-list">
        {tabs.map((tab) => (
          <TabsPrimitive.Trigger key={tab.id} value={tab.id} className="lesson-tab">
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
          className="lesson-tab-panel annotation-body"
        >
          {tab.content}
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  );
}

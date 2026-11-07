// Implements keyboard-operable tabs with one active, labelled panel.
import { useRef, useState } from "react";

export default function Tabs({ items, label, defaultTab }) {
  const [activeId, setActiveId] = useState(defaultTab || items[0]?.id);
  const tabRefs = useRef([]);
  const activeItem = items.find((item) => item.id === activeId) || items[0];

  function handleKeyDown(event, index) {
    let nextIndex = index;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (index + 1) % items.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (index - 1 + items.length) % items.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = items.length - 1;
    } else {
      return;
    }
    event.preventDefault();
    setActiveId(items[nextIndex].id);
    tabRefs.current[nextIndex]?.focus();
  }

  if (!activeItem) return null;

  return (
    <div className="tabs">
      <div className="tab-list" role="tablist" aria-label={label}>
        {items.map((item, index) => (
          <button
            key={item.id}
            ref={(element) => { tabRefs.current[index] = element; }}
            id={`tab-${item.id}`}
            className="tab-button"
            type="button"
            role="tab"
            aria-selected={activeId === item.id}
            aria-controls={`panel-${item.id}`}
            tabIndex={activeId === item.id ? 0 : -1}
            onClick={() => setActiveId(item.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div
        id={`panel-${activeItem.id}`}
        className="tab-panel"
        role="tabpanel"
        aria-labelledby={`tab-${activeItem.id}`}
        tabIndex={0}
      >
        {activeItem.content}
      </div>
    </div>
  );
}

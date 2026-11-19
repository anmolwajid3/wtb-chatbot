"use client";

import { useEffect, useState } from "react";
import { setConversationTag } from "./actions";

export function TagSelect({
  conversationId,
  defaultValue,
  children,
  className,
}: {
  conversationId: string;
  defaultValue: string;
  children: React.ReactNode;
  className?: string;
}) {
  const storageKey = `wtb-review-tag:${conversationId}`;
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    if (defaultValue) {
      setValue(defaultValue);
      return;
    }
    try {
      const stored = window.sessionStorage.getItem(storageKey);
      if (stored) setValue(stored);
    } catch {
      // Storage can be blocked. The select still keeps the value from this render.
    }
  }, [defaultValue, storageKey]);

  return (
    <select
      name="review_tag"
      value={value}
      className={className}
      onChange={(event) => {
        const next = event.currentTarget.value;
        setValue(next);
        try {
          window.sessionStorage.setItem(storageKey, next);
        } catch {
          // The visible value is already updated.
        }
        const data = new FormData();
        data.set("id", conversationId);
        data.set("review_tag", next);
        void setConversationTag(data);
      }}
    >
      {children}
    </select>
  );
}

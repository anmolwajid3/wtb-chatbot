"use client";

import { useState } from "react";

export function TagSelect({
  name,
  defaultValue,
  children,
  className,
}: {
  name: string;
  defaultValue: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [value, setValue] = useState(defaultValue);

  return (
    <select
      name={name}
      value={value}
      className={className}
      onChange={(event) => {
        const next = event.currentTarget.value;
        setValue(next);
        event.currentTarget.form?.requestSubmit();
      }}
    >
      {children}
    </select>
  );
}

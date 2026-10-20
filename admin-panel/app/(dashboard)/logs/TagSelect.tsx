"use client";

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
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      className={className}
      onChange={(event) => {
        event.currentTarget.form?.requestSubmit();
      }}
    >
      {children}
    </select>
  );
}

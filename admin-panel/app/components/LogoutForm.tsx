"use client";

import { logoutAction } from "../actions";

export function LogoutForm({
  label,
  className,
  action,
}: {
  label: string;
  className?: string;
  action?: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <form action={action || logoutAction}>
      <button type="submit" className={className}>
        {label}
      </button>
    </form>
  );
}

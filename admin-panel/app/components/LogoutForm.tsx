"use client";

import { logoutAction } from "../actions";

export function LogoutForm({ label, className }: { label: string; className?: string }) {
  return (
    <form action={logoutAction}>
      <button type="submit" className={className}>
        {label}
      </button>
    </form>
  );
}

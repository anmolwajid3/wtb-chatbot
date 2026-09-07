"use client";

import { useState } from "react";

type QueryRowType = {
  id: string;
  coach_name: string;
  subject: string;
  message: string;
  status: string;
  admin_response: string | null;
  created_at: string;
};

const STATUSES = ["open", "pending", "closed"];

const statusStyles: Record<string, string> = {
  open: "bg-blue-900/40 text-blue-400",
  pending: "bg-amber-900/40 text-amber-400",
  closed: "bg-neutral-800 text-neutral-500",
};

export default function QueryRow({
  query,
  updateQuery,
  deleteQuery,
}: {
  query: QueryRowType;
  updateQuery: (id: string, status: string, adminResponse: string) => Promise<void>;
  deleteQuery: (id: string) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [status, setStatus] = useState(query.status);
  const [response, setResponse] = useState(query.admin_response || "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await updateQuery(query.id, status, response);
    setSaving(false);
    setIsEditing(false);
  }

  function handleCancel() {
    setStatus(query.status);
    setResponse(query.admin_response || "");
    setIsEditing(false);
  }

  async function handleDelete() {
    if (window.confirm("Delete this support query? This can't be undone.")) {
      await deleteQuery(query.id);
    }
  }

  return (
    <tr className="border-b border-neutral-800 last:border-0 align-top">
      <td className="px-4 py-3 text-neutral-100 whitespace-nowrap">{query.coach_name}</td>
      <td className="px-4 py-3">
        <p className="text-neutral-100 font-medium">{query.subject}</p>
        <p className="text-neutral-400 text-xs mt-1">{query.message}</p>
      </td>
      <td className="px-4 py-3">
        {isEditing ? (
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="bg-black border border-neutral-700 rounded-md px-2 py-1 text-xs text-neutral-100 focus:outline-none focus:border-amber-500"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        ) : (
          <span className={`text-xs px-2 py-1 rounded-full ${statusStyles[status] || ""}`}>
            {status}
          </span>
        )}
      </td>
      <td className="px-4 py-3 max-w-xs">
        {isEditing ? (
          <textarea
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            placeholder="Write a response..."
            rows={3}
            className="w-full bg-black border border-neutral-700 rounded-md px-2 py-1.5 text-xs text-neutral-100 focus:outline-none focus:border-amber-500 resize-none"
          />
        ) : query.admin_response ? (
          <p className="text-xs text-neutral-300">{query.admin_response}</p>
        ) : (
          <p className="text-xs text-neutral-600 italic">No response yet</p>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-neutral-500 whitespace-nowrap">
        {new Date(query.created_at).toLocaleDateString("en-GB")}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          {isEditing ? (
            <>
              <button
                onClick={handleSave}
                disabled={saving}
                title="Save"
                className="text-amber-400 hover:text-amber-300 disabled:opacity-50"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </button>
              <button onClick={handleCancel} title="Cancel" className="text-neutral-500 hover:text-neutral-300">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </>
          ) : (
            <button onClick={() => setIsEditing(true)} title="Edit" className="text-neutral-400 hover:text-amber-400">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
            </button>
          )}
          <button onClick={handleDelete} title="Delete" className="text-neutral-500 hover:text-red-400">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
          </button>
        </div>
      </td>
    </tr>
  );
}
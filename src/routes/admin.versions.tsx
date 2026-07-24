import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  setCurrentVersion,
  deleteVersion,
  updateVersion,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/versions")({
  component: VersionsAdmin,
});

function relTime(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function VersionsAdmin() {
  const router = useRouter();
  const makeCurrent = useServerFn(setCurrentVersion);
  const removeVersion = useServerFn(deleteVersion);
  const editVersion = useServerFn(updateVersion);
  const { data, refetch } = useQuery({
    queryKey: ["admin-versions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("versions")
        .select("*")
        .order("released_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editNotes, setEditNotes] = useState("");

  async function onMakeCurrent(id: string, semver: string) {
    if (!confirm(`Make v${semver} the current live version?`)) return;
    await makeCurrent({ data: { id } });
    toast.success(`v${semver} is now current`);
    refetch();
    router.invalidate();
  }

  async function onDelete(id: string, semver: string) {
    if (!confirm(`Permanently delete v${semver}? This cannot be undone.`)) return;
    try {
      await removeVersion({ data: { id } });
      toast.success(`Deleted v${semver}`);
      refetch();
      router.invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  }

  function startEdit(v: { id: string; title: string; notes: string | null }) {
    setEditingId(v.id);
    setEditTitle(v.title);
    setEditNotes(v.notes ?? "");
  }

  async function saveEdit() {
    if (!editingId) return;
    try {
      await editVersion({ data: { id: editingId, title: editTitle.trim(), notes: editNotes } });
      toast.success("Version updated");
      setEditingId(null);
      refetch();
      router.invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-3xl text-mn-blue uppercase tracking-wide mb-2">Version history</h1>
      <p className="text-sm text-dark-gray/70 mb-6">
        Versions are created automatically when you use <strong>Ship it live</strong> on the Now
        Building tab. Use this page to edit or delete a version if something needs correcting.
      </p>
      <ul className="space-y-3">
        {(data ?? []).length === 0 && (
          <li className="text-sm text-dark-gray/60 italic border-2 border-dashed border-light-gray rounded-lg p-6 text-center">
            No versions yet. Ship something live from the Now Building tab to create your first
            version.
          </li>
        )}
        {(data ?? []).map((v) => {
          const isEditing = editingId === v.id;
          return (
            <li
              key={v.id}
              className={`border rounded-lg p-4 ${
                v.is_current ? "border-mn-green bg-mn-green/5" : "border-light-gray"
              }`}
            >
              <div className="flex justify-between items-center">
                <span className="font-black text-mn-blue text-lg">v{v.semver}</span>
                {v.is_current && (
                  <span className="text-[10px] font-bold uppercase bg-mn-green text-white px-2 py-0.5 rounded">
                    Current
                  </span>
                )}
              </div>
              {isEditing ? (
                <div className="space-y-2 mt-2">
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full border-2 border-light-gray focus:border-mn-blue rounded px-3 py-2 text-sm outline-none"
                  />
                  <textarea
                    rows={4}
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    className="w-full border-2 border-light-gray focus:border-mn-blue rounded px-3 py-2 text-xs outline-none"
                  />
                </div>
              ) : (
                <>
                  <p className="font-semibold text-sm mt-1">{v.title}</p>
                  {v.notes && (
                    <p className="text-xs text-dark-gray/70 mt-1 whitespace-pre-wrap">{v.notes}</p>
                  )}
                </>
              )}
              <p className="text-[11px] text-dark-gray/50 mt-2 tabular-nums">
                {relTime(v.released_at)} · {new Date(v.released_at).toLocaleString()}
              </p>
              <div className="flex gap-2 mt-3 flex-wrap">
                {isEditing ? (
                  <>
                    <button
                      onClick={saveEdit}
                      disabled={!editTitle.trim()}
                      className="text-[11px] font-bold bg-mn-blue text-white px-3 py-1.5 rounded hover:brightness-110 disabled:opacity-40"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="text-[11px] font-bold bg-white border border-light-gray px-3 py-1.5 rounded hover:bg-light-gray/50"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => startEdit(v)}
                      className="text-[11px] font-bold bg-white border border-mn-blue text-mn-blue px-3 py-1.5 rounded hover:bg-mn-blue hover:text-white"
                    >
                      Edit
                    </button>
                    {!v.is_current && (
                      <button
                        onClick={() => onMakeCurrent(v.id, v.semver)}
                        className="text-[11px] font-bold bg-mn-green text-white px-3 py-1.5 rounded hover:brightness-110"
                      >
                        Make current
                      </button>
                    )}
                    <button
                      onClick={() => !v.is_current && onDelete(v.id, v.semver)}
                      disabled={v.is_current}
                      title={
                        v.is_current
                          ? "Make another version current first to delete this one."
                          : "Permanently delete this version"
                      }
                      className="text-[11px] font-bold bg-white border border-red-600 text-red-700 px-3 py-1.5 rounded hover:bg-red-600 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-red-700"
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

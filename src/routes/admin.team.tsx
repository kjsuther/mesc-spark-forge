import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  deleteTeamMember,
  listTeamMembersAdmin,
  reorderTeamMembers,
  upsertTeamMember,
  type TeamMember,
} from "@/lib/team.functions";
import { initialsOf } from "@/routes/about.team";

export const Route = createFileRoute("/admin/team")({
  head: () => ({
    meta: [
      { title: "Team — Admin" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminTeamPage,
});

type Draft = {
  id?: string;
  full_name: string;
  title: string;
  bio: string;
  hidden: boolean;
  photo_data_url: string | null;
  remove_photo: boolean;
  existing_photo_url: string | null;
};

const EMPTY: Draft = {
  full_name: "",
  title: "",
  bio: "",
  hidden: false,
  photo_data_url: null,
  remove_photo: false,
  existing_photo_url: null,
};

function toDraft(m: TeamMember): Draft {
  return {
    id: m.id,
    full_name: m.full_name,
    title: m.title,
    bio: m.bio ?? "",
    hidden: m.hidden,
    photo_data_url: null,
    remove_photo: false,
    existing_photo_url: m.photo_url,
  };
}

function AdminTeamPage() {
  const queryClient = useQueryClient();
  const fetchTeam = useServerFn(listTeamMembersAdmin);
  const save = useServerFn(upsertTeamMember);
  const remove = useServerFn(deleteTeamMember);
  const reorder = useServerFn(reorderTeamMembers);

  const [draft, setDraft] = useState<Draft | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["admin-team-members"],
    queryFn: () => fetchTeam(),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin-team-members"] });
    queryClient.invalidateQueries({ queryKey: ["team-members"] });
  }

  const saveMutation = useMutation({
    mutationFn: (d: Draft) =>
      save({
        data: {
          ...(d.id ? { id: d.id } : {}),
          full_name: d.full_name,
          title: d.title,
          bio: d.bio,
          hidden: d.hidden,
          photo_data_url: d.photo_data_url,
          remove_photo: d.remove_photo,
        },
      }),
    onSuccess: () => {
      toast.success("Saved");
      setDraft(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message || "Could not save"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Removed");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message || "Could not remove"),
  });

  const reorderMutation = useMutation({
    mutationFn: (ids: string[]) => reorder({ data: { ids } }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message || "Could not reorder"),
  });

  function move(index: number, delta: number) {
    const ids = members.map((m) => m.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    const next = [...ids];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved!);
    reorderMutation.mutate(next);
  }

  async function onPickPhoto(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5 MB.");
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Could not read file"));
      reader.readAsDataURL(file);
    });
    setDraft((d) => (d ? { ...d, photo_data_url: dataUrl, remove_photo: false } : d));
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl text-mn-blue uppercase tracking-wide">Team</h1>
          <p className="text-sm text-dark-gray/70 mt-1">
            These profiles power the public About Us page.
          </p>
        </div>
        <button
          onClick={() => setDraft({ ...EMPTY })}
          className="rounded-lg bg-mn-blue px-4 py-2 text-sm font-bold uppercase tracking-wide text-white hover:brightness-110"
        >
          + Add person
        </button>
      </header>

      {draft && (
        <section className="rounded-2xl border-2 border-mn-blue/20 bg-cream/50 p-5 space-y-4">
          <h2 className="font-bold text-mn-blue">{draft.id ? "Edit person" : "New person"}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold text-mn-blue">
              Name
              <input
                value={draft.full_name}
                onChange={(e) => setDraft({ ...draft, full_name: e.target.value })}
                maxLength={200}
                className="mt-1 w-full rounded-lg border border-mn-blue/25 bg-white px-3 py-2 text-sm font-normal text-dark-gray"
              />
            </label>
            <label className="text-sm font-semibold text-mn-blue">
              Title
              <input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                maxLength={300}
                className="mt-1 w-full rounded-lg border border-mn-blue/25 bg-white px-3 py-2 text-sm font-normal text-dark-gray"
              />
            </label>
          </div>
          <label className="block text-sm font-semibold text-mn-blue">
            Short bio (optional)
            <textarea
              value={draft.bio}
              onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
              maxLength={1000}
              rows={3}
              className="mt-1 w-full rounded-lg border border-mn-blue/25 bg-white px-3 py-2 text-sm font-normal text-dark-gray"
            />
          </label>

          <div className="flex flex-wrap items-center gap-4">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl ring-2 ring-mn-blue/20">
              {draft.photo_data_url || (draft.existing_photo_url && !draft.remove_photo) ? (
                <img
                  src={draft.photo_data_url ?? draft.existing_photo_url!}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="grid h-full w-full place-items-center bg-mn-blue text-cream font-display">
                  {initialsOf(draft.full_name || "?")}
                </div>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void onPickPhoto(file);
                e.target.value = "";
              }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="rounded-lg border-2 border-mn-blue/30 px-3 py-2 text-xs font-bold uppercase tracking-wide text-mn-blue hover:bg-white"
            >
              Upload photo
            </button>
            {(draft.existing_photo_url || draft.photo_data_url) && (
              <button
                onClick={() =>
                  setDraft({ ...draft, photo_data_url: null, remove_photo: true })
                }
                className="rounded-lg border-2 border-accent-orange/40 px-3 py-2 text-xs font-bold uppercase tracking-wide text-accent-orange hover:bg-white"
              >
                Remove photo
              </button>
            )}
            <label className="flex items-center gap-2 text-sm font-semibold text-mn-blue">
              <input
                type="checkbox"
                checked={draft.hidden}
                onChange={(e) => setDraft({ ...draft, hidden: e.target.checked })}
              />
              Hidden from public page
            </label>
          </div>

          <div className="flex gap-3">
            <button
              disabled={saveMutation.isPending || !draft.full_name.trim()}
              onClick={() => saveMutation.mutate(draft)}
              className="rounded-lg bg-mn-green px-4 py-2 text-sm font-bold uppercase tracking-wide text-white disabled:opacity-50"
            >
              {saveMutation.isPending ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => setDraft(null)}
              className="rounded-lg border-2 border-mn-blue/25 px-4 py-2 text-sm font-bold uppercase tracking-wide text-mn-blue"
            >
              Cancel
            </button>
          </div>
        </section>
      )}

      {isLoading ? (
        <p className="text-sm text-dark-gray/60">Loading…</p>
      ) : (
        <ul className="space-y-3">
          {members.map((m, i) => (
            <li
              key={m.id}
              className="flex flex-wrap items-center gap-4 rounded-2xl border-2 border-mn-blue/15 bg-white p-4"
            >
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl ring-2 ring-mn-blue/15">
                {m.photo_url ? (
                  <img src={m.photo_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full w-full place-items-center bg-mn-blue text-cream font-display text-sm">
                    {initialsOf(m.full_name)}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-mn-blue">
                  {m.full_name}
                  {m.hidden && (
                    <span className="ml-2 rounded bg-light-gray px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-dark-gray/70">
                      Hidden
                    </span>
                  )}
                </p>
                <p className="text-sm text-dark-gray/70">{m.title}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="rounded border border-mn-blue/25 px-2 py-1 text-xs font-bold text-mn-blue disabled:opacity-40"
                  aria-label={`Move ${m.full_name} up`}
                >
                  ↑
                </button>
                <button
                  onClick={() => move(i, 1)}
                  disabled={i === members.length - 1}
                  className="rounded border border-mn-blue/25 px-2 py-1 text-xs font-bold text-mn-blue disabled:opacity-40"
                  aria-label={`Move ${m.full_name} down`}
                >
                  ↓
                </button>
                <button
                  onClick={() => setDraft(toDraft(m))}
                  className="rounded border border-mn-blue/25 px-3 py-1 text-xs font-bold uppercase tracking-wide text-mn-blue"
                >
                  Edit
                </button>
                <button
                  onClick={() => {
                    if (window.confirm(`Remove ${m.full_name}?`)) deleteMutation.mutate(m.id);
                  }}
                  className="rounded border border-accent-orange/40 px-3 py-1 text-xs font-bold uppercase tracking-wide text-accent-orange"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

import { createServerFn } from "@tanstack/react-start";
import { requireAdmin } from "./admin-session.server";

export type TeamMember = {
  id: string;
  full_name: string;
  goes_by: string | null;
  title: string;
  organization: string | null;
  bio: string | null;
  photo_path: string | null;
  photo_url: string | null;
  sort_order: number;
  hidden: boolean;
};

const BUCKET = "team-photos";
const SIGN_TTL = 60 * 60 * 6;

async function withSignedUrls(
  rows: Array<Omit<TeamMember, "photo_url">>
): Promise<TeamMember[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const paths = rows.map((r) => r.photo_path).filter((p): p is string => !!p);
  const urls = new Map<string, string>();
  if (paths.length > 0) {
    const { data } = await supabaseAdmin.storage.from(BUCKET).createSignedUrls(paths, SIGN_TTL);
    for (const entry of data ?? []) {
      if (entry.path && entry.signedUrl) urls.set(entry.path, entry.signedUrl);
    }
  }
  return rows.map((r) => ({
    ...r,
    photo_url: r.photo_path ? (urls.get(r.photo_path) ?? null) : null,
  }));
}

export const listTeamMembers = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("team_members")
    .select("id, full_name, goes_by, title, organization, bio, photo_path, sort_order, hidden")
    .eq("hidden", false)
    .order("sort_order", { ascending: true })
    .order("full_name", { ascending: true });
  if (error) throw error;
  return withSignedUrls(data ?? []);
});

export const listTeamMembersAdmin = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("team_members")
    .select("id, full_name, goes_by, title, organization, bio, photo_path, sort_order, hidden")
    .order("sort_order", { ascending: true })
    .order("full_name", { ascending: true });
  if (error) throw error;
  return withSignedUrls(data ?? []);
});

export type UpsertTeamMemberInput = {
  id?: string;
  full_name: string;
  goes_by?: string | null;
  title: string;
  organization?: string | null;
  bio?: string | null;
  hidden?: boolean;
  /** base64 data URL of a new photo; when set it replaces the existing photo */
  photo_data_url?: string | null;
  /** set true to clear the existing photo */
  remove_photo?: boolean;
};

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export const upsertTeamMember = createServerFn({ method: "POST" })
  .inputValidator((data: UpsertTeamMemberInput) => data)
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const fullName = (data.full_name ?? "").trim();
    if (!fullName || fullName.length > 200) throw new Error("Name is required (max 200 chars).");
    const title = (data.title ?? "").trim().slice(0, 300);
    const bio = (data.bio ?? "").trim().slice(0, 1000) || null;

    let photoPath: string | null | undefined = undefined;

    if (data.photo_data_url) {
      const match = /^data:([^;]+);base64,(.+)$/.exec(data.photo_data_url);
      if (!match) throw new Error("Invalid image upload.");
      const contentType = match[1]!;
      if (!ALLOWED_TYPES.includes(contentType)) throw new Error("Unsupported image type.");
      const bytes = Buffer.from(match[2]!, "base64");
      if (bytes.byteLength > MAX_PHOTO_BYTES) throw new Error("Image must be under 5 MB.");
      const ext = contentType.split("/")[1]!.replace("jpeg", "jpg");
      const key = `uploads/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(key, bytes, { contentType, upsert: false });
      if (uploadError) throw uploadError;
      photoPath = key;
    } else if (data.remove_photo) {
      photoPath = null;
    }

    if (data.id) {
      const patch = {
        full_name: fullName,
        title,
        bio,
        hidden: !!data.hidden,
        ...(photoPath !== undefined ? { photo_path: photoPath } : {}),
      };
      const { error } = await supabaseAdmin.from("team_members").update(patch).eq("id", data.id);
      if (error) throw error;
      return { ok: true as const, id: data.id };
    }

    const { data: maxRow } = await supabaseAdmin
      .from("team_members")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: inserted, error } = await supabaseAdmin
      .from("team_members")
      .insert({
        full_name: fullName,
        title,
        bio,
        hidden: !!data.hidden,
        photo_path: photoPath ?? null,
        sort_order: (maxRow?.sort_order ?? 0) + 10,
      })
      .select("id")
      .single();
    if (error) throw error;
    return { ok: true as const, id: inserted.id };
  });

export const deleteTeamMember = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("team_members").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true as const };
  });

export const reorderTeamMembers = createServerFn({ method: "POST" })
  .inputValidator((data: { ids: string[] }) => data)
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let order = 10;
    for (const id of data.ids) {
      const { error } = await supabaseAdmin
        .from("team_members")
        .update({ sort_order: order })
        .eq("id", id);
      if (error) throw error;
      order += 10;
    }
    return { ok: true as const };
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: any; userId: string };
async function assertAccess(ctx: Ctx) {
  const { data, error } = await ctx.supabase.rpc("has_commercial_access", { _user_id: ctx.userId });
  if (error || data !== true) throw new Error("Sem permissão.");
}
async function assertAdmin(ctx: Ctx) {
  const { data, error } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (error || data !== true) throw new Error("Só o super admin pode gerir a equipa.");
}

export const listCommercialTeam = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await assertAccess(context as Ctx);
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const { data: roles, error } = await db.from("user_roles").select("user_id, role").in("role", ["sdr", "closer"]);
  if (error) throw new Error("Não foi possível carregar a equipa.");
  const ids = [...new Set((roles ?? []).map(r => r.user_id))];
  if (!ids.length) return [];
  const { data: profiles } = await db.from("profiles").select("id, display_name, avatar_url").in("id", ids);
  const out = [];
  for (const id of ids) {
    const p = profiles?.find(x => x.id === id);
    let photo: string | null = p?.avatar_url ?? null;
    if (photo && !/^https?:/.test(photo)) {
      const { data } = await db.storage.from("avatars").createSignedUrl(photo, 3600);
      photo = data?.signedUrl ?? null;
    }
    const { data: u } = await db.auth.admin.getUserById(id);
    out.push({ id, name: p?.display_name ?? null, photo, email: u?.user?.email ?? null, role: (roles ?? []).find(r => r.user_id === id)!.role as "sdr" | "closer" });
  }
  return out.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
});

export const addCommercialTeamMember = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ email: z.string().trim().email(), role: z.enum(["sdr", "closer"]) }).parse(i))
  .handler(async ({ context, data }) => {
    await assertAdmin(context as Ctx);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const email = data.email.toLowerCase();
    let userId: string | null = null;
    for (let page = 1; page <= 10 && !userId; page++) {
      const { data: list, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw new Error("Não foi possível procurar a conta.");
      userId = list.users.find(u => u.email?.toLowerCase() === email)?.id ?? null;
      if (list.users.length < 1000) break;
    }
    if (!userId) throw new Error("Não existe conta com este email. Cria primeiro a conta em Utilizadores.");
    const { error } = await context.supabase.rpc("set_commercial_role", { _user_id: userId, _role: data.role });
    if (error) throw new Error("Não foi possível adicionar à equipa.");
    return { ok: true };
  });

export const updateCommercialTeamMember = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    userId: z.string().uuid(), name: z.string().trim().min(2).max(80), role: z.enum(["sdr", "closer"]),
    photo: z.object({ base64: z.string().max(4_000_000), type: z.enum(["image/jpeg", "image/png", "image/webp"]) }).optional(),
  }).parse(i))
  .handler(async ({ context, data }) => {
    await assertAdmin(context as Ctx);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const update: { display_name: string; avatar_url?: string } = { display_name: data.name };
    if (data.photo) {
      const bytes = Uint8Array.from(atob(data.photo.base64), c => c.charCodeAt(0));
      if (bytes.length > 3_000_000) throw new Error("Foto demasiado grande (máx. 3 MB).");
      const ext = data.photo.type.split("/")[1];
      const path = `${data.userId}/avatar-${Date.now()}.${ext}`;
      const { error } = await db.storage.from("avatars").upload(path, bytes, { contentType: data.photo.type, upsert: true });
      if (error) throw new Error("Não foi possível enviar a foto.");
      update.avatar_url = path;
    }
    const { error } = await db.from("profiles").update(update).eq("id", data.userId);
    if (error) throw new Error("Não foi possível guardar.");
    const { error: rErr } = await context.supabase.rpc("set_commercial_role", { _user_id: data.userId, _role: data.role });
    if (rErr) throw new Error("Não foi possível alterar o cargo.");
    return { ok: true };
  });

export const removeCommercialTeamMember = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ userId: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    await assertAdmin(context as Ctx);
    const { error } = await context.supabase.rpc("set_commercial_role", { _user_id: data.userId, _role: "none" });
    if (error) throw new Error("Não foi possível remover.");
    return { ok: true };
  });

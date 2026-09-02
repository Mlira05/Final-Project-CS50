// CS50 Final Project — functions/api/reserve-entries.ts: Cloudflare Pages API endpoint.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
import { requireProfileAccess } from "../_shared/auth";
import {
  apiError,
  json,
  methodNotAllowed,
  optionalText,
  parseId,
  parsePositiveAmount,
  readJson,
  requiredText,
} from "../_shared/http";
import type { Env, ReserveEntryRow } from "../_shared/types";

interface ReserveEntryBody {
  id?: unknown;
  profile_id?: unknown;
  profileId?: unknown;
  name?: unknown;
  purpose?: unknown;
  amount?: unknown;
  notes?: unknown;
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (request.method === "GET") {
      const url = new URL(request.url);
      const profileId = parseId(url.searchParams.get("profileId"), "profileId");
      const auth = await requireProfileAccess(request, env, profileId);
      if (auth) {
        return auth;
      }

      const { results } = await env.DB.prepare(
        "SELECT * FROM reserve_entries WHERE profile_id = ? ORDER BY created_at DESC",
      )
        .bind(profileId)
        .all<ReserveEntryRow>();

      return json({ entries: results ?? [] });
    }

    if (request.method === "POST") {
      const body = await readJson<ReserveEntryBody>(request);
      const profileId = parseId(body.profile_id ?? body.profileId, "profileId");
      const auth = await requireProfileAccess(request, env, profileId);
      if (auth) {
        return auth;
      }

      const name = requiredText(body.name, "Nome do cofrinho");
      const purpose = requiredText(body.purpose, "Finalidade");
      const amount = parsePositiveAmount(body.amount, "Valor do cofrinho");
      const notes = optionalText(body.notes);
      const entry = await env.DB.prepare(
        `INSERT INTO reserve_entries (profile_id, name, purpose, amount, notes)
         VALUES (?, ?, ?, ?, ?)
         RETURNING *`,
      )
        .bind(profileId, name, purpose, amount, notes)
        .first<ReserveEntryRow>();

      return json({ entry }, 201);
    }

    if (request.method === "PUT") {
      const body = await readJson<ReserveEntryBody>(request);
      const id = parseId(body.id);
      const existing = await env.DB.prepare("SELECT * FROM reserve_entries WHERE id = ?").bind(id).first<ReserveEntryRow>();
      if (!existing) {
        return apiError("Cofrinho não encontrado.", 404);
      }

      const auth = await requireProfileAccess(request, env, existing.profile_id);
      if (auth) {
        return auth;
      }

      const name = requiredText(body.name, "Nome do cofrinho");
      const purpose = requiredText(body.purpose, "Finalidade");
      const amount = parsePositiveAmount(body.amount, "Valor do cofrinho");
      const notes = optionalText(body.notes);
      const entry = await env.DB.prepare(
        `UPDATE reserve_entries
         SET name = ?, purpose = ?, amount = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?
         RETURNING *`,
      )
        .bind(name, purpose, amount, notes, id)
        .first<ReserveEntryRow>();

      if (!entry) {
        return apiError("Cofrinho não encontrado.", 404);
      }

      return json({ entry });
    }

    if (request.method === "DELETE") {
      const body = await readJson<ReserveEntryBody>(request);
      const id = parseId(body.id);
      const existing = await env.DB.prepare("SELECT * FROM reserve_entries WHERE id = ?").bind(id).first<ReserveEntryRow>();
      if (existing) {
        const auth = await requireProfileAccess(request, env, existing.profile_id);
        if (auth) {
          return auth;
        }
      }

      await env.DB.prepare("DELETE FROM reserve_entries WHERE id = ?").bind(id).run();
      return json({ ok: true });
    }

    return methodNotAllowed();
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Falha na requisição de cofrinhos.", 400);
  }
};

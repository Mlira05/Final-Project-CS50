// CS50 Final Project — functions/api/profile-pin.ts: Cloudflare Pages API endpoint.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
import { hashPin, requireProfileAccess } from "../_shared/auth";
import { apiError, json, methodNotAllowed, parseId, readJson, requiredText } from "../_shared/http";
import type { Env, ProfileRow } from "../_shared/types";

interface PinBody {
  profileId?: unknown;
  currentPin?: unknown;
  newPin?: unknown;
}

function newSalt(profileId: number) {
  return `profile-${profileId}-${crypto.randomUUID()}`;
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (request.method !== "PUT") {
    return methodNotAllowed();
  }

  try {
    const body = await readJson<PinBody>(request);
    const profileId = parseId(body.profileId, "profileId");
    const auth = await requireProfileAccess(request, env, profileId);
    if (auth) {
      return auth;
    }

    const newPin = requiredText(body.newPin, "Novo PIN");
    if (newPin.length < 4) {
      return apiError("O novo PIN precisa ter pelo menos 4 caracteres.", 400);
    }

    const profile = await env.DB.prepare("SELECT * FROM profiles WHERE id = ?")
      .bind(profileId)
      .first<ProfileRow>();

    if (!profile) {
      return apiError("Perfil não encontrado.", 404);
    }

    const salt = newSalt(profileId);
    const pinHash = await hashPin(newPin, salt);
    await env.DB.prepare(
      "UPDATE profiles SET pin_hash = ?, pin_salt = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    )
      .bind(pinHash, salt, profileId)
      .run();

    return json({ ok: true });
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Não foi possível alterar o PIN.", 400);
  }
};

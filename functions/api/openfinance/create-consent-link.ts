// CS50 Final Project — functions/api/openfinance/create-consent-link.ts: Cloudflare Pages API endpoint.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
import { requireExistingProfile } from "../../_shared/auth";
import { getDbFeatureFlags } from "../../_shared/db-schema";
import { apiError, json, methodNotAllowed, parseId, readJson } from "../../_shared/http";
import type { Env } from "../../_shared/types";

interface ConsentLinkBody {
  profileId?: unknown;
  profile_id?: unknown;
}

function appBaseUrl(request: Request) {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (request.method !== "POST") {
    return methodNotAllowed();
  }

  try {
    const body = await readJson<ConsentLinkBody>(request);
    const profileId = parseId(body.profileId ?? body.profile_id, "profileId");
    const auth = await requireExistingProfile(request, env, profileId);
    if (auth) {
      return auth;
    }

    const authorizationUrl = env.CUMBUCA_AUTHORIZATION_URL;
    const clientId = env.CUMBUCA_MCP_CLIENT_ID;
    const redirectUri = env.CUMBUCA_REDIRECT_URI ?? `${appBaseUrl(request)}/api/openfinance/callback`;

    if (!authorizationUrl || !clientId || !redirectUri) {
      return json({
        url: null,
        mode: "manual_token",
        message:
          "Fluxo externo Cumbuca ainda nao configurado. Use a configuracao manual temporaria com tokens do perfil.",
      });
    }

    const schema = await getDbFeatureFlags(env.DB);
    const nonce = crypto.randomUUID();
    const state = crypto.randomUUID();
    if (schema.hasCumbucaConsentStates) {
      await env.DB
        .prepare("INSERT INTO cumbuca_consent_states (state, profile_id, nonce) VALUES (?, ?, ?)")
        .bind(state, profileId, nonce)
        .run();
    }

    const url = new URL(authorizationUrl);
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid profile offline_access open-finance");
    url.searchParams.set("state", state);
    url.searchParams.set("nonce", nonce);

    return json({
      url: url.toString(),
      mode: "external_link",
      message: "Abra a autorizacao Cumbuca e conclua o consentimento para salvar a conexao deste perfil.",
    });
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Nao foi possivel criar o link de consentimento Cumbuca.", 400);
  }
};

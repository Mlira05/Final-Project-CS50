// CS50 Final Project — functions/_shared/auth.ts: Shared server-side domain or infrastructure module.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
import { apiError, json, readJson } from "./http";
import type { Env, ProfileRow, PublicProfileRow } from "./types";

const COOKIE_NAME = "finance_session";
const SESSION_SECONDS = 60 * 60 * 24 * 30;

interface LoginBody {
  profileId?: unknown;
  pin?: unknown;
}

interface AuthState {
  authenticated: boolean;
  configured: boolean;
  mode: "profile" | "pin" | "access" | "locked";
  profileId: number | null;
  profileName: string | null;
  user: string | null;
}

function getCookie(request: Request, name: string) {
  const cookie = request.headers.get("cookie") ?? "";
  const parts = cookie.split(";").map((part) => part.trim());
  const match = parts.find((part) => part.startsWith(`${name}=`));

  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

function isLocalRequest(request: Request) {
  const hostname = new URL(request.url).hostname;
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

async function hmac(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function hashPin(pin: string, salt: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:${pin}`));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function equalSignature(left: string, right: string) {
  if (left.length !== right.length) {
    return false;
  }

  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return result === 0;
}

function sessionSecret(env: Env) {
  return env.SESSION_SECRET || env.APP_PIN || "";
}

async function verifySessionCookie(request: Request, env: Env) {
  const secret = sessionSecret(env);
  if (!secret) {
    return null;
  }

  const cookie = getCookie(request, COOKIE_NAME);
  if (!cookie) {
    return null;
  }

  const [expires, scope, signature] = cookie.split(".");
  const expiry = Number(expires);
  if (!expires || !scope || !signature || !Number.isFinite(expiry) || expiry < Date.now()) {
    return null;
  }

  const expected = await hmac(secret, `${expires}.${scope}`);
  if (!equalSignature(signature, expected)) {
    return null;
  }

  if (scope === "admin") {
    return { admin: true, profileId: null };
  }

  if (scope.startsWith("profile:")) {
    const profileId = Number(scope.slice("profile:".length));
    if (Number.isInteger(profileId) && profileId > 0) {
      return { admin: false, profileId };
    }
  }

  return null;
}

export async function createSessionCookie(request: Request, env: Env, profileId?: number) {
  const secret = sessionSecret(env);
  if (!secret) {
    throw new Error("APP_PIN or SESSION_SECRET must be configured.");
  }

  const expires = String(Date.now() + SESSION_SECONDS * 1000);
  const scope = profileId ? `profile:${profileId}` : "admin";
  const signature = await hmac(secret, `${expires}.${scope}`);
  const secure = isLocalRequest(request) ? "" : "; Secure";

  return `${COOKIE_NAME}=${encodeURIComponent(`${expires}.${scope}.${signature}`)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_SECONDS}${secure}`;
}

export function clearSessionCookie(request: Request) {
  const secure = isLocalRequest(request) ? "" : "; Secure";
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
}

export async function getAuthState(request: Request, env: Env): Promise<AuthState> {
  const accessEnabled = env.ALLOW_CLOUDFLARE_ACCESS === "true";
  const accessUser = request.headers.get("Cf-Access-Authenticated-User-Email");

  if (accessEnabled && accessUser) {
    return {
      authenticated: true,
      configured: true,
      mode: "access",
      profileId: null,
      profileName: null,
      user: accessUser,
    };
  }

  const session = await verifySessionCookie(request, env);
  if (session?.profileId) {
    const profile = await env.DB.prepare(
      "SELECT id, name, created_at, updated_at FROM profiles WHERE id = ?",
    )
      .bind(session.profileId)
      .first<PublicProfileRow>();

    if (profile) {
      return {
        authenticated: true,
        configured: true,
        mode: "profile",
        profileId: profile.id,
        profileName: profile.name,
        user: null,
      };
    }
  }

  if (session?.admin) {
    return {
      authenticated: true,
      configured: true,
      mode: "pin",
      profileId: null,
      profileName: null,
      user: null,
    };
  }

  const profileCount = await env.DB.prepare("SELECT COUNT(*) AS total FROM profiles WHERE pin_hash IS NOT NULL").first<{
    total: number;
  }>();
  const hasProfilePins = (profileCount?.total ?? 0) > 0;

  return {
    authenticated: false,
    configured: hasProfilePins || Boolean(env.APP_PIN) || accessEnabled,
    mode: hasProfilePins ? "profile" : env.APP_PIN ? "pin" : accessEnabled ? "access" : "locked",
    profileId: null,
    profileName: null,
    user: null,
  };
}

function authErrorForState(state: AuthState) {
  if (!state.configured) {
    return apiError("Configure um PIN do app ou o Cloudflare Access antes de usar.", 503);
  }

  return apiError("Faça login para continuar.", 401);
}

export async function requireAuth(request: Request, env: Env) {
  const state = await getAuthState(request, env);

  if (state.authenticated) {
    return null;
  }

  return authErrorForState(state);
}

export async function requireAppAccess(request: Request, env: Env) {
  const state = await getAuthState(request, env);

  if (!state.authenticated) {
    return authErrorForState(state);
  }

  return null;
}

export async function requireExistingProfile(request: Request, env: Env, profileId: number) {
  const auth = await requireAppAccess(request, env);
  if (auth) {
    return auth;
  }

  const profile = await env.DB.prepare("SELECT id FROM profiles WHERE id = ?").bind(profileId).first<{ id: number }>();
  if (!profile) {
    return apiError("Perfil não encontrado.", 404);
  }

  return null;
}

export async function requireProfileAccess(request: Request, env: Env, profileId: number) {
  return requireExistingProfile(request, env, profileId);
}

export async function getSessionProfileId(request: Request, env: Env) {
  const state = await getAuthState(request, env);
  return state.profileId;
}

export async function listLoginProfiles(env: Env) {
  const { results } = await env.DB.prepare(
    "SELECT id, name, created_at, updated_at FROM profiles ORDER BY id ASC",
  ).all<PublicProfileRow>();

  return results ?? [];
}

export async function handleAuthStatus(request: Request, env: Env) {
  const state = await getAuthState(request, env);
  return json(state);
}

export async function handleLogin(request: Request, env: Env) {
  if (request.method !== "POST") {
    return apiError("Método não permitido.", 405);
  }

  if (!env.APP_PIN) {
    const count = await env.DB.prepare("SELECT COUNT(*) AS total FROM profiles WHERE pin_hash IS NOT NULL").first<{
      total: number;
    }>();
    if ((count?.total ?? 0) === 0) {
      return apiError("Nenhum PIN foi configurado ainda.", 503);
    }
  }

  const body = await readJson<LoginBody>(request);
  const pin = String(body.pin ?? "");
  const profileId = Number(body.profileId);

  if (Number.isInteger(profileId) && profileId > 0) {
    const profile = await env.DB.prepare("SELECT * FROM profiles WHERE id = ?")
      .bind(profileId)
      .first<ProfileRow>();

    if (!profile?.pin_hash || !profile.pin_salt) {
      return apiError("Este perfil ainda não tem PIN configurado.", 400);
    }

    const candidateHash = await hashPin(pin, profile.pin_salt);
    if (!equalSignature(candidateHash, profile.pin_hash)) {
      return apiError("PIN incorreto.", 401);
    }

    const response = json({ ok: true, profileId: profile.id });
    response.headers.append("set-cookie", await createSessionCookie(request, env, profile.id));

    return response;
  }

  if (!env.APP_PIN || pin !== env.APP_PIN) {
    return apiError("PIN incorreto.", 401);
  }

  const response = json({ ok: true });
  response.headers.append("set-cookie", await createSessionCookie(request, env));

  return response;
}

export function handleLogout(request: Request) {
  const response = json({ ok: true });
  response.headers.append("set-cookie", clearSessionCookie(request));

  return response;
}

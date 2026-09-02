// CS50 Final Project — functions/_shared/crypto.ts: Shared server-side domain or infrastructure module.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
import type { Env } from "./types";

const version = "v1";

function base64Encode(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function base64Decode(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

async function encryptionKey(env: Env) {
  const secret = env.OPEN_FINANCE_TOKEN_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error("Configure OPEN_FINANCE_TOKEN_ENCRYPTION_KEY como secret do Cloudflare para salvar tokens Open Finance.");
  }

  const material = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", material, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptSecret(env: Env, plaintext: string | null | undefined) {
  const value = String(plaintext ?? "").trim();
  if (!value) {
    return null;
  }

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await encryptionKey(env);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(value));

  return `${version}:${base64Encode(iv)}:${base64Encode(new Uint8Array(ciphertext))}`;
}

export async function decryptSecret(env: Env, encryptedValue: string | null | undefined) {
  const value = String(encryptedValue ?? "").trim();
  if (!value) {
    return null;
  }

  const [storedVersion, ivBase64, ciphertextBase64] = value.split(":");
  if (storedVersion !== version || !ivBase64 || !ciphertextBase64) {
    throw new Error("Token Open Finance criptografado em formato inválido.");
  }

  const key = await encryptionKey(env);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64Decode(ivBase64) },
    key,
    base64Decode(ciphertextBase64),
  );

  return new TextDecoder().decode(plaintext);
}

export async function hashPrivateValue(env: Env, value: string) {
  const salt = env.SESSION_SECRET || env.OPEN_FINANCE_TOKEN_ENCRYPTION_KEY || env.APP_PIN;
  if (!salt) {
    throw new Error("Configure SESSION_SECRET ou OPEN_FINANCE_TOKEN_ENCRYPTION_KEY para proteger documentos.");
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(salt),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));

  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

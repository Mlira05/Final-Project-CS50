// CS50 Final Project — functions/_shared/http.ts: Shared server-side domain or infrastructure module.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
export function json(data: unknown, init: ResponseInit | number = 200) {
  const responseInit = typeof init === "number" ? { status: init } : init;

  return new Response(JSON.stringify(data), {
    ...responseInit,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(responseInit.headers ?? {}),
    },
  });
}

export function apiError(message: string, status = 400, details?: unknown) {
  return json({ error: message, details }, status);
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new Error("Envie um JSON válido no corpo da requisição.");
  }
}

export function methodNotAllowed() {
  return apiError("Método não permitido.", 405);
}

export function parseId(value: unknown, label = "id") {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(`${label} precisa ser um id válido.`);
  }

  return id;
}

export function parseAmount(value: unknown, label = "amount") {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    throw new Error(`${label} precisa ser um número válido.`);
  }

  return Math.round(amount * 100) / 100;
}

export function parsePositiveAmount(value: unknown, label = "amount") {
  const amount = parseAmount(value, label);
  if (amount <= 0) {
    throw new Error(`${label} precisa ser maior que zero.`);
  }

  return amount;
}

export function parseNonNegativeAmount(value: unknown, label = "amount") {
  const amount = parseAmount(value, label);
  if (amount < 0) {
    throw new Error(`${label} não pode ser negativo.`);
  }

  return amount;
}

export function parseMonth(value: unknown) {
  const month = Number(value);
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("O mês precisa estar entre 1 e 12.");
  }

  return month;
}

export function parseYear(value: unknown) {
  const year = Number(value);
  if (!Number.isInteger(year) || year < 2000 || year > 2200) {
    throw new Error("O ano precisa ser válido.");
  }

  return year;
}

export function requiredText(value: unknown, label: string) {
  const text = String(value ?? "").trim();
  if (!text) {
    throw new Error(`${label} é obrigatório.`);
  }

  return text;
}

export function optionalText(value: unknown) {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

export function parseDate(value: unknown, label: string) {
  const text = requiredText(value, label);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(`${text}T00:00:00Z`))) {
    throw new Error(`${label} precisa ser uma data válida.`);
  }

  return text;
}

export function monthRange(month: number, year: number) {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const end = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;

  return { start, end };
}

export function boolToInt(value: unknown) {
  return value === true || value === "true" || value === 1 ? 1 : 0;
}

export function parseInteger(value: unknown, label = "value", options: { min?: number; max?: number } = {}) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${label} precisa ser um número inteiro válido.`);
  }

  if (options.min !== undefined && parsed < options.min) {
    throw new Error(`${label} precisa ser maior ou igual a ${options.min}.`);
  }

  if (options.max !== undefined && parsed > options.max) {
    throw new Error(`${label} precisa ser menor ou igual a ${options.max}.`);
  }

  return parsed;
}

export function parseEnum<T extends string>(
  value: unknown,
  label: string,
  allowedValues: readonly T[],
  fallback?: T,
) {
  const normalized = optionalText(value);
  if (!normalized) {
    if (fallback !== undefined) {
      return fallback;
    }

    throw new Error(`${label} é obrigatório.`);
  }

  if (!allowedValues.includes(normalized as T)) {
    throw new Error(`${label} precisa ser um valor válido.`);
  }

  return normalized as T;
}

export function parseColor(value: unknown, fallback = "#94a3b8") {
  const normalized = optionalText(value) ?? fallback;
  if (!/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(normalized)) {
    throw new Error("Cor precisa estar em hexadecimal válido.");
  }

  return normalized;
}

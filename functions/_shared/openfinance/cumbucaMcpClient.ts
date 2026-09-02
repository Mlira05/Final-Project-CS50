// CS50 Final Project — functions/_shared/openfinance/cumbucaMcpClient.ts: Shared server-side domain or infrastructure module.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
import type { Env } from "../types";
import type { CumbucaCredentials } from "./connections";

type CumbucaToolName =
  | "get_consent_status"
  | "list_accounts"
  | "list_account_transactions"
  | "list_credit_cards"
  | "list_credit_card_bills"
  | "list_credit_card_bill_transactions";

interface McpResponse {
  result?: {
    content?: Array<{ type: string; text?: string }>;
    isError?: boolean;
  };
  error?: {
    message?: string;
    data?: unknown;
  };
}

interface McpRequestResult {
  response: Response;
  payload: McpResponse;
}

const defaultMcpUrl = "https://mcp.cumbuca.com/mcp";
const defaultTokenUrl = "https://idc.cumbuca.com/realms/cumbuca-mcp/protocol/openid-connect/token";

export function friendlyMcpError(message = "Falha ao consultar o Cumbuca Open Finance.") {
  const normalized = (() => {
    try {
      const parsed = JSON.parse(message) as { error?: string; message?: string };
      return parsed.message || parsed.error || message;
    } catch {
      return message;
    }
  })();

  const lower = normalized.toLowerCase();
  if (lower.includes("unauthorized") || normalized.includes("401")) {
    return "A conexão com o Cumbuca precisa ser autenticada novamente.";
  }

  if (lower.includes("upstream_unavailable") || lower.includes("temporarily unavailable")) {
    return "O serviço financeiro está temporariamente indisponível. Tente atualizar novamente em alguns instantes.";
  }

  return normalized;
}

async function refreshAccessToken(env: Env, credentials?: CumbucaCredentials) {
  const refreshToken = credentials?.refreshToken ?? env.CUMBUCA_MCP_REFRESH_TOKEN;
  const clientId = credentials?.clientId ?? env.CUMBUCA_MCP_CLIENT_ID;

  if (!refreshToken || !clientId) {
    return null;
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    refresh_token: refreshToken,
    scope: "openid profile offline_access open-finance",
    resource: "https://mcp.cumbuca.com",
  });

  const response = await fetch(credentials?.tokenUrl ?? env.CUMBUCA_MCP_TOKEN_URL ?? defaultTokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  const accessToken = payload.access_token ?? null;

  if (accessToken && credentials?.onTokensRefreshed) {
    await credentials.onTokensRefreshed({
      accessToken,
      refreshToken: payload.refresh_token ?? null,
      expiresIn: payload.expires_in ?? null,
    });
  }

  return accessToken;
}

export class CumbucaMcpClient {
  private readonly url: string;
  private accessToken: string | null;
  private sessionId: string | null = null;

  constructor(
    private readonly env: Env,
    private readonly credentials?: CumbucaCredentials,
  ) {
    this.url = credentials?.mcpUrl ?? env.CUMBUCA_MCP_URL ?? defaultMcpUrl;
    this.accessToken = credentials?.accessToken ?? env.CUMBUCA_MCP_ACCESS_TOKEN ?? null;
  }

  private async token() {
    if (this.accessToken) {
      return this.accessToken;
    }

    this.accessToken = await refreshAccessToken(this.env, this.credentials);
    if (!this.accessToken) {
      throw new Error(
        "Configure uma conexão Open Finance do perfil ou os secrets globais legados do Cumbuca no Cloudflare.",
      );
    }

    return this.accessToken;
  }

  private async request(body: unknown, sessionId = this.sessionId, retryRefresh = true): Promise<McpRequestResult> {
    const token = await this.token();
    const headers: Record<string, string> = {
      accept: "application/json, text/event-stream",
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    };

    if (sessionId) {
      headers["mcp-session-id"] = sessionId;
    }

    const response = await fetch(this.url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (response.status === 401 && retryRefresh) {
      this.accessToken = await refreshAccessToken(this.env, this.credentials);
      if (this.accessToken) {
        return this.request(body, sessionId, false);
      }
    }

    const text = await response.text();
    if (!response.ok) {
      throw new Error(friendlyMcpError(`Cumbuca respondeu HTTP ${response.status}.`));
    }

    return {
      response,
      payload: JSON.parse(text) as McpResponse,
    };
  }

  private async initialize() {
    if (this.sessionId) {
      return;
    }

    const initialized = await this.request(
      {
        jsonrpc: "2.0",
        id: "initialize",
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "cs50-personal-finances", version: "1.0.0" },
        },
      },
      null,
    );

    this.sessionId = initialized.response.headers.get("mcp-session-id");
    await this.request({ jsonrpc: "2.0", method: "notifications/initialized", params: {} });
  }

  async callTool<T>(name: CumbucaToolName, args: Record<string, unknown> = {}) {
    await this.initialize();

    const { payload } = await this.request({
      jsonrpc: "2.0",
      id: `call-${name}`,
      method: "tools/call",
      params: { name, arguments: args },
    });

    if (payload.error) {
      throw new Error(friendlyMcpError(payload.error.message));
    }

    if (payload.result?.isError) {
      const message = payload.result.content?.find((item: { type: string; text?: string }) => item.text)?.text;
      throw new Error(friendlyMcpError(message));
    }

    const text = payload.result?.content?.find((item: { type: string; text?: string }) => item.type === "text" && item.text)?.text;
    if (!text) {
      return {} as T;
    }

    return JSON.parse(text) as T;
  }
}

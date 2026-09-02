// CS50 Final Project — functions/_shared/category-normalizer.ts: Shared server-side domain or infrastructure module.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
export type CategoryRuleMatchType = "merchant" | "description" | "original_category" | "contains";

export interface NormalizeOpenFinanceCategoryInput {
  originalCategory?: string | null;
  description?: string | null;
  merchantName?: string | null;
  transactionKind?: string | null;
}

export interface CategoryRuleLike {
  match_type: CategoryRuleMatchType | string;
  pattern: string | null;
  category: string | null;
  priority?: number | null;
  is_active?: number | boolean | null;
}

interface PreparedInput {
  originalCategory: string | null;
  description: string | null;
  merchantName: string | null;
  transactionKind: string | null;
  normalizedOriginalCategory: string;
  normalizedDescription: string;
  normalizedMerchantName: string;
  normalizedTransactionKind: string;
  normalizedCombinedText: string;
}

interface NativeRule {
  category: string;
  terms: string[];
}

export const EFFECTIVE_CATEGORY_SQL =
  "COALESCE(NULLIF(user_category, ''), NULLIF(system_category, ''), NULLIF(original_category, ''), 'Sem categoria')";

const nativeRules: NativeRule[] = [
  { category: "Mercado", terms: ["mercado", "supermercado", "hortifruti", "acougue"] },
  { category: "Delivery", terms: ["ifood", "rappi", "delivery"] },
  { category: "Restaurantes", terms: ["restaurante", "restaurant", "lanchonete", "padaria", "cafe"] },
  { category: "Uber/99/Táxi", terms: ["uber", " 99 ", "99app", "cabify", "taxi"] },
  { category: "Combustível", terms: ["posto", "shell", "ipiranga", "petrobras", "gasolina", "combustivel"] },
  { category: "Farmácia", terms: ["farmacia", "drogaria", "drogasil", "raia", "pacheco"] },
  {
    category: "Assinaturas",
    terms: ["netflix", "spotify", "youtube", "prime", "amazon prime", "disney", "max", "hbo", "icloud", "google", "apple.com/bill"],
  },
  { category: "Hospedagem", terms: ["booking", "airbnb", "hotel", "pousada", "hostel"] },
  { category: "Passagens", terms: ["latam", "gol", "azul", "decolar", "123milhas", "passagem"] },
  { category: "Lazer", terms: ["cinema", "teatro", "lazer", "entretenimento", "ingresso"] },
  { category: "Educação", terms: ["escola", "curso", "faculdade", "educacao"] },
  { category: "Moradia", terms: ["aluguel", "condominio"] },
  { category: "Contas", terms: ["energia", "luz", "agua", "internet", "telefone"] },
  { category: "Impostos/Taxas", terms: ["imposto", "taxa", "tarifa", "iof"] },
  { category: "Saúde", terms: ["saude", "hospital", "clinica", "consulta", "exame"] },
  { category: "Viagem", terms: ["viagem", "travel", "turismo"] },
  { category: "Investimentos", terms: ["investimento", "corretora", "tesouro", "cdb"] },
  { category: "Transferências", terms: ["pix", "ted", "doc", "transferencia"] },
  { category: "Renda", terms: ["salario", "salário", "pro labore", "recebimento", "rendimento"] },
  { category: "Compras", terms: ["shopping", "magalu", "mercado livre", "amazon", "compra"] },
  { category: "Alimentação", terms: ["alimentacao", "alimento", "food", "meal"] },
];

function trimmedText(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized : null;
}

export function normalizeComparableText(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function prepareInput(input: NormalizeOpenFinanceCategoryInput): PreparedInput {
  const originalCategory = trimmedText(input.originalCategory);
  const description = trimmedText(input.description);
  const merchantName = trimmedText(input.merchantName);
  const transactionKind = trimmedText(input.transactionKind);

  const normalizedOriginalCategory = normalizeComparableText(originalCategory);
  const normalizedDescription = normalizeComparableText(description);
  const normalizedMerchantName = normalizeComparableText(merchantName);
  const normalizedTransactionKind = normalizeComparableText(transactionKind);
  const normalizedCombinedText = [
    normalizedOriginalCategory,
    normalizedDescription,
    normalizedMerchantName,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    originalCategory,
    description,
    merchantName,
    transactionKind,
    normalizedOriginalCategory,
    normalizedDescription,
    normalizedMerchantName,
    normalizedTransactionKind,
    normalizedCombinedText,
  };
}

function includesTerm(text: string, term: string) {
  if (!text || !term) {
    return false;
  }

  if (term.startsWith(" ") || term.endsWith(" ")) {
    return ` ${text} `.includes(term);
  }

  return text.includes(term);
}

function firstPresentCategory(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const trimmed = trimmedText(value);
    if (trimmed) {
      return trimmed;
    }
  }

  return null;
}

function nativeMatch(input: PreparedInput) {
  if (input.normalizedTransactionKind === "bank_income") {
    return "Renda";
  }

  if (input.normalizedTransactionKind === "transfer" || input.normalizedTransactionKind === "refund") {
    return "Transferências";
  }

  if (input.normalizedTransactionKind === "investment_transfer") {
    return "Investimentos";
  }

  for (const rule of nativeRules) {
    if (rule.terms.some((term) => includesTerm(input.normalizedCombinedText, term))) {
      return rule.category;
    }
  }

  return null;
}

function normalizeCategoryOutput(value: string | null | undefined) {
  const normalized = trimmedText(value);
  return normalized ? normalized : null;
}

function isRuleActive(rule: CategoryRuleLike) {
  return rule.is_active === undefined || rule.is_active === null || rule.is_active === true || rule.is_active === 1;
}

function matchesCustomRule(input: PreparedInput, rule: CategoryRuleLike) {
  const pattern = normalizeComparableText(rule.pattern);
  if (!pattern) {
    return false;
  }

  switch (rule.match_type) {
    case "merchant":
      return includesTerm(input.normalizedMerchantName, pattern);
    case "description":
      return includesTerm(input.normalizedDescription, pattern);
    case "original_category":
      return includesTerm(input.normalizedOriginalCategory, pattern);
    case "contains":
      return includesTerm(input.normalizedCombinedText, pattern);
    default:
      return false;
  }
}

export function resolveEffectiveCategory(input: {
  userCategory?: string | null;
  systemCategory?: string | null;
  originalCategory?: string | null;
}) {
  return (
    firstPresentCategory(input.userCategory, input.systemCategory, input.originalCategory) ?? "Sem categoria"
  );
}

export function normalizeOpenFinanceCategory(
  input: NormalizeOpenFinanceCategoryInput,
): string | null {
  const prepared = prepareInput(input);
  const matched = nativeMatch(prepared);
  if (matched) {
    return matched;
  }

  return normalizeCategoryOutput(prepared.originalCategory);
}

export function normalizeWithRules(
  input: NormalizeOpenFinanceCategoryInput,
  rules: CategoryRuleLike[],
): string | null {
  const prepared = prepareInput(input);
  const activeRules = [...rules]
    .filter(isRuleActive)
    .sort((left, right) => (left.priority ?? 100) - (right.priority ?? 100));

  for (const rule of activeRules) {
    if (matchesCustomRule(prepared, rule)) {
      const category = normalizeCategoryOutput(rule.category);
      if (category) {
        return category;
      }
    }
  }

  return normalizeOpenFinanceCategory(input);
}

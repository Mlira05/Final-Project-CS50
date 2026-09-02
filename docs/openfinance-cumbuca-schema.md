# Cumbuca Open Finance MCP schema notes

Discovered with the authenticated Codex MCP connection on 2026-05-08. This note documents field names only and intentionally omits real values, CPF/CNPJ, tokens, account numbers, and raw financial data.

## Tools

- `get_consent_status()`
- `list_accounts({ bypass_cache? })`
- `get_account({ account_id, bypass_cache? })`
- `list_account_transactions({ account_id, from_date?, to_date?, bypass_cache? })`
- `list_credit_cards()`
- `list_credit_card_bills({ credit_card_account_id })`
- `list_credit_card_bill_transactions({ credit_card_account_id, bill_id })`
- `revoke_consent()`

## Bank account transactions

`list_account_transactions` returns:

- top level: `transactions`
- transaction fields observed:
  - `transactionId`
  - `creditDebitType`
  - `transactionAmount.amount`
  - `transactionAmount.currency`
  - `transactionDateTime`
  - `transactionName`
  - `type`
  - `completedAuthorisedPaymentType`
  - optional counterparty fields such as `partiePersonType`, `partieCnpjCpf`, `partieBranchCode`, `partieNumber`

No rich merchant category field appeared in the sampled bank response. The normalizer stores `type` as `original_category` when no richer category is present.

## Credit card data

`list_credit_cards` returns `credit_cards`, including:

- `creditCardAccountId`
- `brandName`
- `productType`
- `creditCardNetwork`

`list_credit_card_bills` returns `bills`, including:

- `billId`
- `dueDate`
- `billTotalAmount.amount`
- `billTotalAmount.currency`
- `billMinimumAmount`
- optional `payments`
- optional `financeCharges`

`list_credit_card_bill_transactions` returns:

- top level: `transactions`
- transaction fields observed:
  - `transactionId`
  - `billId`
  - `billPostDate`
  - `transactionDateTime`
  - `transactionName`
  - `transactionType`
  - `creditDebitType`
  - `amount.amount`
  - `amount.currency`
  - `brazilianAmount.amount`
  - `brazilianAmount.currency`
  - `paymentType`
  - optional `payeeMCC`

No rich category field appeared in the sampled credit card response. The normalizer stores `transactionType`, then `paymentType`, then `MCC <code>` as the best available `original_category`.

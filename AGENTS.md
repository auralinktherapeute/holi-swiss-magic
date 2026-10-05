# AGENTS.md

- Billing currency changes (practice `therapist_invoice_settings.devise_defaut` and client `crm_client_contacts.billing_currency`) go only through the `change_practice_currency` / `change_client_currency` RPCs, which log to the append-only `currency_change_consents`; a trigger blocks any other write. Why: consent and change must be atomic and auditable.
- Effective currency is resolved by `resolveEffectiveCurrency` (client → practice → CHF) in `src/lib/currency-consent.ts`; never re-derive it elsewhere. Why: one priority rule for invoices, bookings and UI.

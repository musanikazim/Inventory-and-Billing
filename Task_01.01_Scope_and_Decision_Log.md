# Task 01.01 Scope and Decision Log

**Demo direction approved by user. Production decisions deferred.**

## Confirmed demo decisions

| ID | Classification | Decision |
|---|---|---|
| O1 | Confirmed by user | Build a locally launchable React and TypeScript browser prototype with representative, connected inventory and billing workflows. Use BRD business scope and Module Task Plan coverage for the dashboard, catalogue, parties, purchasing/receiving, sales/POS, inventory, returns, settlement, reports, documents and administration. Production completeness is outside this stage. |
| O2 | Confirmed by user | Use one fictional Pakistan business with sample branches and warehouses. Use PKR/Rs., Asia/Karachi dates and English UI, with locale formatting kept extensible for Urdu. |
| O3 | Confirmed by user | Use localStorage for one simulated business, with fictional seed records and Reset Demo Data. Keep domain logic and the repository separate from screens. Hosted multi-tenancy, NestJS and PostgreSQL are deferred. |
| O4 | Confirmed by user | Show operational stock, valuation, customer/supplier balances and payments. Use moving weighted-average sample costing and omit a full general ledger. |
| O5 | Confirmed by user | Launch locally in a browser. Demo role selection and approval states are presentation controls. Production authentication, authorisation and hosting are deferred. |
| O6 | Confirmed by user | Use configurable example tax and simulated FBR submission states. Live FBR, licensed integration, taxpayer applicability and statutory decisions are deferred. |
| O7 | Confirmed by user | Use local simulations only. Real AI, messaging, payment gateways and any other providers are deferred. AI and messaging screens are optional for this demo and omitted. |
| O8 | Confirmed by user | Use blue as the primary UI direction with accessible contrast. The prototype uses a dark navy navigation surface and a saturated blue for primary actions. The BRD §10 accessibility target remains a reference for core interactions. |

## Source differences and deferred decisions

| Topic | Source position and demo adaptation | Deferred production decision and dependencies |
|---|---|---|
| Scope and sequencing | BRD §§4, 7 and 12 and the plan cover a broader pilot and production release. Transfers, counts and the generic tax adapter appear as Must in detailed scope but are staged later in BRD §12. The approved demo uses representative workflows. | Product owner and QA to settle the production release boundary, milestone exceptions and Must acceptance before Tasks 19.08–19.09. |
| Architecture and tenancy | The plan's “single-tenant-to-multi-tenant plan” wording could imply a later schema migration. TSD §§2, 5, 11 and 22 propose a hosted tenant-aware schema from the start. One fictional browser business supplies the demo context. | Technical and security leads to decide production stack, modular monolith, tenant rollout and keys before Tasks 01.02–01.04 and 16.02. Consider wording that distinguishes tenant-aware schema design from the initial number of onboarded organisations. |
| Identity and hosting | TSD §§2, 11 and 15–16 propose managed identity, private hosted services, backups and restore objectives. The prototype runs locally with a demo role selector. | Technical, security and operations leads to decide identity/session model, production security, provider/region, retention and recovery objectives before Tasks 03.01, 16.02–16.05 and 18.02–18.05. |
| Accounting | BRD §§4.2, 7.6 and 7.9 define operational accounting boundaries. TSD §6.2 proposes moving weighted average. The demo illustrates the approach with sample figures. | Finance and product to confirm production costing, return basis and accounting export/integration scope before Tasks 02.03, 08.07, 12.03 and 19.01. |
| Tax and optional integrations | BRD INT-06 and plan 14.04 call for a generic interface, while BRD §12 stages the connector with integrations. TSD §§9–10 describe provider boundaries. Local examples implement no provider calls. | Finance/tax to validate production tax scope and route before Tasks 11.05–11.06, 11.09, 14.04 and 19.09. Product and privacy/security to approve real providers, data terms and activation before Tasks 14–17 where applicable. |

## Demo completion criteria

- The React and TypeScript app launches locally and opens seeded fictional data.
- The walkthrough connects purchasing, receiving, inventory, sales, settlement, returns, statements and reports. Document previews show saved amounts.
- Local records survive refresh and the confirmed reset restores seed records.
- Demo tax, FBR states, payments and role/approval states are visibly illustrative. The implementation uses local records and provides launch and reset instructions.
- Production decisions above retain deferred status. This decision log records approval for the demo stage.


# Blueledger inventory and billing demo

## Launch locally

Use Node.js 22.12+ and npm. From this folder run:

```sh
npm ci
npm run dev
```

Open [localhost:5173](http://localhost:5173), or the URL printed by Vite. On Windows, use `npm.cmd` if PowerShell blocks the npm script shim. `npm run build` type-checks and bundles the app. `npm run preview` serves that bundle locally.

## Walkthrough

1. Start on Dashboard and inspect the stock alerts.
2. In Purchasing, create an order or use PO-0002, approve it, and receive some or all of its units. Inventory shows the corresponding warehouse quantities and receipt movements. The demo creates the payable when all ordered quantities are received.
3. In Sales & POS, create a sale for a customer using items available at the selected warehouse. Choose Pay now or Credit sale. Sales reduce stock at moving weighted-average cost. A credit sale increases the customer balance.
4. Use Settle on a sale or fully received purchase order, or use Record payment in Payments. Make a full or partial allocation.
5. In Returns, choose an original invoice and eligible item, then choose restock or scrap and credit note or refund. A cash refund requires sufficient paid value for the returned amount.
6. View party statements, operational reports and printable document previews. Use the built-in Demo walkthrough in the sidebar during a presentation.

## Roles, data and simulations

The workspace opens directly. The top-bar role selector changes the displayed demo persona. Purchase approval is a local status transition. These controls illustrate the workflow and provide no access enforcement.

The app seeds fictional data on first launch. Records persist in localStorage for the same browser profile and URL origin. To start over, open Administration, select **Reset Demo Data**, and confirm.

Example tax rates and FBR submission/acceptance states are illustrative. Card, wallet and bank transfer are local settlement labels. The demo uses no provider calls and has no live AI, messaging, FBR or payment integration. Commercial previews print through the browser and are marked as demo documents.

The demo covers representative workflows. Purchasing uses the fully received order as its payable, sales returns support one item per action, and operational figures use simplified stock valuation and allocations. Production identity, security, multi-tenancy, accounting and hosting are deferred.

## Code layout

`src/App.tsx` contains navigation and module views. `src/Workflow.tsx` contains transaction forms and previews. `src/demo.ts` contains domain commands, calculations and the browser repository boundary. The UI works against shared domain records so a future API adapter can supply persistence without redefining the screens.


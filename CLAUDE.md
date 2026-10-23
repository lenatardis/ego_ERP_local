# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev        # start dev server
pnpm build      # production build
pnpm lint       # run ESLint
pnpm preview    # preview production build
pnpm check:shared   # shared seed / catalog / media / scripts identical with ../ego_CRM_local
pnpm same-origin    # ERP + CRM on one origin, http://localhost:8080/ (see the workspace CLAUDE.md, "Both apps on one origin")
```

Package manager is **pnpm**.

## Architecture

This repository contains a React 19 + Vite ERP admin panel originally developed for internal business management. The sections below describe the original application's architecture and behavior for reference.

### Entry & Auth flow

- `src/main.jsx` — mounts the app with Redux `<Provider>` and React Router `<BrowserRouter>`
- `src/App.jsx` — on mount, calls `checkSessionAndSetAuth` (validates JWT from localStorage against the API), then renders either `<Auth>` or `<Authorized>`
- `src/api/authStorage.js` — read/write/remove JWT tokens (`accessToken`, `refreshToken`, `userId`) from `localStorage`
- `src/utils/sessionManager.js` — session validation logic called at startup
- `src/api/authApi.js` — `loginUser`, `logout`, `refreshAccessToken`, and a shared `handleUnauthorized` that auto-retries on 401

### Routing & role-based access

`src/components/Authorized.jsx` is the authenticated shell: it renders the `<Navigation>` sidebar and a `<Routes>` tree covering all app pages. Default redirect on `/` depends on user group:
- Production workers (Закрійник, Швачка, Швея, Пакувальник) → `/orders`
- Accountant (Бухгалтер) → `/payment-for-orders`
- All others → `/storage`

### State management

Redux Toolkit store (`src/store/store.js`) with two slices:
- `account` (`src/store/account-slice.js`) — `isAuth`, `profile` (user data including `groups`)
- `main` (`src/store/main-slice.js`) — `isActivePopup` (manages `body.overflow`)

Selectors are centralized in `src/store/selectors.js`. Use `useAppDispatch` / `useAppSelector` from `src/hooks/redux.jsx`.

### API layer

All REST calls use plain `fetch` (no axios). Two main API files:
- `src/api/authApi.js` — auth endpoints + shared `handleResponse`/`handleUnauthorized` utilities
- `src/api/tablesApi.js` — all other endpoints (fabrics, products, orders, finances, vendors, templates, etc.)

Both share the same pattern: on 401, call `refreshAccessToken()` and retry once.

The original API base was:
`https://dev.panel.egodevelopment.pp.ua/admin_panel/api/v1`

This endpoint is no longer available and must not be used by the portfolio version.

### Component structure

```
src/components/
  Common/          # reusable UI: Table, ExpandableTable, CustomSelect, Filter, SearchFilter,
                   # InputBox, SidePopup, CentralPopup, Tabs, RadioButton, CustomCheckbox, etc.
  Auth/            # login screen + form
  Navigation/      # sidebar nav
  Order/           # single order view with sub-popups
  Orders/          # orders list
  FabricComposition/  # storage: fabrics & products, with sub-components for new/edit/arrival
  Finances/        # finance list
  FinancesCreate/  # finance creation form
  NewPrices/       # price update form
  Pricelist/       # price list view
  ArrivalList/     # arrival records list
  Bills/           # bills view
  Sources/         # lead sources management
  PaymentForOrders/   # order payments + Privat24 info
  PaymentForVendors/  # vendor payments, debt list, vendor management
  PaymentForCRM/      # CRM payments
  Templates/       # catalog templates: KitTemplates, ComponentTemplates, KitSizes,
                   # ComponentTypes, Options (Kit/Component), OptionParts
```

### Unsaved changes guard

`src/guards/UnsavedChangesContext.jsx` provides `UnsavedChangesProvider` with `dirtyCount` and a `saveAllRef`. The hook `src/guards/useUnsavedChangesGuard.js` blocks navigation when there are unsaved changes. Both wrap the entire authenticated area in `Authorized.jsx`.

### Styling

Per-component SCSS modules (`.module.scss`) colocated with each component. Global styles in `src/Base.scss` and CSS variables in `src/Variables.scss`.

## Project Context

This repository is a local portfolio reconstruction of an existing ERP admin panel.

The original backend/dev server is no longer available. This repository is intentionally frontend-only.

The goal is to preserve the existing frontend functionality, UI, business logic, and architecture as much as reasonably possible, while replacing backend-dependent behavior with local mock data / mocked API responses. The Architecture section above describes the original application's existing structure and behavior. It is reference information for understanding and preserving the existing frontend, not a specification to restore the original backend environment.

### Goals

- Publish the app as a static demo on **GitHub Pages** (no server at runtime; the app may be served from a sub-path, so respect `import.meta.env.BASE_URL`).
- Partial data syncing with the eponymous Ego **CRM** demo, which will be hosted on the same github.io origin. Which entities are shared is not decided yet — keep mock data and storage keys in a shape that allows sharing later (e.g. CRM-facing endpoints under `CRM_BASE_URL` / `/api/v1`, Payment for CRM, product types).

### Mock backend approach (use this for every restored page)

- `src/api/*Api.js` keep making real `fetch` calls to same-origin paths (`/admin_panel/api/v1/...`, CRM: `/api/v1/...`). Do not replace API functions with direct mock imports.
- Requests are answered in the browser by **MSW** (`src/mocks/browser.js`, started in `src/main.jsx` before render).
- `src/mocks/data/<entity>.js` — deterministic seed data (seeded PRNG `mulberry32`), record shapes mirror what the components read.
- `src/mocks/handlers/<entity>.js` — MSW handlers wrapped in `withAuth`, implementing the filters/pagination the API layer sends and the original response shape; register them in `src/mocks/handlers/index.js`.
- `src/mocks/db.js` — `getCollection` / `saveCollection` persist changed collections to `localStorage` under the `ego-demo:erp:` prefix. Bump `DATA_VERSION` when seed data or record shapes of existing collections change. Collections shared with the CRM (orders, customers, payment bills — contract in `../CLAUDE.md`): `getSharedCollection` / `saveSharedCollection(name, items)` under `ego-demo:shared:`, re-read on every access because the CRM may change them in another tab; bump `SHARED_DATA_VERSION` only together with the CRM (same value in both repos).
- `src/mocks/shared/catalog/` — the catalog seed modules (fabrics, warehouse, products, vendors, demoUsers, fabricArrivals, calculatorTemplates, pricelists, prices), also served read-only by the CRM demo; **identical copy in `../ego_CRM_local`** (README there). `src/mocks/data/<name>.js` of these are one-line re-exports, so edit the files in `shared/catalog/`, copy them to the CRM and run `pnpm check:shared`. Demo media URLs use `src/mocks/appBaseUrl.js`; `public/demo/media/` is identical in both repos too.
- `src/mocks/shared/seed.js` — seed of the data shared with the CRM demo (CRM orders, customers, payment bills, plus the Privat statement lines generated in the same PRNG stream); **identical copy in `../ego_CRM_local`**, run `pnpm check:shared` after editing it and copy it over. `src/mocks/data/privatPayments.js` derives the ERP's `crmOrders` / `paymentBills` / `privatPayments` seeds from it. Order totals, bill and statement amounts are derived from the seed orders' carts (`SEED_ORDER_PRODUCTS`, priced with `shared/catalog/pricing.js`), so changing catalog prices changes them — bump `DATA_VERSION` here and the shared version in the CRM. Contract: `../CLAUDE.md` → "Cross-app contract".
- Related records are stored by id and expanded into nested objects when a response is built, so edits (e.g. renaming a vendor) propagate.
- Lists sort newest-created first, so a record created through a form appears at the top of page 1.
- Demo login: users in `src/mocks/data/demoUsers.js` (password `DemoPass123`).

### Important working rules

- Do not attempt to connect to or restore the original backend.
- Do not make requests to the original API unless explicitly instructed.
- Do not remove existing functionality just because the backend is unavailable.
- Prefer small, targeted changes over broad rewrites.
- Preserve the existing architecture and component structure unless a change is explicitly requested.
- Do not refactor unrelated code while implementing a requested feature.
- Before making large changes, explain what will be changed and why.
- Do not invent business logic when the existing frontend code provides evidence of the original behavior.
- When replacing an API call with mock behavior, preserve the existing response shape and frontend data flow whenever possible.
- Keep the project runnable with the existing pnpm scripts.

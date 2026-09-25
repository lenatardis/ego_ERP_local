# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev        # start dev server
pnpm build      # production build
pnpm lint       # run ESLint
pnpm preview    # preview production build
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

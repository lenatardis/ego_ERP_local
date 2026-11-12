# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev        # start dev server
pnpm build      # production build
pnpm lint       # run ESLint
pnpm preview    # preview production build
pnpm check:shared   # shared seed / catalog / mswRecovery / media / scripts identical with ../ego_CRM_local
pnpm same-origin    # ERP + CRM on one origin, http://localhost:8080/ (see the workspace CLAUDE.md, "Both apps on one origin")
```

Package manager is **pnpm**.

## Architecture

This repository contains a React 19 + Vite ERP admin panel originally developed for internal business management. The sections below describe the original application's architecture and behavior for reference.

### Entry & Auth flow

- `src/main.jsx` – mounts the app with Redux `<Provider>` and React Router `<BrowserRouter>`
- `src/App.jsx` – on mount, calls `checkSessionAndSetAuth` (validates JWT from localStorage against the API), then renders either `<Auth>` or `<Authorized>`
- `src/api/authStorage.js` – read/write/remove JWT tokens (`accessToken`, `refreshToken`, `userId`) from `localStorage`
- `src/utils/sessionManager.js` – session validation logic called at startup
- `src/api/authApi.js` – `loginUser`, `logout`, `refreshAccessToken`, and a shared `handleUnauthorized` that auto-retries on 401

### Routing & role-based access

`src/components/Authorized.jsx` is the authenticated shell: it renders the `<Navigation>` sidebar and a `<Routes>` tree covering all app pages. Default redirect on `/` depends on user group:
- Production workers (Закрійник, Швачка, Швея, Пакувальник) → `/orders`
- Accountant (Бухгалтер) → `/payment-for-orders`
- All others → `/storage`

### State management

Redux Toolkit store (`src/store/store.js`) with two slices:
- `account` (`src/store/account-slice.js`) – `isAuth`, `profile` (user data including `groups`)
- `main` (`src/store/main-slice.js`) – `isActivePopup` (manages `body.overflow`)

Selectors are centralized in `src/store/selectors.js`. Use `useAppDispatch` / `useAppSelector` from `src/hooks/redux.jsx`.

### API layer

All REST calls use plain `fetch` (no axios). Two main API files:
- `src/api/authApi.js` – auth endpoints + shared `handleResponse`/`handleUnauthorized` utilities
- `src/api/tablesApi.js` – all other endpoints (fabrics, products, orders, finances, vendors, templates, etc.)

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

Mobile (demo build, 2026-11-10, at the user's request): the ERP is desktop-first and the desktop layout must not change – mobile styles go only inside `@media screen and (max-width: 1023px)`. Phase 1 done: below 1024 px `Navigation` shows a fixed top bar (☰, logo, active page name) and the sidebar becomes a slide-out menu over an overlay (closes on overlay, link, Escape, route change; menu groups: see "Sidebar groups" below); `.contentBox` takes the full width (`Base.scss`). Layers: bar 50, overlay 61, menu 62 – above the tables' ghost scroll bars (`useStickyXScroll`, 60; raised from 55 / 60 on 2026-11-10 because the bar showed over the open menu), under the app's popups (65+). Checked: a layout fingerprint of 4 desktop pages at 1440 px (positions / sizes of 200–400 elements) is identical before and after. Phase 2 done: mobile blocks at the end of `SearchFilter` (search on its own line, buttons wrap), `CentralPopup` (screen width − 32 px, scrolls; no 500 px min width), `SidePopup` / `Filter` (full width), `Tabs` (wrap), `Table` (smaller padding), `Orders` (smaller padding, tab rows as a 2-column grid, table scrolls sideways in its box), `ArrivalList` (rows / buttons wrap), `NewFabric` (one column), `Base.scss` (button captions may wrap). Checked: all 22 menu pages fit a 390 px screen (no page-wide horizontal scroll); desktop fingerprint of 8 pages identical with and without the phase 2 styles. Phase 3 done: `/orders` rows are cards on phones – each cell carries `data-label` (its column title; no effect on desktop) shown above the value, photo in the left column, header row hidden, list not separately scrolled; `/order` (`Order.module.scss`): header stacks (worker, then wrapping info), smaller paddings / fonts / avatar. Checked at 390 px as demo_cutter: both pages fit, nothing pokes out, the order page's popups ("Вибір тканини", "Завершити роботу") fit with 16 px margins; desktop `/orders` fingerprint identical, desktop `/order` identical element by element (only the live clock's seconds differ). Fixes after a phone check (2026-11-10): Тканини (`FabricComposition.jsx`) and Готова продукція (`StorageProduct.jsx`) use the same ghost scroll as the other tables on all widths, at the user's request (`TableFixedHeader` + `.xScrollHide` scroll box + `useStickyXScroll` bar; minimum width 120 px per column, so a 1366 px+ desktop needs no scroll); on phones a table under a `TableFixedHeader` keeps its desktop padding (the header's width relies on it) and sticky headers stop below the 56 px top bar; other plain `Table` header and rows get one minimum width on phones (`--table-cols` × 110 px, set inline by `Table.jsx`), so they scroll sideways together inside `.table`. Testing note: in a hidden / unfocused automation window `requestAnimationFrame` and native scroll events are paused, so the ghost bar does not appear and the header does not follow – replace `requestAnimationFrame` with a timer before the app loads and dispatch `scroll` events by hand; the products page's variants toggle is an eye / crossed eye icon on phones (`assets/icons/eye.svg`, `eyeClosed.svg`); `Filter` takes `onClose` (every page passes its `PopupCloser` handler) and shows a × in its top-right corner (on phones since the mobile work, where the panel covers the screen; on all widths since 2026-11-10, at the user's request); photos have a `photoSkeleton` loading background (`Base.scss`, all widths – demo photos are opaque JPEGs, so a loaded photo covers it) in the fabrics / products tables and popups, `ProtectedImage` (orders), and the template pages' table thumbnails and "Поточне фото" (KitTemplates, ComponentTemplates, ComponentTypes, KitOptionTemplates) – every photo the ERP shows; previews of files being uploaded are left out (local, instant, may be transparent). Arrival / payment forms on phones (`IncomingArrival.module.scss`, shared by the fabric / product arrival, Privat / CRM payment and vendor payment pages): smaller headings, actions on their own row, one column with a 16 px gap between the former columns, full-width date input. The banner under the actions (all widths, at the user's request) is a red box with a "!" mark, and "Суми співпадають ✓" (Перевірка суми) gets `bannerOk` (green, ✓) – the class is set in the two arrival pages' JSX. The new-fabric / new-product forms have their own banner styles (`NewFabric.module.scss`), untouched.

Arrival tables – warnings don't move fields (2026-11-10, at the user's request; all widths): rows were vertically centred, so a warning under a field pushed the row's fields up. Fabric rows (`EditableFabricTable`, `.stableRow`): top-aligned, every cell except the length stack gets a 34 px offset that centres it on that stack (select / "або" / input; "або" is a 34 px band, so the neighbouring cells sit level with it and their borders don't overlap the select's or the input's) – fields stay put, the row grows downward. Product rows (`EditableProductTable`, `.variantRow` / `.variantColumn` in `EditableFabricTable.module.scss`): each colour/size line (and the "+ Додати колір / розмір" line) is a row of the table grid, placed inline (`line(col, vi)`, №/Назва/Категорія span all lines), so a line is as tall as its tallest field + warning in any column and the columns stay level; 28 px top padding for the "+" / "i" icons only when editable. Every field box in these rows is 34 px: selects and price inputs get it from a bordered wrapper around a 32 px field (selects untouched – shared components); inputs with their own border (`input.fullBorder`: Кількість / К-ть, Назва / Код, custom length) and inputs placed straight in a cell (№, Категорія / Тип, Сума $ / грн; `.stableRow > * > input`, `.variantRow` / `.variantColumn` likewise) get `min-height: 34px`, scoped to these rows. Note: the element rule `input { min-height: 32px }` at the top of `EditableFabricTable.module.scss` is not scoped by CSS modules – it applies app-wide once the module loads; left as it was. Neighbouring fields share one border: a field followed by a bordered one drops its right border (`noRightBorder`; fabric: Склад, Стелаж, Комірка; products: Розмір, К-ть – К-ть keeps the full orange box while its capacity warning shows). "або" is 13 px. Checked by measuring field positions before / after "Зберегти" (nothing moves; with two lines, the second moves down as a whole) and the read-only view.

Sidebar on short desktop windows (2026-11-10, at the user's request): `.navigation` scrolls (`overflow-y: auto`, its children `flex-shrink: 0`) – only at window heights ≤ 594 px (the tallest menu, one group open, needs 590 px), because while one group closes and another opens the menu is briefly taller and a scrollbar would flash on taller windows. `Перейти в CRM` is as wide as its caption (16 px side padding, 138 px), centred (`logout__crm`). Before, with two groups open (the current page's + one more) the logout line went below the bottom edge under ~706 px window height and couldn't be reached. Sidebar groups (2026-11-10, at the user's request, all widths): one group open at a time – the current page's group starts open as that one group (set on every route change), opening another closes it (`openedAccordion` only, in `Navigation.jsx`). The original kept the current group open next to the opened one (two at most, 726 px) – too tall for ~600 px laptop windows. Checked at 600 px: no scroll, every group fits, logout at 500–580.

Page scroll lock (2026-11-10, at the user's request; all widths): while a filter (`Filter`, every page) or the mobile slide-out menu (below 1024 px) is open, the page behind doesn't scroll – `src/hooks/useScrollLock.js` (counted locks) puts `scrollLocked` on `<html>` (`Base.scss`: `html` and `body` `overflow: hidden !important`, so it doesn't clash with the popups' inline `body.style.overflow` from `setIsActivePopup`) and `scrollLockedGutter` (`scrollbar-gutter: stable`) when the page had a scrollbar, so nothing shifts sideways. Checked: desktop filter (no scroll, content doesn't move, scrolls after closing); 390 px menu and filter; 844×390 landscape – page locked, the menu itself still scrolls to the logout line.

Info icons on touch screens (2026-11-10, at the user's request): MUI `Tooltip` opens only on hover (or a 0.7 s long press), so the info icons did nothing on phones. Every info-icon tooltip (arrival tables, Нові ціни, CRM платежі, Оплата замовлень, `OptionLimitLabel`) imports `Common/TapTooltip/TapTooltip.jsx` as `Tooltip` instead – same props; with a mouse it is MUI's hover tooltip unchanged, on a touch screen (`(hover: none)`) a tap on the icon opens / closes it, a tap elsewhere closes it (like the CRM's `InfoHint`), no `followCursor`, 8 px off the screen edges; the tap's default is prevented, because an icon inside a `<label for=…>` (`OptionLimitLabel` in the template popups) would otherwise focus the input with the label's own click, which closed the tooltip as a click away. Checked at 390 px on CRM платежі and the Розміри комплектів popup (hint shown, input not focused, tap elsewhere closes).

Info icon look (2026-11-12, at the user's request; all widths): `src/assets/icons/info.svg` – the one file every ERP info icon loads (arrival tables, Нові ціни, CRM платежі, Оплата замовлень, `OptionLimitLabel`) – is the CRM's handwritten "i" (slanted stem with a bottom hook and a dot; same drawing as `ego_CRM_local/src/_icons.scss`), inverted at the user's request: white circle with a main-purple `#573971` border, purple letter – instead of the old outlined circle with a plain "i". Its own size stays 10×10 (viewBox 16), so nothing moves; the pages size it themselves (14–16 px). Checked at 1440 px (2x): CRM платежі (dates), Нові ціни (table).

Late kit prices (2026-11-12, at the user's request): three kits got a default-list price in the shared catalog so the CRM calculator's first try (Бязь + 1.5) works – workspace `CLAUDE.md` → "Late kit prices". `handlers/prices.js` `addLatePrices` adds them once (new ids, skipped where that kit already has a price in that list) to prices a visitor stored before; marker collection `latePricesAdded`. Checked: an old visitor gets 271–273 once, a deleted one stays deleted, a new visitor has them from the seed. Нові ціни's "Без цін" no longer lists these three kits.

Options' inner tabs on phones (2026-11-10, at the user's request): "Опції компонентів" / "Опції комплектів" (`Templates/TabLinks/OptionInnerTabs.jsx`, class `innerTabs`) sit on their own `--bg-second` panel (8 px padding, rounded) below 1024 px, so they read as a sub-group of "Опції"; both tab blocks (`TabLinks` on every template page, and the inner tabs) are full-width 2-column grids there, so their edges line up with each other and the search bar (checked at 360 px: all at 16–344, inner buttons' middle edges level with the main columns, no clipped caption); desktop unchanged.

Popups on phones (2026-11-11, at the user's request): `CentralPopup` shows only the × below 1024 px (its "Закрити" caption hidden; the button has `aria-label="Закрити"`) – the CRM does the same; there the × circle is 24 px (desktop 14 px, 10 px cross, 36 px tap area) and the title 16 px (desktop 18 px), so they look in proportion. "Прив’язка платежу" (Оплата замовлень, `PaymentForOrders.module.scss`) is stacked below 1024 px: order tabs as a 2-column grid above the bills, each bill's text above its "Чек" / "Підв'язати" row – before, the two columns didn't fit and the popup scrolled sideways. Checked at 390 px: popup at 16–374, nothing outside it.

Order page on phones, second pass (2026-11-11, at the user's request – texts ran out of their blocks): below 1024 px `/order` stacks the kit info above "Історія замовлення" (both full width), with smaller fonts (title 22 px, headings 17 px, kit params 15 px, last update 18 px, worker history 14 px in one column) and `overflow-wrap: anywhere` for long names. Checked at 390 px as demo_cutter on order 4277: nothing outside the content box, no sideways scroll.

Avatar placeholder on `/order` (2026-11-11, at the user's request; all widths): the placeholder figure (`assets/icons/user.svg`, 33×37) was stretched to the whole circle (80×80, phones 56×56); now it has `userIcon`: 45% of the circle's width at its own proportions, centred. A real photo keeps the old sizing.

Dashes (2026-11-11, at the user's request): no em dash (U+2014) anywhere in either repo or the workspace `CLAUDE.md` – all replaced with the en dash "–" (UI placeholders for empty values, messages, comments, docs). The code that compares with the placeholder (`Order.jsx`, `Orders.helpers.js`) changed with it; no stored demo data contained it. Write "–" in new text too.

Unchanged arrival edits (2026-11-11, at the user's request): saving an edited fabric / product arrival that has no changes is refused on the page with the banner "Для збереження відредагованої накладної внесіть зміни: поточна версія не відрізняється від збереженої." (no confirm popup). `FabricComposition/components/arrivalUnchanged.js` turns the arrival as loaded into the payload shape the page sends and compares it with the new payload, normalised (cents, numeric strings, empty = null, key order); the check runs after the page's own checks, right before the confirm popup, and once all checks pass and a save goes ahead (create or edit) the page clears its banner – the original left a failed attempt's banner (e.g. "Переконайтесь…") next to the confirm popup. If the normalisation misses an equivalence, the save simply goes through as before – a real edit is never blocked. Checked: all 19 seeded arrivals with rows read as unchanged; a comment edit or a table edit opens the confirm popup; an edit undone reads as unchanged again.

Filter selects on phones (2026-11-11, at the user's request): below 1024 px the `Filter` panel has 16 px side padding (was 10 px). MUI menus keep 16 px off the screen edges, so with 10 px an open select's list was pushed 6 px sideways off its field. Checked at 360 / 384 / 768 px on Тканини: list and field at the same x for both selects. Desktop unchanged (the panel's selects are more than 16 px from the edge there).

Location popups on phones (2026-11-11, at the user's request): in "Розташування рулонів" (Тканини) and "Розташування готової продукції" (Готова продукція) the table started 12 px right of its heading below 1024 px – the mobile `.table { padding: 12px }` (`Table.module.scss`) overrode the popup table's `padding: 12px 0`. Below 1024 px `.table.popupTable` keeps `padding: 12px 0` (only these two popups use `popupTable`). Checked at 390 px: heading and table header both at 48 px; desktop unchanged (both at 352 px).

Stale bundles (2026-11-13, at the user's request; same as the CRM – a phone kept an old copy of the CRM after a day of deploys and hung until its cache was cleared): the deploy workflow builds with `VITE_BUILD_ID` = the commit SHA and writes `dist/version.json` `{"build": "<sha>"}`. `src/utils/versionCheck.js` (started in `src/main.jsx`) fetches it with no caching on start and whenever the tab is shown again (at most once a minute). On a different build it reloads, once per build (sessionStorage `ego-demo:erp:reloadedForBuild`, so a CDN still serving the old index.html can't cause a reload loop). Local builds have no build id and skip the check. Checked with a static build (mismatch: one reload; match: none).

Login role picker (2026-11-11, at the user's request): "Бухгалтер" is the last option – reordered in `AuthForm.jsx` only (`DEMO_USERS` is shared catalog seed, identical in both repos, left as is).

## Project Context

This repository is a local portfolio reconstruction of an existing ERP admin panel.

The original backend/dev server is no longer available. This repository is intentionally frontend-only.

The goal is to preserve the existing frontend functionality, UI, business logic, and architecture as much as reasonably possible, while replacing backend-dependent behavior with local mock data / mocked API responses. The Architecture section above describes the original application's existing structure and behavior. It is reference information for understanding and preserving the existing frontend, not a specification to restore the original backend environment.

### Goals

- Publish the app as a static demo on **GitHub Pages** (no server at runtime; the app may be served from a sub-path, so respect `import.meta.env.BASE_URL`).
- Partial data syncing with the eponymous Ego **CRM** demo, which will be hosted on the same github.io origin. Which entities are shared is not decided yet – keep mock data and storage keys in a shape that allows sharing later (e.g. CRM-facing endpoints under `CRM_BASE_URL` / `/api/v1`, Payment for CRM, product types).

### Mock backend approach (use this for every restored page)

- `src/api/*Api.js` keep making real `fetch` calls to same-origin paths (`/admin_panel/api/v1/...`, CRM: `/api/v1/...`). Do not replace API functions with direct mock imports.
- Requests are answered in the browser by **MSW** (`src/mocks/browser.js`, started in `src/main.jsx` before render).
- `src/mocks/data/<entity>.js` – deterministic seed data (seeded PRNG `mulberry32`), record shapes mirror what the components read.
- `src/mocks/handlers/<entity>.js` – MSW handlers wrapped in `withAuth`, implementing the filters/pagination the API layer sends and the original response shape; register them in `src/mocks/handlers/index.js`.
- `src/mocks/db.js` – `getCollection` / `saveCollection` persist changed collections to `localStorage` under the `ego-demo:erp:` prefix. Bump `DATA_VERSION` when seed data or record shapes of existing collections change. Collections shared with the CRM (orders, customers, payment bills – contract in `../CLAUDE.md`): `getSharedCollection` / `saveSharedCollection(name, items)` under `ego-demo:shared:`, re-read on every access because the CRM may change them in another tab; bump `SHARED_DATA_VERSION` only together with the CRM (same value in both repos).
- `src/mocks/shared/catalog/` – the catalog seed modules (fabrics, warehouse, products, vendors, demoUsers, fabricArrivals, calculatorTemplates, pricelists, prices), also served read-only by the CRM demo; **identical copy in `../ego_CRM_local`** (README there). `src/mocks/data/<name>.js` of these are one-line re-exports, so edit the files in `shared/catalog/`, copy them to the CRM and run `pnpm check:shared`. Demo media URLs use `src/mocks/appBaseUrl.js`; `public/demo/media/` is identical in both repos too.
- `src/mocks/shared/seed.js` – seed of the data shared with the CRM demo (CRM orders, customers, payment bills, plus the Privat statement lines generated in the same PRNG stream); **identical copy in `../ego_CRM_local`**, run `pnpm check:shared` after editing it and copy it over. `src/mocks/data/privatPayments.js` takes the ERP-private `privatPayments` seed from it; CRM orders, customers and payment bills are read from the shared store through `src/mocks/data/crmShared.js` (which also builds the `crmOrders` rows and applies the order-paid rule). Order totals, bill and statement amounts are derived from the seed orders' carts (`SEED_ORDER_PRODUCTS`, priced with `shared/catalog/pricing.js`), so changing catalog prices changes them – bump `DATA_VERSION` here and the shared version in the CRM. Contract: `../CLAUDE.md` → "Cross-app contract".
- Sources (step 7 / 6a, contract in `../CLAUDE.md`): `handlers/pricelists.js` keeps order sources in the shared store (`sources`, seed `DEMO_SOURCES`) because the CRM reads them; pricelists and prices stay ERP-private.
- Production ↔ CRM (step 7.5, contract in `../CLAUDE.md`): `src/mocks/data/manufacturing.js` takes what each demo manufacturing order makes, its stage, CRM order and date from the shared seed's `SEED_PRODUCTION` (same order as its SPECS, which keep only the scenario); finishing a stage calls `syncProduction` (`src/mocks/data/crmShared.js`), which updates the shared `production` collection and moves the CRM order to `SHIPMENT_READY` once all its items are ready.
- Related records are stored by id and expanded into nested objects when a response is built, so edits (e.g. renaming a vendor) propagate.
- Lists sort newest-created first, so a record created through a form appears at the top of page 1.
- Demo login: users in `src/mocks/data/demoUsers.js` (password `DemoPass123`). Changed (2026-11-10, at the user's request): the login page (`components/Auth/Auth.jsx`) shows logo, title "Вхід в ERP", a demo-access hint and the form in a centred card (max 400 px), the same layout as the CRM's start page.

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

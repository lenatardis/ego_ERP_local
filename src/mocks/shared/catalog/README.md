# Catalog seed shared by the ERP and CRM demos

ERP-owned catalog data — fabrics and fabric rolls, warehouse structure, finished products (warehouse items),
calculator templates (product types, component / kit templates, kit sizes, options), pricelists, prices — and
the ERP seed modules they are generated from (vendors, fabric arrivals, ERP demo users), all in one PRNG chain.

The files in this folder are **identical in both repos** (`ego_ERP_local/src/mocks/shared/catalog/` and
`ego_CRM_local/src/mocks/shared/catalog/`): edit them in the ERP, copy them to the CRM and run
`node scripts/check-shared-seed.mjs`. The ERP keeps `src/mocks/data/<name>.js` as re-exports, so its handlers
import them as before. The CRM serves this data read-only (workspace `CLAUDE.md`, "Cross-app contract").

The only app-specific input is `src/mocks/appBaseUrl.js` (one per repo): the base URL demo media
(`public/demo/media/`, also identical in both repos) is served under.

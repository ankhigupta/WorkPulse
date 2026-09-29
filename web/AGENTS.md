This is the WorkPulse web application: Vite + React + TypeScript, for `ORGANIZATION_ADMIN` and `SUPER_ADMIN` only.

## Commands

```bash
npm run dev         # dev server on :5173 (must match backend WEB_ORIGINS)
npm run build       # tsc -b && vite build
npm run typecheck
npm run lint
npm run test
```

Run typecheck, lint and tests before declaring a task done.

## Stack

React Router v7, TanStack Query (server state), Zustand (session only), Axios, React Hook Form + Zod, CSS Modules over CSS custom properties.

**No UI kit.** No MUI, Chakra, Tailwind or component library. The WorkPulse visual language is bespoke and lives in `src/components/` + `src/theme/tokens.css`. Adding a kit would fight the design system, not save time.

## Design system

Tokens in `src/theme/tokens.css` are the source of truth and match `mobile/src/theme/*` value-for-value. The reference images are in `docs/design/`.

**Copper (`--color-copper`) is reserved** for the single primary action per screen, the active nav item, focus rings, branding and designated highlights. It never appears in a status badge, status dot, or status bar — use the semantic success/warning/error/info tones there.

## The data rule

Render only what the API actually returns. The design references contain widgets and columns WorkPulse has no endpoint for (late/on-leave attendance states, leave balances, payroll projections, pay dates, per-store attendance breakdowns, activity feeds, notifications, employee codes, job titles, CSV export). Do not add them, and do not approximate them with derived numbers presented as real. If a screen needs data the API lacks, that is a backend conversation, not a frontend workaround.

Types in `src/types/domain.ts` mirror backend `select` clauses exactly. Check the backend service before adding a field.

## Authorization

Frontend role gating is UX only — the backend is authoritative. Never rely on hiding a route for security, and never work around a 403 client-side.

`STORE_MANAGER` and `EMPLOYEE` can authenticate but get no web session (see `src/stores/authStore.ts`). That behavior is intentional; don't "fix" it by letting them in.

## Session handling

The refresh token is an httpOnly cookie the browser manages. Never read, write or store tokens in `localStorage`/`sessionStorage`. The access token stays in memory in `authStore`. Requests go through `src/api/client.ts`, which handles bearer injection and a single 401 refresh-and-retry — don't add a second retry layer on top.

## Structure

Feature-based, mirroring the backend. Cross-feature UI in `src/components/`, per-feature code in `src/modules/<feature>/`. Keep business logic (wage calculation, balances, payroll rules) server-side — the client formats, it doesn't compute.

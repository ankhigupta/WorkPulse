# Architecture

This file is filled in incrementally, same convention as `docs/api.md` — only what a given milestone actually needs, not a retroactive full-system writeup.

## Tenant Onboarding & Access Requests

Two separate signup paths, deliberately not unified into one flow, because they carry very different trust levels:

- **A business owner signing up creates their own tenant.** `POST /api/auth/signup/organization` is public and unapproved — it creates the `Organization` and its first `ORGANIZATION_ADMIN` together, atomically, and logs them straight in. There's no one else who could meaningfully approve this; requiring `SUPER_ADMIN` sign-off here would just be friction with no security benefit, since the requester isn't asking for access to something someone else controls.
- **A store manager or employee signing up is asking to join a tenant someone else already owns.** That always goes through `AccessRequest` — a staged, `ORGANIZATION_ADMIN`-approved flow. The requester picks an intended role and states a name, but none of that is authorization; the admin's explicit choices at approval time (role, store, wage, name) are what actually get written.

**The load-bearing design decision: no `User` row exists for a `STORE_MANAGER`/`EMPLOYEE` request until it's approved.** Every existing service in this codebase — Dashboard, Reports, Attendance, Payroll, Payments, Employees, Managers, Stores — does `const organizationId = auth.organizationId!`, trusting that every non-`SUPER_ADMIN` `User` always has an organization. Creating a `User` at request time (with `organizationId: null`, pending) would have broken that invariant everywhere at once. Instead, the request's email/password/intent live as staging state on `AccessRequest` itself (the password already bcrypt-hashed, copied verbatim — never re-hashed — into the real `User.passwordHash` only at approval), and approval reuses the exact same "create `User`, then `Employee`/`Manager`, in one transaction" shape `POST /api/employees`/`POST /api/managers` already use. Net effect: this entire feature is additive — nothing about how Attendance, Payroll, Payments, Reports, or direct Employee/Manager creation work had to change.

See `docs/database.md`'s "Self-Service Onboarding" section for the full data-model reasoning, `docs/api.md`'s "Onboarding & Access Requests" section for the endpoint contracts, and `docs/decisions.md` ADR-014 for the alternatives considered and why they were rejected.

## Clients

Three independent applications share one API. There is no workspace tooling or shared package between them — each has its own `package.json`, and values that must agree (design tokens, role names, response shapes) are deliberately duplicated rather than abstracted into infrastructure that doesn't exist yet.

- **`backend/`** — Express + Prisma. The only authorization boundary that matters. Every client-side role check is UX.
- **`mobile/`** — Expo/React Native, for `STORE_MANAGER` and `EMPLOYEE` day-to-day work, plus `ORGANIZATION_ADMIN` on the go. Refresh token in SecureStore.
- **`web/`** — Vite + React, for `ORGANIZATION_ADMIN` administration and `SUPER_ADMIN` platform management only. Refresh token in an httpOnly cookie.

**The two web roles get deliberately different applications**, not one application with hidden menu items: `ORGANIZATION_ADMIN` gets the operational shell (dashboard, employees, stores, attendance, payroll, payments, reports, access requests), `SUPER_ADMIN` gets a platform shell whose entire scope is the organization lifecycle. They share exactly one screen (Account). This mirrors the backend, where a `SUPER_ADMIN` is not authorized for any organization-operational route — a combined navigation would have been mostly dead links.

`STORE_MANAGER` and `EMPLOYEE` can authenticate through `POST /api/auth/login` from a browser — that endpoint has no role restriction, because mobile needs it — but the web client refuses to build a session for them: it clears local state, revokes the refresh token server-side, and explains that their role belongs on mobile. That gate is UX, not security; the real protection is that `requireRole` already excludes them from the routes the web screens call.

**Authentication differs by client on purpose.** A native app has SecureStore; a browser does not, and `localStorage` would make any XSS a persistent account takeover. So the web refresh token is an httpOnly cookie the page cannot read, while mobile keeps the original JSON-body contract unchanged — the same endpoints serve both, selected by an explicit `X-WorkPulse-Client: web` header. CSRF is handled by Origin validation on just the four `/auth` routes, since every other route authenticates with an in-memory Bearer token that a cross-site page cannot produce. Full reasoning in ADR-015.

**The web UI shows only what the API actually returns.** The visual references in `docs/design/` include widgets WorkPulse has no data for — an on-time/late attendance split, leave balances, payroll projections and pay dates, per-store attendance breakdowns, an activity feed, notifications, employee codes and job titles. None of them are rendered, because there is no endpoint behind them; the references define layout, hierarchy and density, not the data model. Where the API genuinely lacks something the reference implies (employee list pagination and search, for instance), the web app does the work client-side over the cached list rather than inventing a server capability.

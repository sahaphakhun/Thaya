# THAYA Admin UI Redesign (v2)

## 1) Objectives
- Replace legacy admin UI with a clean, maintainable interface.
- Preserve all existing capabilities (no functional regressions).
- Prepare for DB-first operations (no direct Google dependency in UI flows).
- Improve mobile usability and reduce operational errors.

## 2) Scope
### In scope
- Instruction management UI
- Instruction versions UI
- Build/preview/export UI
- Image manager UI
- Follow-up rules UI (new, DB-backed)
- System status + deployment data source indicators (DB/Google fallback)

### Out of scope (phase later)
- Rewriting business logic in `index.js`
- Full auth/permission system
- Replacing webhook flow

## 3) Information Architecture
- `/admin`
- `/admin/instructions`
- `/admin/instructions/:id`
- `/admin/versions`
- `/admin/followups`
- `/admin/images`
- `/admin/tools/build-preview`
- `/admin/settings/data-sources`

## 4) Core Screens
### A. Dashboard
- Runtime source cards: Instruction Source, Follow-up Source, Last Sync
- Quick actions: Create Version, Run Build Preview, Open Images, Open Follow-ups
- Risk alerts: “Fallback active”, “No active default instruction”, “No follow-up rules”

### B. Instructions (Default)
- Current active default instruction (DB)
- Editable sections:
  - `google_doc` text
  - `sheet_data` JSON/table editor
  - `static_instructions` text
- Save + Validate + Diff against previous save

### C. Versions
- List with search/filter/sort
- Create/edit/delete/activate/import/export
- Side-by-side diff (selected vs active)

### D. Follow-up Rules (new)
- Ordered list by step index
- Fields: delay minutes, message, active/inactive
- Reorder + add + remove + validate (delay > 0, message required)

### E. Build Preview
- Pick source (Default/Version)
- Build format (pretty/compact)
- Token/cost estimate
- Copy/download output

### F. Images
- Keep current API compatibility
- Card gallery + upload + URL import + bulk import
- Copy `[IMG:key]` token quickly

## 5) UX Principles
- Error prevention first: validation before save/import.
- Strong state visibility: show active version/default clearly.
- Fast operational path: max 2 clicks for common tasks.
- Progressive disclosure: advanced JSON options hidden by default.

## 6) Visual Direction
- Typography:
  - Heading: `Space Grotesk`
  - Body/UI: `IBM Plex Sans Thai`
  - Code/JSON: `JetBrains Mono`
- Color system (light-first):
  - Primary: `#0F766E` (teal)
  - Accent: `#EA580C` (orange)
  - Surface: layered warm-neutral gradients
- Motion:
  - Stagger-in list/card enter
  - Save success pulse
  - Route transition fade+slide (120-180ms)

## 7) Frontend Technical Design
- Stack: React + TypeScript + Vite
- State:
  - TanStack Query for server state
  - Zustand for local UI state (filters, view mode, draft form)
- Forms/validation:
  - React Hook Form + Zod
- UI structure:
  - `apps/admin/src/pages/*`
  - `apps/admin/src/features/*`
  - `apps/admin/src/components/*`
- API adapter layer:
  - `apps/admin/src/lib/api/*.ts`
  - Preserve existing backend endpoint contracts where possible

## 8) API Contract Mapping
- Keep compatibility with:
  - `GET /api/default`
  - `GET/POST/PUT/DELETE /api/versions*`
  - `POST /api/build`
  - `POST /api/import`
  - `GET/POST/DELETE /api/images*`
- Add new endpoints for follow-ups (planned):
  - `GET /api/followups`
  - `PUT /api/followups`

## 9) Accessibility
- Keyboard-first navigation
- Focus ring visible on all controls
- ARIA labels for icon-only actions
- Color contrast target WCAG AA

## 10) Rollout Plan
1. Build new UI in separate path (`/admin`) without touching runtime.
2. Run parallel with existing API.
3. Verify parity checklist for all legacy operations.
4. Switch entrypoint to `/admin`.
5. Remove remaining legacy UI assets/routes.

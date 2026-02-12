# THAYA Project Structure Redesign

## 1) Problems in Current Structure
- `index.js` is monolithic and mixes webhook, AI, orders, scheduler, and infra.
- Admin UI assets were tightly coupled and hard to evolve.
- Data-source logic (Google/DB/hardcode) is spread across files.
- Testing boundaries are unclear (domain/infrastructure not separated).

## 2) Target Architecture
- Modular monolith with clear layers:
  - `domain` (business rules)
  - `application` (use-cases/services)
  - `infrastructure` (db/google/http providers)
  - `interfaces` (http routes, webhook handlers, schedulers)

## 3) Proposed Folder Structure
```text
Thaya-3/
  apps/
    api/
      src/
        config/
        domain/
          instruction/
          followup/
          order/
          customer/
          chat/
        application/
          instruction/
          followup/
          order/
          chat/
        infrastructure/
          db/
          google/
          openai/
          facebook/
          storage/
        interfaces/
          http/
            routes/
            controllers/
            middleware/
          webhook/
          scheduler/
        shared/
          logger/
          errors/
          utils/
        server.ts
    admin/
      src/
        pages/
        features/
        components/
        lib/
  db/
    migrations/
    seeds/
  scripts/
    import-instruction-data.js
    deploy-bootstrap.js
  docs/
    new-ui-design.md
    new-project-structure.md
    db-first-migration-design.md
```

## 4) Module Ownership
- `instruction` module:
  - Active default instruction
  - Version lifecycle
  - Build instruction output
- `followup` module:
  - Rule CRUD/order
  - Due-user selection
  - Dispatch tracking
- `order` module:
  - Detection parse result normalization
  - Deduplication
  - DB save + optional external export

## 5) Runtime Data Source Policy
- Single config flag per source:
  - `INSTRUCTION_SOURCE=db|google|hybrid`
  - `FOLLOWUP_SOURCE=db|google|hybrid`
- Default target:
  - `db`
- `hybrid` allowed only for migration window.

## 6) API Layer Refactor Plan
### Phase A
- Extract existing route logic from `index.js` to controller files without behavior change.

### Phase B
- Move query logic into repository layer.
- Keep route contracts unchanged.

### Phase C
- Add explicit DTO schemas and validation.
- Add integration tests around critical endpoints.

## 7) Scheduler Refactor Plan
- Move follow-up scheduler into `interfaces/scheduler/followupScheduler`.
- Scheduler must depend only on application services.
- No direct SQL inside scheduler loop.

## 8) Testing Strategy
- Unit tests:
  - pure domain rules (status transition, followup timing).
- Integration tests:
  - route + db repository.
- Smoke tests:
  - webhook ingest
  - instruction build
  - followup cycle.

## 9) Deployment & Operations
- Keep startup bootstrap:
  - `scripts/deploy-bootstrap.js` imports DB defaults before server boot.
- Add health dimensions:
  - db connectivity
  - active default instruction exists
  - followup rules count > 0

## 10) Migration Sequence
1. Freeze legacy UI (done: removed source files).
2. Build new `/admin` app.
3. Refactor backend by slice (instruction -> followup -> order -> webhook).
4. Enable automated tests on deploy.
5. Remove old compatibility/fallback paths when metrics are stable.

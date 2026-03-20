## adr_000_openf1_cache_and_dataset_validation - OpenF1 cache and dataset validation
> Status: Accepted
> Date: 2026-03-20

# Context
- The project is a static analytics site with no runtime backend.
- Build-time data generation depends on OpenF1 and includes inferred metrics.
- Live-only fetches make rebuilds non-deterministic and fragile when the upstream API is slow, unavailable, or shape-shifts.

# Decision
- Persist raw OpenF1 request responses under `.cache/openf1/`, keyed by endpoint and normalized params.
- Keep the default build mode fresh-first by fetching live data and refreshing the cache.
- Support an explicit cache-only rebuild mode for deterministic offline regeneration of previously fetched sessions.
- Add a dataset validation script that checks the generated static JSON before production-style builds.

# Consequences
- Existing sessions can be rebuilt without a full live refetch once the cache is populated.
- New weekends still require an online refresh run.
- The repository remains static at runtime because caching and validation happen only during local or CI builds.

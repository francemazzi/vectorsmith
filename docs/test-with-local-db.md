# Integration Test Stack

Use this Docker Compose stack to launch the integration-test dependencies locally:

## Services

1. **Redis** — Caches and pub/sub (`redis:7.4-alpine`).
2. **Postgres + pgvector** — Vector-enabled relational database (`ankane/pgvector:latest`).
3. **SQLite** — Lightweight file-backed database for isolated tests (`keinos/sqlite3:latest`).

## Prerequisites

- Docker Desktop 4.0+ or compatible Docker Engine.
- Docker Compose v1.29+ (or the `docker compose` CLI plugin).

## Quick Start

```bash
cp env.test.example .env.test.local
docker compose --env-file .env.test.local up -d
```

- To rebuild from scratch:

```bash
docker compose --env-file .env.test.local down --volumes
docker compose --env-file .env.test.local up -d --build
```

## Connection URLs

| Service  | URL Template                                                           |
| -------- | ---------------------------------------------------------------------- |
| Redis    | `redis://localhost:${REDIS_PORT}`                                      |
| Postgres | `postgresql://${PG_USER}:${PG_PASSWORD}@localhost:${PG_PORT}/${PG_DB}` |
| SQLite   | `sqlite://${PWD}/${SQLITE_PATH}`                                       |

> ⚠️ Replace `${PWD}` with the absolute repository path on your machine (e.g., `/Users/francesco/Sviluppo/frasma_studio/vectorsmith`).

## Managing SQLite Data

- The container stores `.db` files under `.docker/sqlite/data`.
- Create a fresh database for tests:

```bash
docker exec -it vectorsmith-sqlite sqlite3 /data/test.db ".databases"
```

- Remove all persisted data:

```bash
rm -rf .docker/sqlite/data
```

## Health Checks

- Redis reports `PONG` via `redis-cli ping`.
- Postgres uses `pg_isready`.
- SQLite keeps the container alive and validates by querying `/data/test.db`. The file is created on first write.

## NPM Scripts

- `npm run docker:up` — Start the stack.
- `npm run docker:down` — Stop the stack and remove containers.
- `npm run docker:reset` — Recreate the stack from scratch (drops volumes).

Remember to inject production database URLs via environment variables when deploying; the Docker stack is intended strictly for local integration tests.

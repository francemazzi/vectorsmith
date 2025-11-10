# Test di Integrazione

Questa cartella contiene i test di integrazione che verificano il funzionamento dei componenti con i servizi esterni (Redis, Postgres, SQLite).

## Prerequisiti

Prima di eseguire i test di integrazione, assicurati che lo stack Docker sia avviato:

```bash
npm run docker:up
```

## Eseguire i Test

### Tutti i test di integrazione

```bash
npm run test:integration
```

### Tutti i test (unit + integrazione)

```bash
npm run test
```

### Test in modalità watch

```bash
npm run test:watch
```

### Interfaccia UI per i test

```bash
npm run test:ui
```

## Variabili d'Ambiente

I test utilizzano le seguenti variabili d'ambiente (con valori di default):

- `REDIS_HOST` (default: `localhost`)
- `REDIS_PORT` (default: `6380`)
- `PG_HOST` (default: `localhost`)
- `PG_PORT` (default: `55432`)
- `PG_USER` (default: `vectorsmith`)
- `PG_PASSWORD` (default: `vectorsmith`)
- `PG_DB` (default: `vectorsmith`)

Puoi sovrascrivere questi valori creando un file `.env.test.local` nella root del progetto.

## Test Disponibili

### Redis Adapter (`redis.adapter.test.ts`)

Verifica la connessione e le operazioni base con Redis:

- Connessione/disconnessione
- Operazioni GET/SET
- Verifica esistenza chiavi
- Eliminazione chiavi
- TTL (Time To Live)
- Ricerca chiavi per pattern

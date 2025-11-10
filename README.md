# VectorSmith

**A single TypeScript interface to connect and retrieve from the best vector databases.**

## 🎯 Vision

VectorSmith was born from the need to simplify integration with the most popular vector databases. Instead of learning different APIs for each database, you can use a single clean and simple interface to:

- **Connect** to one or more vector databases with a single configuration
- **Retrieve** similar vectors uniformly
- **Manage** collections/tables without needing to know the specifics of each database

## ✨ Features

- 🔌 **Multi-database**: Supports Redis, PostgreSQL (pgvector), and Qdrant
- 🎯 **Unified API**: Same interface for all databases
- ⚡ **Simple**: Intuitive configuration, zero boilerplate
- 🔒 **Type-safe**: Written in TypeScript with complete types
- 🧪 **Tested**: Complete integration test suite

## 📦 Installation

```bash
npm install vectorsmith
```

## 🚀 Quick Start

### Multi-Database Configuration

```typescript
import { VectorSmithAdapter } from "vectorsmith";

const adapter = new VectorSmithAdapter({
  redis: {
    host: "localhost",
    port: 6379,
  },
  pgvector: {
    host: "localhost",
    port: 5432,
    user: "postgres",
    password: "password",
    database: "vectors",
  },
  qdrant: {
    url: "http://localhost:6333",
  },
});

// Connect to all configured databases
await adapter.connect();

// Use the adapters
const redis = adapter.getRedis();
const pgvector = adapter.getPgVector();
const qdrant = adapter.getQdrant();
```

### Single Database Configuration

You can also configure just one database:

```typescript
// Redis only
const adapter = new VectorSmithAdapter({
  redis: {
    host: "localhost",
    port: 6379,
  },
});

await adapter.connect();
const redis = adapter.getRedis();
```

## 📚 Supported Databases

### Redis

- Basic operations: GET, SET, DELETE, EXISTS
- Pattern matching with KEYS
- TTL support

### PostgreSQL + pgvector

- Create tables with vector columns
- Insert vectors with metadata
- Search similar vectors (cosine, L2, inner product)

### Qdrant

- Create and delete collections
- Upsert vector points
- Search similar vectors with filters

## 💡 Usage Examples

### Redis - Vector Cache

```typescript
const redis = adapter.getRedis();
await redis.set("vector:123", JSON.stringify([0.1, 0.2, 0.3]));
const vector = await redis.get("vector:123");
```

### PostgreSQL - Vector Search

```typescript
const pgvector = adapter.getPgVector();

// Create table
await pgvector.createTable("documents", 768);

// Insert vector
const id = await pgvector.insertVector("documents", [0.1, 0.2, 0.3], {
  title: "Document 1",
  category: "tech",
});

// Search similar vectors
const results = await pgvector.searchSimilar(
  "documents",
  [0.1, 0.2, 0.3],
  10,
  "cosine"
);
```

### Qdrant - Vector Collections

```typescript
const qdrant = adapter.getQdrant();

// Create collection
await qdrant.createCollection("products", 128);

// Insert points
await qdrant.upsert("products", [
  {
    id: 1,
    vector: [0.1, 0.2, 0.3],
    payload: { name: "Product A", price: 99.99 },
  },
]);

// Search similar products
const results = await qdrant.search("products", [0.1, 0.2, 0.3], {
  limit: 5,
  withPayload: true,
});
```

## 🧪 Testing

The project includes a complete integration test suite that verifies functionality with all supported databases.

### Test Environment Setup

```bash
# Start Docker containers for testing
npm run docker:up

# Run integration tests
npm run test:integration
```

### Docker Test Stack

The project includes a `docker-compose.yml` that starts:

- Redis (port 6380)
- PostgreSQL with pgvector (port 55432)
- Qdrant (ports 6333/6334)
- SQLite (for isolated tests)

## 🛠️ Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run linting
npm run lint

# Test in watch mode
npm run test:watch
```

## 📝 Configuration

Supported environment variables:

```env
# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# PostgreSQL
PG_HOST=localhost
PG_PORT=5432
PG_USER=postgres
PG_PASSWORD=password
PG_DB=vectors

# Qdrant
QDRANT_ENDPOINT=http://localhost:6333
QDRANT_API_KEY=your-api-key
QDRANT_CLUSTER_ID=your-cluster-id
```

## 🤝 Contributing

Contributions are welcome! Open an issue or pull request for:

- Adding support for new vector databases
- Improving documentation
- Reporting bugs or proposing new features

## 📄 License

MIT

## 🔗 Useful Links

- [GitHub Repository](https://github.com/francemazzi/vectorsmith)
- [Issues](https://github.com/francemazzi/vectorsmith/issues)

---

**VectorSmith** - A single interface for all vector databases 🚀

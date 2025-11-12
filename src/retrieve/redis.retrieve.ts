import type { DatabaseRetriever, RetrieveRequest } from "./base.retrieve";
import type { RedisAdapter } from "../adapter/redis.adapter";

export interface RedisRetrieveQuery {
  readonly key: string;
}

export class RedisRetriever
  implements DatabaseRetriever<RedisRetrieveQuery, string | null>
{
  private readonly adapter: RedisAdapter;

  public constructor(adapter: RedisAdapter) {
    this.adapter = adapter;
  }

  public async retrieve(
    request: RetrieveRequest<RedisRetrieveQuery>
  ): Promise<string | null> {
    return await this.adapter.get(request.query.key);
  }
}

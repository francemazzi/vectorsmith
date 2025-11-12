import type { DatabaseRetriever, RetrieveRequest } from "./base.retrieve";
import type { PgVectorAdapter } from "../adapter/pg_vector.adpater";

export type PgVectorDistanceFunction = "cosine" | "l2" | "inner_product";

export interface PgVectorRetrieveQuery {
  readonly tableName: string;
  readonly queryVector: number[];
  readonly limit?: number;
  readonly distanceFunction?: PgVectorDistanceFunction;
}

export type PgVectorRetrieveResult = Awaited<
  ReturnType<PgVectorAdapter["searchSimilar"]>
>;

export class PgVectorRetriever
  implements DatabaseRetriever<PgVectorRetrieveQuery, PgVectorRetrieveResult>
{
  private readonly adapter: PgVectorAdapter;

  public constructor(adapter: PgVectorAdapter) {
    this.adapter = adapter;
  }

  public async retrieve(
    request: RetrieveRequest<PgVectorRetrieveQuery>
  ): Promise<PgVectorRetrieveResult> {
    const { tableName, queryVector, limit, distanceFunction } = request.query;
    return await this.adapter.searchSimilar(
      tableName,
      queryVector,
      limit,
      distanceFunction
    );
  }
}

import type { DatabaseRetriever, RetrieveRequest } from "./base.retrieve";
import type {
  QdrantAdapter,
  QdrantSearchOptions,
  QdrantSearchResult,
} from "../adapter/qdrant.adapter";

export interface QdrantRetrieveQuery {
  readonly collectionName: string;
  readonly vector: number[];
  readonly options?: QdrantSearchOptions;
}

export class QdrantRetriever
  implements DatabaseRetriever<QdrantRetrieveQuery, QdrantSearchResult[]>
{
  private readonly adapter: QdrantAdapter;

  public constructor(adapter: QdrantAdapter) {
    this.adapter = adapter;
  }

  public async retrieve(
    request: RetrieveRequest<QdrantRetrieveQuery>
  ): Promise<QdrantSearchResult[]> {
    const { collectionName, vector, options } = request.query;
    return await this.adapter.search(collectionName, vector, options);
  }
}

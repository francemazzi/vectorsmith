export interface RetrieveRequest<TQuery> {
  readonly query: TQuery;
}

export interface DatabaseRetriever<TQuery, TResult> {
  retrieve(request: RetrieveRequest<TQuery>): Promise<TResult>;
}

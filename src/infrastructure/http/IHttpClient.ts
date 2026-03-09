export interface IHttpClient {
  fetchJson<T>(url: string): Promise<T>;
}

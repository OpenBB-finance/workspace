import {
  logMessage,
  type RequestParams,
  type UdfErrorResponse,
  type UdfResponse,
} from "./helpers";

export class Requester {
  private _headers: HeadersInit | undefined;

  public constructor(headers?: HeadersInit) {
    if (headers) {
      this._headers = headers;
    }
  }

  public sendRequest<T extends UdfResponse>(
    datafeedUrl: string,
    urlPath: string,
    params?: RequestParams,
  ): Promise<T | UdfErrorResponse>;

  public sendRequest<T>(
    datafeedUrl: string,
    urlPath: string,
    params?: RequestParams,
  ): Promise<T>;

  public async sendRequest<T>(
    datafeedUrl: string,
    urlPath: string,
    params?: RequestParams,
  ): Promise<T> {
    const url = new URL(`${datafeedUrl}/${urlPath}`);

    if (params !== undefined) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value?.toString());
      }
    }

    logMessage(`New request: ${urlPath}`);

    // Send user cookies if the URL is on the same origin as the calling script.
    const options: RequestInit = { credentials: "same-origin" };

    if (this._headers !== undefined) {
      options.headers = this._headers;
    }

    const response = await fetch(url, options);
    const responseTest = await response.text();
    return JSON.parse(responseTest);
  }
}

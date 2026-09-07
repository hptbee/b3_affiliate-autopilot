export const DEFAULT_FACEBOOK_GRAPH_API_VERSION = 'v26.0';

export interface FacebookGraphErrorBody {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
}

export interface FacebookPageInfo {
  id: string;
  name: string;
}

export interface FacebookPublishPhotoResult {
  id: string;
  post_id?: string;
}

export interface FacebookPublishFeedResult {
  id: string;
}

export interface FacebookHttp {
  fetch: typeof fetch;
}

export interface FacebookGraphClientOptions {
  apiVersion?: string;
  http?: FacebookHttp;
}

export class FacebookGraphClient {
  private readonly apiVersion: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: FacebookGraphClientOptions = {}) {
    this.apiVersion = options.apiVersion ?? DEFAULT_FACEBOOK_GRAPH_API_VERSION;
    this.fetchImpl = options.http?.fetch ?? globalThis.fetch.bind(globalThis);
  }

  async getPage(pageId: string, accessToken: string): Promise<FacebookPageInfo> {
    const url = this.buildUrl(`/${pageId}`, { fields: 'id,name', access_token: accessToken });
    const response = await this.fetchImpl(url, { method: 'GET' });
    const body = await this.readJson<FacebookPageInfo & FacebookGraphErrorBody>(response);
    this.assertOk(response, body);
    if (!body.id || !body.name) {
      throw new Error('Facebook page verification returned incomplete data');
    }
    return { id: body.id, name: body.name };
  }

  async publishFeed(
    pageId: string,
    accessToken: string,
    message: string,
  ): Promise<FacebookPublishFeedResult> {
    const url = this.buildUrl(`/${pageId}/feed`);
    const form = new FormData();
    form.set('message', message);
    form.set('access_token', accessToken);

    const response = await this.fetchImpl(url, { method: 'POST', body: form });
    const body = await this.readJson<FacebookPublishFeedResult & FacebookGraphErrorBody>(response);
    this.assertOk(response, body);
    if (!body.id) {
      throw new Error('Facebook feed publish returned no post id');
    }
    return { id: body.id };
  }

  async publishPhoto(
    pageId: string,
    accessToken: string,
    input: { message: string; source: Blob; filename: string },
  ): Promise<FacebookPublishPhotoResult> {
    const url = this.buildUrl(`/${pageId}/photos`);
    const form = new FormData();
    form.set('message', input.message);
    form.set('access_token', accessToken);
    form.set('source', input.source, input.filename);

    const response = await this.fetchImpl(url, { method: 'POST', body: form });
    const body = await this.readJson<FacebookPublishPhotoResult & FacebookGraphErrorBody>(response);
    this.assertOk(response, body);
    if (!body.id) {
      throw new Error('Facebook photo publish returned no photo id');
    }
    return body;
  }

  private buildUrl(path: string, query?: Record<string, string>): string {
    const url = new URL(`https://graph.facebook.com/${this.apiVersion}${path}`);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        url.searchParams.set(key, value);
      }
    }
    return url.toString();
  }

  private async readJson<T>(response: Response): Promise<T> {
    try {
      return (await response.json()) as T;
    } catch {
      return {} as T;
    }
  }

  private assertOk(response: Response, body: FacebookGraphErrorBody): void {
    if (!response.ok || body.error) {
      const error = body.error ?? { message: `Facebook Graph API error (${response.status})` };
      throw Object.assign(new Error(error.message ?? 'Facebook Graph API error'), {
        facebookError: error,
        status: response.status,
      });
    }
  }
}

export function isFacebookGraphError(
  error: unknown,
): error is Error & { facebookError?: FacebookGraphErrorBody['error']; status?: number } {
  return error instanceof Error && 'facebookError' in error;
}

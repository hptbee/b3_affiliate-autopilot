export interface TikTokOAuthConfig {
  clientKey: string;
  clientSecret: string;
  redirectUri: string;
}

export interface TikTokTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  open_id?: string;
}

export interface TikTokUserInfoResponse {
  data?: {
    user?: {
      open_id?: string;
      display_name?: string;
      username?: string;
    };
  };
}

export class TikTokOAuth {
  private static readonly AUTHORIZE_URL = 'https://www.tiktok.com/v2/auth/authorize/';
  private static readonly TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/';
  private static readonly USER_INFO_URL = 'https://open.tiktokapis.com/v2/user/info/';
  private static readonly SCOPES = ['user.info.basic', 'video.upload', 'video.publish'];

  constructor(private readonly config: TikTokOAuthConfig) {}

  buildAuthorizeUrl(state: string): string {
    const params = new URLSearchParams({
      client_key: this.config.clientKey,
      response_type: 'code',
      scope: TikTokOAuth.SCOPES.join(','),
      redirect_uri: this.config.redirectUri,
      state,
    });
    return `${TikTokOAuth.AUTHORIZE_URL}?${params.toString()}`;
  }

  async exchangeCode(code: string) {
    const token = await this.requestToken({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.config.redirectUri,
    });

    const profile = await this.fetchUserInfo(token.access_token);
    const openId = profile.open_id ?? token.open_id ?? 'unknown';
    const displayName = profile.display_name ?? profile.username ?? openId;

    return {
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? null,
      expiresIn: token.expires_in ?? null,
      openId,
      displayName,
    };
  }

  async refreshToken(refreshToken: string) {
    const token = await this.requestToken({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });

    return {
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? refreshToken,
      expiresIn: token.expires_in ?? null,
    };
  }

  private async requestToken(body: Record<string, string>): Promise<TikTokTokenResponse> {
    const response = await fetch(TikTokOAuth.TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: this.config.clientKey,
        client_secret: this.config.clientSecret,
        ...body,
      }),
    });

    const json = (await response.json()) as {
      data?: TikTokTokenResponse;
      error?: { message?: string };
    };

    if (!response.ok || !json.data?.access_token) {
      throw new Error(json.error?.message ?? 'TikTok token exchange failed');
    }

    return json.data;
  }

  private async fetchUserInfo(accessToken: string) {
    const response = await fetch(
      `${TikTokOAuth.USER_INFO_URL}?fields=open_id,display_name,username`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    const json = (await response.json()) as TikTokUserInfoResponse;
    return json.data?.user ?? {};
  }
}

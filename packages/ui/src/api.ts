/**
 * Browser API client.
 * - The access token lives ONLY in memory (never localStorage/sessionStorage), so injected scripts can't read it from storage.
 * - The refresh token is an httpOnly cookie the browser sends to /auth/* automatically.
 * - On a 401, one refresh is attempted (single-flight, shared by parallel requests), then the request is retried once.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields: Record<string, string> = {},
    readonly requestId?: string,
  ) {
    super(message);
  }
}

export interface ApiClientOptions {
  base?: string;
  refreshPath: string;
  logoutPath: string;
  onSessionLost?: () => void;
}

export interface RefreshResult<U> {
  accessToken: string;
  user: U;
}

export function createApiClient<U = unknown>(opts: ApiClientOptions) {
  const base = opts.base ?? '/api/v1';
  let accessToken: string | null = null;
  let refreshing: Promise<RefreshResult<U> | null> | null = null;

  async function parse(res: Response) {
    const text = await res.text();
    let body: { data?: unknown; meta?: unknown; error?: { code: string; message: string; fields?: Record<string, string>; requestId?: string } } = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = {};
    }
    if (!res.ok) {
      const e = body.error;
      // No error envelope = the API itself didn't answer (stopped, starting up, or its database is unreachable).
      if (!e) throw new ApiError(res.status, 'SERVER_DOWN', 'errors.serverDown');
      throw new ApiError(res.status, e?.code ?? 'INTERNAL', e?.message ?? 'errors.INTERNAL', e?.fields ?? {}, e?.requestId);
    }
    return body;
  }

  /** Uses the refresh cookie to get a new access token. Returns null if there is no valid session. */
  function refresh(): Promise<RefreshResult<U> | null> {
    if (!refreshing) {
      refreshing = fetch(`${base}${opts.refreshPath}`, { method: 'POST', credentials: 'include' })
        .then(async (res) => {
          if (!res.ok) return null;
          const body = await parse(res);
          const data = body.data as RefreshResult<U>;
          accessToken = data.accessToken;
          return data;
        })
        .catch(() => null)
        .finally(() => {
          refreshing = null;
        });
    }
    return refreshing;
  }

  async function request<T>(method: string, path: string, body?: unknown, retry = true): Promise<{ data: T; meta?: Record<string, unknown> }> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    let res: Response;
    try {
      res = await fetch(`${base}${path}`, {
        method, headers, credentials: 'include', body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new ApiError(0, 'NETWORK', 'errors.network');
    }
    if (res.status === 401 && retry && !path.startsWith('/auth/')) {
      const r = await refresh();
      if (r) return request<T>(method, path, body, false);
      accessToken = null;
      opts.onSessionLost?.();
    }
    const parsed = await parse(res);
    return { data: parsed.data as T, meta: parsed.meta as Record<string, unknown> | undefined };
  }

  return {
    setToken(token: string | null) {
      accessToken = token;
    },
    refresh,
    async logout() {
      try {
        await fetch(`${base}${opts.logoutPath}`, { method: 'POST', credentials: 'include' });
      } finally {
        accessToken = null;
      }
    },
    get: <T>(path: string) => request<T>('GET', path).then((r) => r.data),
    getWithMeta: <T>(path: string) => request<T>('GET', path),
    post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}).then((r) => r.data),
    put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body ?? {}).then((r) => r.data),
    patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body ?? {}).then((r) => r.data),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

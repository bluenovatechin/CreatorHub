/**
 * Browser API client.
 * - The access token lives ONLY in memory (never localStorage/sessionStorage), so injected scripts can't read it from storage.
 * - The refresh token is an httpOnly cookie the browser sends to /auth/* automatically.
 * - On a 401, one refresh is attempted (single-flight, shared by parallel requests), then the request is retried once.
 * - Important writes can carry an idempotency key (WriteOptions), so a repeated click or retry is done only once.
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

/**
 * Options for writes. `idempotencyKey`: a random id for ONE user action (e.g. "Submit payment"). Keep the same key
 * when the person presses the button again after an error, and make a new one after success (newIdempotencyKey()).
 */
export interface WriteOptions { idempotencyKey?: string }

/** A fresh random idempotency key (one per user action). */
export const newIdempotencyKey = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `k${Date.now()}${Math.random().toString(36).slice(2)}`;

export function createApiClient<U = unknown>(opts: ApiClientOptions) {
  const base = opts.base ?? '/api/v1';
  let accessToken: string | null = null;
  let refreshing: Promise<RefreshResult<U> | null> | null = null;

  async function parse(res: Response) {
    const text = await res.text();
    let body: { data?: unknown; meta?: unknown; error?: { code: string; message: string; fields?: Record<string, string>; requestId?: string } };
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
      const send = () => fetch(`${base}${opts.refreshPath}`, { method: 'POST', credentials: 'include' });
      refreshing = (async () => {
        let res = await send();
        // Server waking up? Only retry answers that prove the login cookie was NOT used yet:
        // 502 = the host couldn't reach the API at all; 503 = the API is up but its database isn't (rejected first).
        // (A 504 timeout might have been processed, and re-sending a used cookie looks like theft, so never retry that.)
        for (const waitSeconds of [3, 5, 8, 12, 15, 15, 15]) {
          if (res.status !== 502 && res.status !== 503) break;
          await new Promise((r) => setTimeout(r, waitSeconds * 1000));
          res = await send();
        }
        return res;
      })()
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

  async function request<T>(method: string, path: string, body?: unknown, retry = true, write: WriteOptions = {}): Promise<{ data: T; meta?: Record<string, unknown> }> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    // The API does an action with this key only once and replays its answer to repeats (see middleware/idempotency.ts).
    if (write.idempotencyKey) headers['Idempotency-Key'] = write.idempotencyKey;
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    const send = () => fetch(`${base}${path}`, {
      method, headers, credentials: 'include', body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    let res: Response;
    try {
      res = await send();
      // The free API server sleeps when nobody uses it and needs up to ~1 minute to wake up. Meanwhile the host
      // answers 502/503/504. READ requests (GET) are safe to repeat, so wait and try again (≈ 70 s in total).
      // Writes (POST/PUT/PATCH) are only repeated when they carry an idempotency key: the API then does them once
      // however often they arrive. Without a key, repeating could, for example, sign someone up twice.
      const repeatable = method === 'GET' || !!write.idempotencyKey;
      for (const waitSeconds of [3, 5, 8, 12, 15, 15, 15]) {
        if (!repeatable || ![502, 503, 504].includes(res.status)) break;
        await new Promise((r) => setTimeout(r, waitSeconds * 1000));
        res = await send();
      }
    } catch {
      throw new ApiError(0, 'NETWORK', 'errors.network');
    }
    if (res.status === 401 && retry && !path.startsWith('/auth/')) {
      const r = await refresh();
      if (r) return request<T>(method, path, body, false, write);
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
    post: <T>(path: string, body?: unknown, opts?: WriteOptions) => request<T>('POST', path, body ?? {}, true, opts).then((r) => r.data),
    put: <T>(path: string, body?: unknown, opts?: WriteOptions) => request<T>('PUT', path, body ?? {}, true, opts).then((r) => r.data),
    patch: <T>(path: string, body?: unknown, opts?: WriteOptions) => request<T>('PATCH', path, body ?? {}, true, opts).then((r) => r.data),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

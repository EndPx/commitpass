/** Server route helper. Never import from a client component. */
export class ApiError extends Error {
  constructor(public status: number) {
    super("Request unavailable");
  }
}

export async function apiRead<T>(
  path: string,
  options: {
    token?: string;
    method?: string;
    body?: string;
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  const base = process.env.COMMITPASS_API_URL;
  if (!base) throw new ApiError(503);
  const response = await fetch(new URL(path, base), {
    method: options.method ?? "GET",
    body: options.body,
    headers: {
      Accept: "application/json",
      ...(options.token ? { Authorization: options.token } : {}),
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    cache: "no-store",
    redirect: "error",
    signal: options.signal
      ? AbortSignal.any([options.signal, AbortSignal.timeout(22000)])
      : AbortSignal.timeout(22000),
  });
  if (!response.ok) throw new ApiError(response.status);
  return response.json() as Promise<T>;
}

export function bearer(request: Request) {
  const token = request.headers.get("authorization");
  if (!token || token.length > 8200 || !/^Bearer [A-Za-z0-9._~-]+$/.test(token))
    throw new ApiError(401);
  return token;
}

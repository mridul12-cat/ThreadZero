export type Env = Record<string, string | undefined>;
export type Limiter = () => Promise<boolean>;
// Global rolling cooldown + 20 reservations per UTC day; failed calls count too.
export function memoryLimiter(now = () => Date.now()): Limiter {
  let next = 0,
    day = "",
    used = 0;
  return async () => {
    const time = now(),
      today = new Date(time).toISOString().slice(0, 10);
    if (day !== today) {
      day = today;
      used = 0;
    }
    if (time < next || used >= 20) return false;
    next = time + 65000;
    used++;
    return true;
  };
}
export function distributedLimiter(
  env: Env,
  fetcher: typeof fetch = fetch,
): Limiter {
  return async () => {
    const url = env.UPSTASH_REDIS_REST_URL,
      token = env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token || !/^https:\/\/[^/]+\.upstash\.io\/?$/.test(url))
      throw new Error("Shared rate limit is unavailable.");
    const day = new Date().toISOString().slice(0, 10);
    const script =
      "if redis.call('EXISTS',KEYS[1])==1 then return 0 end; local n=tonumber(redis.call('GET',KEYS[2]) or '0'); if n>=20 then return 0 end; redis.call('SET',KEYS[1],'1','EX',65); redis.call('INCR',KEYS[2]); redis.call('EXPIRE',KEYS[2],172800); return 1";
    const response = await fetcher(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        "EVAL",
        script,
        "2",
        "threadzero:magic:cooldown",
        `threadzero:magic:day:${day}`,
      ]),
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) throw new Error("Shared rate limit is unavailable.");
    const data = (await response.json()) as {
      result?: unknown;
      error?: unknown;
    };
    if (data.error || typeof data.result !== "number")
      throw new Error("Shared rate limit is unavailable.");
    return data.result === 1;
  };
}

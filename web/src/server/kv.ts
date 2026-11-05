/**
 * 小さなキー・値の保存場所。本番（Vercel）では Upstash Redis の REST API、手元とテストではプロセス内のメモリを使う。
 * サーバーレスでは要求ごとに別のインスタンスが応えることがあるため、本番の状態はここにだけ置く。
 */

export interface Kv {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  incr(key: string, ttlSeconds?: number): Promise<number>;
  /** 一覧の末尾に足す */
  push(key: string, value: unknown): Promise<void>;
  /** 一覧を古い順にすべて返す */
  list<T>(key: string): Promise<T[]>;
}

const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 30;

function createMemoryKv(): Kv {
  const values = new Map<string, unknown>();
  const lists = new Map<string, unknown[]>();
  return {
    get: async <T>(key: string) => structuredClone(values.get(key)) as T | undefined,
    set: async (key, value) => {
      values.set(key, structuredClone(value));
    },
    del: async (key) => {
      values.delete(key);
      lists.delete(key);
    },
    incr: async (key) => {
      const next = Number(values.get(key) ?? 0) + 1;
      values.set(key, next);
      return next;
    },
    push: async (key, value) => {
      lists.set(key, [...(lists.get(key) ?? []), structuredClone(value)]);
    },
    list: async <T>(key: string) => structuredClone(lists.get(key) ?? []) as T[],
  };
}

interface RestConfig {
  readonly url: string;
  readonly token: string;
}

function restConfigFromEnv(): RestConfig | null {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

function createRestKv(config: RestConfig): Kv {
  const command = async <T>(args: readonly (string | number)[]): Promise<T> => {
    const res = await fetch(config.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(args),
      cache: "no-store",
    });
    const body = (await res.json()) as { result?: T; error?: string };
    if (!res.ok || body.error) throw new Error(`保存場所への書き込みに失敗しました（${body.error ?? res.status}）`);
    return body.result as T;
  };
  const parse = <T>(raw: string | null): T | undefined => (raw == null ? undefined : (JSON.parse(raw) as T));
  return {
    get: async <T>(key: string) => parse<T>(await command<string | null>(["GET", key])),
    set: async (key, value, ttl = DEFAULT_TTL_SECONDS) => {
      await command(["SET", key, JSON.stringify(value), "EX", ttl]);
    },
    del: async (key) => {
      await command(["DEL", key]);
    },
    incr: async (key, ttl = DEFAULT_TTL_SECONDS) => {
      const next = await command<number>(["INCR", key]);
      if (next === 1) await command(["EXPIRE", key, ttl]);
      return next;
    },
    push: async (key, value) => {
      await command(["RPUSH", key, JSON.stringify(value)]);
    },
    list: async <T>(key: string) => (await command<string[]>(["LRANGE", key, 0, -1])).map((raw) => JSON.parse(raw) as T),
  };
}

export function isPersistentKv(): boolean {
  return restConfigFromEnv() !== null;
}

const globalForKv = globalThis as unknown as { __kv?: Kv };

export function getKv(): Kv {
  if (globalForKv.__kv) return globalForKv.__kv;
  const config = restConfigFromEnv();
  const kv = config ? createRestKv(config) : createMemoryKv();
  globalForKv.__kv = kv;
  return kv;
}

/** テスト用：毎回まっさらなメモリの保存場所 */
export function createTestKv(): Kv {
  return createMemoryKv();
}

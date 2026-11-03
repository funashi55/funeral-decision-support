/**
 * 案件の保存場所。今はプロセス内のメモリに置く（デモは1台のサーバーで動かす）。
 * 後で Supabase に差し替えるため、読み書きはこのインターフェース経由に限る。
 */
import type { CaseState } from "../engine/case";
import { DEMO_CASE } from "../engine/fixtures/demoCase";

export interface CaseStore {
  get(caseId: string): CaseState | undefined;
  /** 遺族の窓口の合言葉から案件を引く */
  findByToken(token: string): CaseState | undefined;
  save(state: CaseState): CaseState;
  reset(caseId: string): CaseState | undefined;
  subscribe(caseId: string, listener: (state: CaseState) => void): () => void;
}

type Listener = (state: CaseState) => void;

/** デモの初期状態：家族の名前と条件だけがあり、会話はこれから */
const SEEDS: Record<string, CaseState> = {
  [DEMO_CASE.caseId]: { ...DEMO_CASE, utterances: [], circumstances: [], decisions: {}, profile: { deceasedAge: 84 } },
};

function createMemoryStore(): CaseStore {
  const cases = new Map<string, CaseState>(Object.entries(SEEDS));
  const listeners = new Map<string, Set<Listener>>();
  const notify = (state: CaseState): void => {
    for (const l of listeners.get(state.caseId) ?? []) l(state);
  };
  return {
    get: (caseId) => cases.get(caseId),
    findByToken: (token) => [...cases.values()].find((c) => c.familyToken === token),
    save: (state) => {
      cases.set(state.caseId, state);
      notify(state);
      return state;
    },
    reset: (caseId) => {
      const seed = SEEDS[caseId];
      if (!seed) return undefined;
      cases.set(caseId, seed);
      notify(seed);
      return seed;
    },
    subscribe: (caseId, listener) => {
      const set = listeners.get(caseId) ?? new Set<Listener>();
      set.add(listener);
      listeners.set(caseId, set);
      return () => set.delete(listener);
    },
  };
}

/**
 * 開発中の再読み込みでも案件を失わないよう globalThis に置く。
 * 案件の形を変えたら版を上げる（古い形のまま残った保存場所を使わないように）
 */
const STORE_VERSION = 2;
const STORE_KEY = `__caseStore_v${STORE_VERSION}`;
const globalForStore = globalThis as unknown as Record<string, CaseStore | undefined>;
export const store: CaseStore = globalForStore[STORE_KEY] ?? createMemoryStore();
globalForStore[STORE_KEY] = store;

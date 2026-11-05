/**
 * 案件の保存場所。中身は kv.ts（本番は Upstash Redis、手元はメモリ）に置く。
 * 読み書きはこのインターフェース経由に限る。
 */
import { randomBytes } from "node:crypto";
import type { CaseState } from "../engine/case";
import { DEMO_CASE } from "../engine/fixtures/demoCase";
import { getKv, type Kv } from "./kv";

export interface CaseStore {
  get(caseId: string): Promise<CaseState | undefined>;
  /** 遺族の窓口の合言葉から案件を引く */
  findByToken(token: string): Promise<CaseState | undefined>;
  save(state: CaseState): Promise<CaseState>;
  /** 案件を最初の状態に戻す（家族の名前と条件だけがあり、会話はこれから） */
  reset(caseId: string): Promise<CaseState | undefined>;
  /** 試してもらう人ごとに、デモと同じ条件の新しい案件を作る */
  createTrial(): Promise<CaseState>;
  /** 更新のたびに増える番号。画面への配信が変化に気づくために使う */
  revision(caseId: string): Promise<number>;
}

/** 案件の形を変えたら版を上げる（古い形のまま残ったデータを読まないように） */
const STORE_VERSION = 5;
const caseKey = (id: string): string => `v${STORE_VERSION}:case:${id}`;
const revKey = (id: string): string => `v${STORE_VERSION}:rev:${id}`;
const tokenKey = (token: string): string => `v${STORE_VERSION}:token:${token}`;

export const TRIAL_PREFIX = "trial-";

function seedFor(caseId: string, familyToken: string): CaseState {
  return { ...DEMO_CASE, caseId, familyToken, utterances: [], circumstances: [], decisions: {}, profile: { deceasedAge: 84 } };
}

/**
 * 共用デモの窓口の合言葉。リポジトリに載っている合言葉は、試用で公開しているとき（ACCESS_CODE があるとき）は使わない。
 * 載っている合言葉で誰でも窓口を開き、案内役（AI）を呼べてしまうため。
 */
function demoToken(): string {
  return process.env.ACCESS_CODE ? randomBytes(12).toString("base64url") : (DEMO_CASE.familyToken ?? "");
}

function isKnownCase(caseId: string): boolean {
  return caseId === DEMO_CASE.caseId || caseId.startsWith(TRIAL_PREFIX);
}

export function createCaseStore(kv: Kv): CaseStore {
  const save = async (state: CaseState): Promise<CaseState> => {
    await kv.set(caseKey(state.caseId), state);
    if (state.familyToken) await kv.set(tokenKey(state.familyToken), state.caseId);
    await kv.incr(revKey(state.caseId));
    return state;
  };
  const get = async (caseId: string): Promise<CaseState | undefined> => {
    const saved = await kv.get<CaseState>(caseKey(caseId));
    if (saved) return saved;
    // デモの案件は、まだ一度も保存されていなければ最初の状態から始める
    return caseId === DEMO_CASE.caseId ? save(seedFor(caseId, demoToken())) : undefined;
  };
  return {
    get,
    save,
    findByToken: async (token) => {
      const direct = await kv.get<string>(tokenKey(token));
      const publicDemoToken = !process.env.ACCESS_CODE && token === DEMO_CASE.familyToken;
      const caseId = direct ?? (publicDemoToken ? DEMO_CASE.caseId : undefined);
      if (!caseId) return undefined;
      const state = await get(caseId);
      // 合言葉を作り直した後は、古い合言葉では引けない
      return state?.familyToken === token ? state : undefined;
    },
    reset: async (caseId) => {
      if (!isKnownCase(caseId)) return undefined;
      const current = await kv.get<CaseState>(caseKey(caseId));
      if (!current && caseId !== DEMO_CASE.caseId) return undefined;
      const token = caseId === DEMO_CASE.caseId ? demoToken() : (current?.familyToken ?? "");
      return save(seedFor(caseId, token));
    },
    createTrial: async () => {
      const id = `${TRIAL_PREFIX}${randomBytes(6).toString("base64url")}`;
      return save(seedFor(id, randomBytes(12).toString("base64url")));
    },
    revision: async (caseId) => Number((await kv.get<number>(revKey(caseId))) ?? 0),
  };
}

export const store: CaseStore = createCaseStore(getKv());

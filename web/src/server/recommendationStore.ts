/** 最後に出した推奨（寄り添いと提案・プランの見立て）。画面を開き直しても消えないよう、案件ごとに最新の1つを持つ */
import type { FarewellResult } from "../engine/farewell";
import type { PlanFitResult } from "../engine/planFit";
import { getKv, type Kv } from "./kv";

export interface SavedRecommendations {
  readonly farewell?: FarewellResult & { readonly basedOn: number };
  readonly planFit?: PlanFitResult & { readonly basedOn: number };
}

const key = (caseId: string): string => `v1:recs:${caseId}`;

export function createRecommendationStore(kv: Kv) {
  const get = async (caseId: string): Promise<SavedRecommendations> => (await kv.get<SavedRecommendations>(key(caseId))) ?? {};
  return {
    get,
    put: async (caseId: string, patch: SavedRecommendations): Promise<void> => {
      await kv.set(key(caseId), { ...(await get(caseId)), ...patch });
    },
    clear: (caseId: string): Promise<void> => kv.set(key(caseId), {}),
  };
}

export const recommendationStore = createRecommendationStore(getKv());

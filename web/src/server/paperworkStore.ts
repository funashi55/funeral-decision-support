/** 打合せの後の実務（まとめ・TODO・発注書）の保存場所。案件ごとに最新の1つだけを持つ */
import type { Paperwork } from "../engine/paperwork";
import { getKv, type Kv } from "./kv";

/** 形を変えたら版を上げる（受注書・日程・確認欄を足したので v2） */
const key = (caseId: string): string => `v2:paperwork:${caseId}`;

export function createPaperworkStore(kv: Kv) {
  return {
    get: (caseId: string): Promise<Paperwork | undefined> => kv.get<Paperwork>(key(caseId)),
    save: async (paperwork: Paperwork): Promise<Paperwork> => {
      await kv.set(key(paperwork.caseId), paperwork);
      return paperwork;
    },
  };
}

export const paperworkStore = createPaperworkStore(getKv());

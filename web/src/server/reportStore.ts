/** 打合せの記録の保存場所。案件ごとに、回の順に並べて持つ（案件と同じく30日で消える） */
import { normalizeReport, type MeetingReport } from "../engine/report";
import { getKv, type Kv } from "./kv";

const key = (caseId: string): string => `v1:reports:${caseId}`;
/** 1つの案件に置く記録の数の上限 */
export const MAX_REPORTS = 30;

export function createReportStore(kv: Kv) {
  return {
    list: async (caseId: string): Promise<MeetingReport[]> => ((await kv.get<MeetingReport[]>(key(caseId))) ?? []).map(normalizeReport),
    add: async (report: MeetingReport): Promise<MeetingReport[]> => {
      const all = [...((await kv.get<MeetingReport[]>(key(report.caseId))) ?? []).map(normalizeReport), report].slice(-MAX_REPORTS);
      await kv.set(key(report.caseId), all);
      return all;
    },
    clear: (caseId: string): Promise<void> => kv.del(key(caseId)),
  };
}

export const reportStore = createReportStore(getKv());

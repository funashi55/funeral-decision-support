/**
 * デモの日付（架空）。「最初から」を押した日を亡くなった日とし、通夜・葬儀などはそこから数える。
 * 日付を固定すると、審査やデモを見る日によっては、終わった葬儀の発注書になってしまうため。
 * 台本の筋：孫は3日後に着く → 納棺と通夜は3日後、葬儀と火葬は4日後
 */
import type { Registration } from "../registration";

/** 亡くなった時刻（早朝に病院からお迎え） */
const DIED_TIME = "05:30";
const JST_OFFSET_MS = 9 * 3_600_000;
const DAY_MS = 86_400_000;

/** 今日（日本時間）の朝5時30分を、登録の形（2026-11-07T05:30）で返す */
export function demoDiedAt(now: number = Date.now()): string {
  return `${new Date(now + JST_OFFSET_MS).toISOString().slice(0, 10)}T${DIED_TIME}`;
}

export interface DemoDates {
  /** 亡くなった日 */
  readonly death: string;
  /** 孫が着き、納棺と通夜をする日（3日後） */
  readonly wake: string;
  /** 葬儀と火葬の日（4日後） */
  readonly funeral: string;
}

/** 「2026-11-07T05:30」から、台本と確定の値に使う日付（「11月10日」の形）を作る */
export function demoDates(diedAt: string): DemoDates {
  const day = diedAt.slice(0, 10);
  const base = Date.parse(`${day}T00:00:00Z`);
  const label = (offset: number): string => {
    const d = new Date(base + offset * DAY_MS);
    return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日`;
  };
  return { death: label(0), wake: label(3), funeral: label(4) };
}

/** 受付で伺ったこと（架空）。人物はすべて架空 */
export function demoRegistration(diedAt: string): Registration {
  return {
    familyName: "山田",
    staffName: "佐藤（2年目）",
    deceased: { name: "山田 ハナ", age: 84, sex: "女性", diedAt, diedPlace: "市内の病院" },
    chiefMourner: { relation: "長女", name: undefined, phone: undefined },
    /** 町名までの架空の住所（番地は持たない） */
    homeAddress: "東京都杉並区阿佐谷南1丁目",
    membership: "わからない",
    funeralStyle: "家族葬",
    religion: undefined,
    temple: undefined,
    restingPlace: "会館",
    memo: "早朝に病院からお迎え。会館の安置室に安置",
    registeredAt: 0,
  };
}

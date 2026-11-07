/**
 * sou-buddy のバディ：担当者ひとりひとりに合わせて育つ支援。
 * 葬儀は百者百様で、ひとつの正解の接客はない。だから同じ出し方を全員に押しつけず、担当者の話し方に寄せていく。
 * - 担当者が選ぶもの：言葉の調子・支援の量
 * - 使っていて育つもの：自分の言い方（寄り添いの言葉を自分の言葉で残す）と、伝えた／使わなかったの記録
 * 育つのは「言い方」と「寄り添いの並び」だけ。どのお別れの仕方・プランを勧めるかは、担当者の癖で変えない（高い案へ寄らないように）。
 */
import { z } from "zod";

export const BRAND = { name: "sou-buddy", display: "sou-buddy", tagline: "葬儀の担当者に寄り添うバディ" } as const;

export const TONES = ["gentle", "plain", "brief"] as const;
export type Tone = (typeof TONES)[number];
export const TONE_LABEL: Readonly<Record<Tone, string>> = { gentle: "やわらかく、ていねいに", plain: "ふつうに", brief: "短く、端的に" };
const TONE_PROMPT: Readonly<Record<Tone, string>> = {
  gentle: "担当者は、やわらかく、ていねいな言葉づかいを好みます。かける言葉・切り出し方は、間をとった柔らかい言い方にしてください。",
  plain: "",
  brief: "担当者は、短く端的な言い方を好みます。かける言葉・切り出し方は、一文で短くしてください。",
};

export const AMOUNTS = ["full", "focused"] as const;
export type Amount = (typeof AMOUNTS)[number];
export const AMOUNT_LABEL: Readonly<Record<Amount, string>> = { full: "全部見せる", focused: "要点だけ（ひとつずつ）" };

const MAX_PHRASES = 5;
export const PhraseSchema = z.string().trim().min(2, "言い方を入れてください").max(80, "80文字までにしてください");

const UsageSchema = z.object({ told: z.number().int().min(0).default(0), unused: z.number().int().min(0).default(0) });

export const BuddyProfileSchema = z.object({
  staffName: z.string().trim().min(1).max(20),
  tone: z.enum(TONES).default("plain"),
  amount: z.enum(AMOUNTS).default("full"),
  /** 寄り添いの考え方ごとの、自分の言い方（新しい順） */
  phrases: z.record(z.string(), z.array(PhraseSchema).max(MAX_PHRASES)).default({}),
  /** 提案・寄り添いごとの、伝えた／使わなかったの数（target は "care:…" など） */
  usage: z.record(z.string(), UsageSchema).default({}),
});
export type BuddyProfile = z.output<typeof BuddyProfileSchema>;

export function emptyProfile(staffName: string): BuddyProfile {
  return BuddyProfileSchema.parse({ staffName });
}

export const BuddySettingsSchema = z.object({ tone: z.enum(TONES).optional(), amount: z.enum(AMOUNTS).optional() });

export function withSettings(p: BuddyProfile, s: z.output<typeof BuddySettingsSchema>): BuddyProfile {
  return { ...p, tone: s.tone ?? p.tone, amount: s.amount ?? p.amount };
}

/** 自分の言い方を残す（同じものは先頭に寄せ、5つまで） */
export function addPhrase(p: BuddyProfile, principleId: string, raw: string): BuddyProfile {
  const text = PhraseSchema.parse(raw);
  const list = [text, ...(p.phrases[principleId] ?? []).filter((x) => x !== text)].slice(0, MAX_PHRASES);
  return { ...p, phrases: { ...p.phrases, [principleId]: list } };
}

export function removePhrase(p: BuddyProfile, principleId: string, text: string): BuddyProfile {
  const list = (p.phrases[principleId] ?? []).filter((x) => x !== text);
  const rest = Object.fromEntries(Object.entries(p.phrases).filter(([k]) => k !== principleId));
  return { ...p, phrases: list.length > 0 ? { ...rest, [principleId]: list } : rest };
}

export type Verdict = "told" | "unused";

/** 伝えた／使わなかったを数える。押し直し（前の記録あり）は前の数を戻してから足す */
export function recordUsage(p: BuddyProfile, target: string, before: Verdict | undefined, after: Verdict | undefined): BuddyProfile {
  const u = p.usage[target] ?? { told: 0, unused: 0 };
  const minus = before ? { ...u, [before]: Math.max(0, u[before] - 1) } : u;
  const next = after ? { ...minus, [after]: minus[after] + 1 } : minus;
  return { ...p, usage: { ...p.usage, [target]: next } };
}

/** 寄り添いの考え方の、この担当者にとっての手ごたえ（伝えた − 使わなかった） */
function affinity(p: BuddyProfile, principleId: string): number {
  const u = p.usage[`care:${principleId}`];
  const own = (p.phrases[principleId]?.length ?? 0) > 0 ? 1 : 0;
  return (u ? u.told - u.unused : 0) + own;
}

/** 寄り添いの並び：よく使う考え方を前へ（同じなら元の順）。消しはしない */
export function orderCare<T extends { readonly principleId: string }>(p: BuddyProfile | null, items: readonly T[]): T[] {
  if (!p) return [...items];
  return items.map((x, i) => ({ x, i, a: affinity(p, x.principleId) })).sort((m, n) => n.a - m.a || m.i - n.i).map((m) => m.x);
}

/** 育ち具合（伝えた・使わなかったの合計と、残した言い方の数） */
export function growth(p: BuddyProfile): { readonly told: number; readonly unused: number; readonly phrases: number } {
  const all = Object.values(p.usage);
  return {
    told: all.reduce((s, u) => s + u.told, 0),
    unused: all.reduce((s, u) => s + u.unused, 0),
    phrases: Object.values(p.phrases).reduce((s, l) => s + l.length, 0),
  };
}

/** 生成の指示に足す、この担当者の話し方（自分の言い方は例として渡す。中身の判断は変えない） */
export function stylePrompt(p: BuddyProfile | null): string {
  if (!p) return "";
  const own = Object.entries(p.phrases).flatMap(([id, l]) => l.slice(0, 2).map((t) => `- ${id}：「${t}」`));
  const lines = [TONE_PROMPT[p.tone], own.length > 0 ? `担当者が自分で使っている言い方です。かける言葉は、この言い方の調子に寄せてください（そのまま写さなくてよい）。\n${own.join("\n")}` : ""].filter(Boolean);
  return lines.length > 0 ? `\n\n# この担当者の話し方（言い方だけに使う。勧める中身は変えない）\n${lines.join("\n")}` : "";
}

/**
 * 喪家（新しいご家族）の登録。受付で聞いたことを入れて案件を作り、そのまま打合せの画面へ進む。
 * 受付で聞いた事実（喪主・会員かどうか・宗派・菩提寺・安置先）は、担当者が入れたものとして確定済みにする。
 * まだ決まっていないことは空のまま残し、打合せで決める。
 */
import { z } from "zod";
import type { CaseState, DecisionState } from "./case";

const text = (max: number) => z.string().trim().max(max);
const optional = (max: number) => text(max).optional().transform((v) => (v ? v : undefined));

export const MEMBERSHIP_OPTIONS = ["互助会の会員", "会員ではない", "わからない"] as const;
export const FUNERAL_STYLE_OPTIONS = ["家族葬", "一日葬", "一般葬", "火葬式", "未定"] as const;
export const SEX_OPTIONS = ["女性", "男性", "答えない"] as const;
export const RESTING_OPTIONS = ["自宅", "会館", "未定"] as const;

export const RegistrationSchema = z.object({
  /** 家名（例：山田家）。「家」がなければ足す */
  familyName: text(30).min(1, "家名を入れてください"),
  /** この喪家を受け持つ担当者の名前（発注書・受注書の担当欄に入る） */
  staffName: optional(20),
  deceased: z.object({
    name: optional(40),
    age: z.coerce.number().int().min(0).max(120).optional(),
    sex: z.enum(SEX_OPTIONS).optional(),
    /** 亡くなった日時（例：2026-11-07T05:30） */
    diedAt: optional(30),
    /** 亡くなった場所（病院・自宅・施設など） */
    diedPlace: optional(60),
  }),
  chiefMourner: z.object({
    name: optional(40),
    /** 故人から見た続柄（例：長女） */
    relation: text(20).min(1, "喪主の続柄を入れてください"),
    phone: optional(20).refine((v) => !v || /^[0-9０-９+\-－() ]{6,20}$/.test(v), "電話番号の形で入れてください"),
  }),
  membership: z.enum(MEMBERSHIP_OPTIONS),
  funeralStyle: z.enum(FUNERAL_STYLE_OPTIONS),
  religion: optional(30),
  temple: optional(60),
  restingPlace: z.enum(RESTING_OPTIONS),
  /** 受付のメモ（お迎えの状況など） */
  memo: optional(400),
});

export type RegistrationInput = z.input<typeof RegistrationSchema>;
export type Registration = z.output<typeof RegistrationSchema> & { readonly registeredAt: number };

const confirmed = (value: string): DecisionState => ({ value, status: "confirmed", utteranceIds: [] });

/** 家名に「家」を付ける（「山田」→「山田家」） */
export function normalizeFamilyName(name: string): string {
  const n = name.trim();
  return n.endsWith("家") ? n : `${n}家`;
}

/** 受付で聞いた事実から、確定済みの決定を作る */
export function decisionsFrom(r: Registration): Record<string, DecisionState> {
  const d: Record<string, DecisionState> = {
    chief_mourner: confirmed([r.chiefMourner.relation, r.chiefMourner.name].filter(Boolean).join("・")),
  };
  if (r.membership !== "わからない") d.membership = confirmed(r.membership === "互助会の会員" ? "会員" : "一般（会員ではない）");
  if (r.funeralStyle !== "未定") d.funeral_style = confirmed(r.funeralStyle);
  if (r.religion) d.religion = confirmed(r.religion);
  if (r.temple) d.temple = confirmed(r.temple);
  if (r.restingPlace !== "未定") d.resting_place = confirmed(r.restingPlace);
  return d;
}

/** 登録の内容から、新しい案件を作る（会話はこれから） */
export function caseFromRegistration(caseId: string, familyToken: string, input: Registration): CaseState {
  const style = input.funeralStyle === "未定" ? undefined : input.funeralStyle;
  return {
    caseId,
    familyName: normalizeFamilyName(input.familyName),
    profile: {
      ...(input.deceased.age !== undefined ? { deceasedAge: input.deceased.age } : {}),
      ...(style ? { funeralStyle: style } : {}),
      ...(input.membership === "互助会の会員" ? { membership: "互助会の会員" as const } : input.membership === "会員ではない" ? { membership: "会員ではない" as const } : {}),
    },
    registration: input,
    utterances: [],
    circumstances: [],
    decisions: decisionsFrom(input),
    requests: [],
    familyToken,
    familyLinkRevoked: false,
    feedback: [],
    familyChat: [],
    familyNotes: [],
    customTodos: [],
    audit: [{ at: input.registeredAt, actor: "staff", kind: "register", summary: `喪家を登録した：${normalizeFamilyName(input.familyName)}`, refs: [] }],
  };
}

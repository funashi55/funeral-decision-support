/**
 * 受付の事実（故人のお名前・年齢・性別・亡くなった日時と場所・喪主のお名前と電話・喪家の住所・担当者）。
 * 登録では家名だけが必須で、ほかは空のまま始めてよい。会話から拾えたものは「候補」として入り、担当者が確定すると登録の内容になる。
 * あとで変わったら、担当者がいつでも書き直せる。
 */
import { z } from "zod";
import type { CaseState } from "./case";
import { RegistrationSchema, SEX_OPTIONS, type Registration } from "./registration";

export const FACT_KEYS = [
  "deceasedName",
  "deceasedAge",
  "deceasedSex",
  "diedAt",
  "diedPlace",
  "mournerName",
  "mournerPhone",
  "homeAddress",
  "staffName",
] as const;
export type FactKey = (typeof FACT_KEYS)[number];

/** 会話から候補として拾ってよいもの（日時・電話・担当者は聞き違いが怖いので、手で入れる） */
export const EXTRACTABLE_FACTS = [
  "deceasedName",
  "deceasedAge",
  "deceasedSex",
  "diedPlace",
  "mournerName",
  "homeAddress",
] as const satisfies readonly FactKey[];

export const FACT_LABEL: Readonly<Record<FactKey, string>> = {
  deceasedName: "故人のお名前",
  deceasedAge: "故人の年齢",
  deceasedSex: "故人の性別",
  diedAt: "亡くなった日時",
  diedPlace: "亡くなった場所",
  mournerName: "喪主のお名前",
  mournerPhone: "喪主の電話",
  homeAddress: "喪家（ご自宅）の住所",
  staffName: "担当者",
};

export interface FactCandidate {
  readonly value: string;
  readonly utteranceIds: readonly string[];
}

/** 値の形の確かめ（登録の入力と同じ決まり） */
const FACT_SCHEMA: Readonly<Record<FactKey, z.ZodType<string>>> = {
  deceasedName: z.string().trim().min(1).max(40),
  deceasedAge: z
    .string()
    .trim()
    .regex(/^\d{1,3}$/, "年齢は数字で入れてください")
    .refine((v) => Number(v) <= 120, "年齢を確かめてください"),
  deceasedSex: z.enum(SEX_OPTIONS),
  diedAt: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/, "日時の形で入れてください"),
  diedPlace: z.string().trim().min(1).max(60),
  mournerName: z.string().trim().min(1).max(40),
  mournerPhone: z
    .string()
    .trim()
    .regex(/^[0-9０-９+\-－() ]{6,20}$/, "電話番号の形で入れてください"),
  homeAddress: z.string().trim().min(4).max(120),
  staffName: z.string().trim().min(1).max(20),
};

export function parseFact(key: FactKey, value: string): string {
  return FACT_SCHEMA[key].parse(value);
}

/** 登録に入っている値（確定済み） */
export function factValue(
  r: Registration | undefined,
  key: FactKey,
): string | undefined {
  if (!r) return undefined;
  const v = {
    deceasedName: r.deceased.name,
    deceasedAge:
      r.deceased.age !== undefined ? String(r.deceased.age) : undefined,
    deceasedSex: r.deceased.sex,
    diedAt: r.deceased.diedAt,
    diedPlace: r.deceased.diedPlace,
    mournerName: r.chiefMourner.name,
    mournerPhone: r.chiefMourner.phone,
    homeAddress: r.homeAddress,
    staffName: r.staffName,
  }[key];
  return v === "" ? undefined : v;
}

/** 登録の空の形（家名だけ）。登録のない案件（試用のデモ）で事実を確定するときに使う */
export function emptyRegistration(familyName: string, at: number): Registration {
  return { ...RegistrationSchema.parse({ familyName }), registeredAt: at };
}

/** 事実を確定して登録に書き込む（新しい案件の状態を返す）。その事実の候補は消す */
export function confirmFact(
  state: CaseState,
  key: FactKey,
  raw: string,
  at: number,
): CaseState {
  const value = parseFact(key, raw);
  const r = state.registration ?? emptyRegistration(state.familyName, at);
  const d = r.deceased;
  const m = r.chiefMourner;
  const registration: Registration =
    key === "deceasedName"
      ? { ...r, deceased: { ...d, name: value } }
      : key === "deceasedAge"
        ? { ...r, deceased: { ...d, age: Number(value) } }
        : key === "deceasedSex"
          ? {
              ...r,
              deceased: { ...d, sex: value as (typeof SEX_OPTIONS)[number] },
            }
          : key === "diedAt"
            ? { ...r, deceased: { ...d, diedAt: value } }
            : key === "diedPlace"
              ? { ...r, deceased: { ...d, diedPlace: value } }
              : key === "mournerName"
                ? { ...r, chiefMourner: { ...m, name: value } }
                : key === "mournerPhone"
                  ? { ...r, chiefMourner: { ...m, phone: value } }
                  : key === "homeAddress"
                    ? { ...r, homeAddress: value }
                    : { ...r, staffName: value };
  const rest = Object.fromEntries(Object.entries(state.factCandidates ?? {}).filter(([k]) => k !== key));
  const profile =
    key === "deceasedAge"
      ? { ...state.profile, deceasedAge: Number(value) }
      : state.profile;
  return { ...state, registration, factCandidates: rest, profile };
}

/** 会話から拾った候補を入れる。確定済みの事実は上書きしない。形が合わない値・根拠のない値は捨てる */
export function applyFactCandidates(
  state: CaseState,
  found: readonly {
    readonly key: FactKey;
    readonly value: string;
    readonly utteranceIds: readonly string[];
  }[],
): CaseState {
  const known = new Set(state.utterances.map((u) => u.id));
  const next: Partial<Record<FactKey, FactCandidate>> = {
    ...(state.factCandidates ?? {}),
  };
  for (const f of found) {
    if (factValue(state.registration, f.key) !== undefined) continue;
    const ids = f.utteranceIds.filter((id) => known.has(id));
    const parsed = FACT_SCHEMA[f.key].safeParse(f.value);
    if (ids.length === 0 || !parsed.success) continue;
    next[f.key] = { value: parsed.data, utteranceIds: ids };
  }
  return { ...state, factCandidates: next };
}

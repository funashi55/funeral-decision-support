/**
 * 試してもらった人から集めるもの：ベテランの場面への答え（以前の設問形式）と、ロールプレイの聞き取り（/veteran）と、画面のどこからでも送れる感想。
 * 保存先は kv.ts（本番は Upstash Redis）。取り出しは scripts/trial-pull.ts で docs/private/ に書き出す。
 */
import { z } from "zod";
import { HEARING_SCENES } from "../data/hearingScenes";
import { FITS, SCENES } from "../data/judgmentScenes";
import { ExtractedJudgmentSchema, HearingTurnsSchema, TURN_TEXT_MAX } from "../engine/hearing";
import { FAREWELL_OPTIONS } from "../domain/farewell";
import { getKv, type Kv } from "./kv";

export const ANSWERS_KEY = "trial:veteran-answers";
export const NOTES_KEY = "trial:notes";

const NAME_MAX = 40;
const REASON_MAX = 600;
const NOTE_MAX = 2000;

const optionIds = FAREWELL_OPTIONS.map((o) => o.id) as [string, ...string[]];
const sceneIds = SCENES.map((s) => s.id) as [string, ...string[]];

const SceneAnswerSchema = z.object({
  fits: z.partialRecord(z.enum(optionIds), z.enum(FITS as [string, ...string[]])),
  reason: z.string().max(REASON_MAX).default(""),
});

export const VeteranSubmissionSchema = z.object({
  respondent: z.string().trim().min(1).max(NAME_MAX),
  scenes: z.partialRecord(z.enum(sceneIds), SceneAnswerSchema),
  comment: z.string().max(NOTE_MAX).default(""),
});

export type VeteranSubmission = z.infer<typeof VeteranSubmissionSchema> & { readonly at: number };

export const NoteSchema = z.object({
  name: z.string().trim().max(NAME_MAX).default(""),
  page: z.string().max(200),
  text: z.string().trim().min(1).max(NOTE_MAX),
});

export type TrialNote = z.infer<typeof NoteSchema> & { readonly at: number };

export async function saveVeteranSubmission(input: unknown, kv: Kv = getKv(), now = Date.now()): Promise<VeteranSubmission> {
  const parsed = VeteranSubmissionSchema.parse(input);
  const submission: VeteranSubmission = { ...parsed, at: now };
  await kv.push(ANSWERS_KEY, submission);
  return submission;
}

export async function saveNote(input: unknown, kv: Kv = getKv(), now = Date.now()): Promise<TrialNote> {
  const note: TrialNote = { ...NoteSchema.parse(input), at: now };
  await kv.push(NOTES_KEY, note);
  return note;
}

export async function listVeteranSubmissions(kv: Kv = getKv()): Promise<VeteranSubmission[]> {
  return kv.list<VeteranSubmission>(ANSWERS_KEY);
}

export async function listNotes(kv: Kv = getKv()): Promise<TrialNote[]> {
  return kv.list<TrialNote>(NOTES_KEY);
}

// ---- ロールプレイの聞き取り（/veteran） ----

export const HEARINGS_KEY = "trial:veteran-hearings";

const hearingSceneIds = HEARING_SCENES.map((s) => s.id) as [string, ...string[]];

export const HearingSubmissionSchema = z.object({
  respondent: z.string().trim().min(1).max(NAME_MAX),
  /** 葬祭の仕事の経験年数（自己申告）。経験の違う担当者どうしで比べるために使う */
  experience: z.enum(["under1", "1to3", "3to10", "over10"]),
  sceneId: z.enum(hearingSceneIds),
  mode: z.enum(["voice", "chat"]),
  turns: HearingTurnsSchema,
  /** 家族が話した隠れた事情の ID（話した順） */
  revealed: z.array(z.string().max(40)).max(20),
  fits: z.partialRecord(z.enum(optionIds), z.enum(["suits", "consider", "not_now", "unknown"])),
  judgments: z
    .array(ExtractedJudgmentSchema.extend({ verdict: z.enum(["agree", "disagree", "unsure"]), note: z.string().max(REASON_MAX).default("") }))
    .max(12),
  firstWords: z.string().max(TURN_TEXT_MAX).default(""),
  comment: z.string().max(NOTE_MAX).default(""),
});

export type HearingSubmission = z.infer<typeof HearingSubmissionSchema> & { readonly at: number };

export async function saveHearing(input: unknown, kv: Kv = getKv(), now = Date.now()): Promise<HearingSubmission> {
  const submission: HearingSubmission = { ...HearingSubmissionSchema.parse(input), at: now };
  await kv.push(HEARINGS_KEY, submission);
  return submission;
}

export async function listHearings(kv: Kv = getKv()): Promise<HearingSubmission[]> {
  return kv.list<HearingSubmission>(HEARINGS_KEY);
}

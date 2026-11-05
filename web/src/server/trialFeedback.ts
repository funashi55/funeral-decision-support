/**
 * 試してもらった人から集めるもの：ベテランの場面への答え（/veteran）と、画面のどこからでも送れる感想。
 * 保存先は kv.ts（本番は Upstash Redis）。取り出しは scripts/trial-pull.ts で docs/private/ に書き出す。
 */
import { z } from "zod";
import { FITS, SCENES } from "../data/judgmentScenes";
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

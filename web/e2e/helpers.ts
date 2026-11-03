import type { APIRequestContext } from "@playwright/test";

export const CASE_ID = "demo-yamada";
export const FAMILY_TOKEN = "yamada-k7m2q9";
export const FAMILY_PATH = `/f/${FAMILY_TOKEN}`;

export async function resetCase(request: APIRequestContext): Promise<void> {
  const res = await request.post(`/api/cases/${CASE_ID}/reset`);
  if (!res.ok()) throw new Error(`reset failed: ${res.status()}`);
}

/** 担当者が確定したのと同じ操作（決めることボードの「確定する」と同じ API） */
export async function confirmDecision(request: APIRequestContext, decisionId: string, value: string): Promise<void> {
  const res = await request.post(`/api/cases/${CASE_ID}/decisions`, { data: { decisionId, value } });
  if (!res.ok()) throw new Error(`confirm failed: ${res.status()}`);
}

export async function addUtterance(request: APIRequestContext, text: string): Promise<void> {
  const res = await request.post(`/api/cases/${CASE_ID}/utterances`, { data: { speaker: "chief_mourner", speakerLabel: "喪主（長女）", text, at: 0 } });
  if (!res.ok()) throw new Error(`utterance failed: ${res.status()}`);
}

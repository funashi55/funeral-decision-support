import type { CaseMode } from "./caseMode";

/**
 * 発注書・受注書に書く発注元の会社。
 * - デモの案件：いつも架空の会社（実在の社名・電話番号は書かない。番号はかからない形にする）
 * - 本番の案件：環境変数 COMPANY_NAME / COMPANY_TEL / COMPANY_FAX。未設定なら空欄にして手で書き込む（架空の会社名を本番の書類に出さない）
 */
export interface Company {
  readonly name: string;
  readonly tel: string;
  readonly fax: string;
}

export const DEMO_COMPANY: Company = { name: "架空葬祭株式会社（デモ）", tel: "000-000-0000（デモ）", fax: "000-000-0001（デモ）" };

export function company(mode: CaseMode, env: Readonly<Record<string, string | undefined>> = process.env): Company {
  if (mode === "demo") return DEMO_COMPANY;
  return { name: env.COMPANY_NAME?.trim() ?? "", tel: env.COMPANY_TEL?.trim() ?? "", fax: env.COMPANY_FAX?.trim() ?? "" };
}

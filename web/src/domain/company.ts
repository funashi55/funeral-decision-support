/**
 * 発注書・受注書に書く発注元の会社。本番では環境変数で自社の値に替える。
 * 既定はデモ用の架空の会社（実在の社名・電話番号は書かない。番号はかからない形にする）
 */
export interface Company {
  readonly name: string;
  readonly tel: string;
  readonly fax: string;
}

export function company(env: Readonly<Record<string, string | undefined>> = process.env): Company {
  return {
    name: env.COMPANY_NAME?.trim() || "架空葬祭株式会社（デモ）",
    tel: env.COMPANY_TEL?.trim() || "000-000-0000（デモ）",
    fax: env.COMPANY_FAX?.trim() || "000-000-0001（デモ）",
  };
}

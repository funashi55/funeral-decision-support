/** システムの画面どうしのリンク（クライアントの画面からも使うので、サーバー専用のものを読み込まない） */
const CASE_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** 戻り先の打合せ。URL から来るので、案件の ID の形のものだけを受け付ける */
export function meetingHref(caseId: string | undefined): string {
  return caseId && CASE_ID.test(caseId) ? `/staff/${caseId}` : "/staff";
}

export function roleplayHref(caseId: string | undefined): string {
  return caseId && CASE_ID.test(caseId)
    ? `/veteran?from=${caseId}`
    : "/veteran";
}


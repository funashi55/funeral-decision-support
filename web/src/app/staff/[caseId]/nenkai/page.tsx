import type { Metadata } from "next";
import { NenkaiSheet } from "../../../../components/paperwork/NenkaiSheet";
import s from "../../../../components/paperwork/sheet.module.css";
import { store } from "../../../../server/store";

export const metadata: Metadata = { title: "年回表｜sou-buddy", robots: { index: false, follow: false } };

export default async function NenkaiPage({ params }: PageProps<"/staff/[caseId]/nenkai">) {
  const { caseId } = await params;
  const state = await store.get(caseId);
  return (
    <main className={s.page} data-print-page>
      <NenkaiSheet familyName={state?.familyName ?? ""} initialDeathDate={state?.registration?.deceased.diedAt?.slice(0, 10)} deceasedName={state?.registration?.deceased.name} />
    </main>
  );
}

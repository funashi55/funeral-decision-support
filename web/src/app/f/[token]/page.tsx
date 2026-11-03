import type { Metadata } from "next";
import { FamilyWindow } from "../../../components/family/FamilyWindow";

export const metadata: Metadata = { title: "ご葬儀の打合せ｜ご家族の窓口", robots: { index: false, follow: false } };

export default async function FamilyPage({ params }: PageProps<"/f/[token]">) {
  const { token } = await params;
  return <FamilyWindow token={token} />;
}

import { StaffConsole } from "../../../components/staff/StaffConsole";

export default async function StaffPage({ params }: PageProps<"/staff/[caseId]">) {
  const { caseId } = await params;
  return <StaffConsole caseId={caseId} />;
}

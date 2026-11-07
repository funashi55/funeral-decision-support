import { redirect } from "next/navigation";

/** システムの入口は、施行一覧 */
export default function Home(): never {
  redirect("/staff");
}

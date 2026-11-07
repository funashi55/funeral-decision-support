import { redirect } from "next/navigation";

/** システムの入口は、ご家族の一覧 */
export default function Home(): never {
  redirect("/staff");
}

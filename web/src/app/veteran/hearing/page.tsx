import { redirect } from "next/navigation";

/** ロールプレイは /veteran に移した。前に送ったリンクのために転送だけ残す */
export default function HearingRedirect(): never {
  redirect("/veteran");
}

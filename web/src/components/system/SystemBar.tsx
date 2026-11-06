import Link from "next/link";
import s from "./system.module.css";

/** 担当者の画面と同じ暗い帯。システムの中の画面どうしを行き来する */
export type SystemSection = "meeting" | "roleplay";

const CASE_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** 戻り先の打合せ。URL から来るので、案件の ID の形のものだけを受け付ける */
export function meetingHref(caseId: string | undefined): string {
  return caseId && CASE_ID.test(caseId) ? `/staff/${caseId}` : "/";
}

export function roleplayHref(caseId: string | undefined): string {
  return caseId && CASE_ID.test(caseId) ? `/veteran?from=${caseId}` : "/veteran";
}

export function SystemBar({ current, caseId }: { readonly current: SystemSection; readonly caseId?: string }) {
  const items: readonly { readonly id: SystemSection; readonly label: string; readonly href: string }[] = [
    { id: "meeting", label: "打合せ", href: meetingHref(caseId) },
    { id: "roleplay", label: "ロールプレイ", href: roleplayHref(caseId) },
  ];
  return (
    <header className={s.bar}>
      <Link href="/" className={s.brand}>
        葬儀の打合せ支援
      </Link>
      <nav aria-label="システムの画面">
        <ul className={s.items}>
          {items.map((item) => (
            <li key={item.id}>
              <Link href={item.href} className={s.item} aria-current={item.id === current ? "page" : undefined}>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}

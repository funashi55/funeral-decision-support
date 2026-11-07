import Link from "next/link";
import { Suspense } from "react";
import { Account } from "./Account";
import { meetingHref, roleplayHref } from "./links";
import s from "./system.module.css";

/** 担当者の画面と同じ暗い帯。システムの中の画面どうしを行き来する */
export type SystemSection = "families" | "meeting" | "roleplay" | "demo";

export function SystemBar({
  current,
  caseId,
}: {
  readonly current: SystemSection;
  readonly caseId?: string;
}) {
  const items: readonly {
    readonly id: SystemSection;
    readonly label: string;
    readonly href: string;
  }[] = [
    { id: "families", label: "施行一覧", href: "/staff" },
    { id: "meeting", label: "打合せ", href: meetingHref(caseId) },
    { id: "roleplay", label: "ロールプレイ", href: roleplayHref(caseId) },
    // デモ（架空のご家族）は本番の一覧と分けて置く
    { id: "demo", label: "デモ", href: "/demo" },
  ];
  return (
    <>
      <header className={s.bar}>
        <Link href="/" className={s.brand}>
          sou-buddy
        </Link>
        <nav aria-label="システムの画面">
          <ul className={s.items}>
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className={s.item}
                  aria-current={item.id === current ? "page" : undefined}
                  data-guide={`nav-${item.id}`}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <Suspense fallback={null}>
          <Account />
        </Suspense>
      </header>
      <div className={s.spacer} aria-hidden="true" />
    </>
  );
}

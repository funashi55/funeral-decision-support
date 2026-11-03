import type { FamilyRequestView } from "../../engine/familyView";
import s from "./family.module.css";

const timeFormat = new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo" });

export function SentList({ requests }: { readonly requests: readonly FamilyRequestView[] }) {
  if (requests.length === 0) return null;
  return (
    <section className={s.section} aria-labelledby="sent-title">
      <div className={s.sectionHead}>
        <h2 id="sent-title">送ったもの</h2>
        <span className={s.count}>{requests.length} 件</span>
      </div>
      <ul className={s.sentList}>
        {[...requests].reverse().map((r) => (
          <li key={r.id} className={s.sentItem} data-testid={`sent-${r.id}`}>
            <span className={s.sentMeta}>
              {r.kind === "change" ? `変えたいこと${r.decisionLabel ? `：${r.decisionLabel}` : ""}` : "聞きたいこと"}
              <time dateTime={new Date(r.sentAt).toISOString()}>{timeFormat.format(r.sentAt)}</time>
            </span>
            <p>{r.text}</p>
            {r.status === "acknowledged" ? (
              <div className={s.reply}>
                <b>担当者が確認しました</b>
                {r.staffReply && <p>{r.staffReply}</p>}
              </div>
            ) : (
              <span className={s.pending}>担当者に届いています</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

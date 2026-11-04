"use client";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { getDecision } from "../../domain/decisions";
import type { CaseState, FamilyRequest } from "../../engine/case";
import s from "./staff.module.css";

interface FamilyInboxProps {
  readonly state: CaseState;
  readonly onClose: () => void;
  readonly onAcknowledge: (
    requestId: string,
    reply: string | null,
  ) => Promise<void>;
  /** リンクを止める、または新しいリンクを発行する（古いリンクは使えなくなる） */
  readonly onLink: (action: "revoke" | "reissue") => Promise<void>;
}

/** 共有リンクの宛先。スマホから開けるよう、LAN や公開先のアドレスを環境変数で指定できる */
function familyUrl(token: string): string {
  const origin =
    process.env.NEXT_PUBLIC_FAMILY_ORIGIN || window.location.origin;
  return `${origin.replace(/\/$/, "")}/f/${encodeURIComponent(token)}`;
}

const isLocalOnly = (url: string): boolean =>
  /\/\/(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url);

function RequestCard({
  request,
  onAcknowledge,
}: {
  readonly request: FamilyRequest;
  readonly onAcknowledge: FamilyInboxProps["onAcknowledge"];
}) {
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const label = request.decisionId
    ? getDecision(request.decisionId).label
    : null;
  return (
    <li
      className={`${s.req} ${request.status === "open" ? s.reqOpen : ""}`}
      data-testid={`request-${request.id}`}
    >
      <span className={s.reqKind}>
        {request.kind === "change"
          ? `変更の希望${label ? `：${label}` : ""}`
          : "質問"}
      </span>
      <p>{request.text}</p>
      {request.status === "acknowledged" ? (
        <p className={s.reqDone}>
          返事済み{request.staffReply ? `：${request.staffReply}` : ""}
        </p>
      ) : (
        <form
          className={s.reqForm}
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await onAcknowledge(request.id, reply);
            } finally {
              setBusy(false);
            }
          }}
        >
          <input
            value={reply}
            maxLength={300}
            onChange={(e) => setReply(e.target.value)}
            placeholder="ご家族への返事（空なら「確認しました」だけ）"
            aria-label="ご家族への返事"
          />
          <button
            type="submit"
            className={`${s.btn} ${s.btnPrimary}`}
            disabled={busy}
          >
            返事をする
          </button>
        </form>
      )}
      {request.kind === "change" && request.status === "open" && (
        <small className={s.reqHint}>
          決定はまだ変わっていません。ご家族と話して、決めることボードで確定し直してください。
        </small>
      )}
    </li>
  );
}

export function FamilyInbox({
  state,
  onClose,
  onAcknowledge,
  onLink,
}: FamilyInboxProps) {
  const [share, setShare] = useState<{
    readonly url: string;
    readonly qr: string | null;
  } | null>(null);
  useEffect(() => {
    const url = familyUrl(state.familyToken);
    QRCode.toDataURL(url, {
      margin: 1,
      width: 280,
      color: { dark: "#16140f", light: "#ffffff" },
    }).then(
      (qr) => setShare({ url, qr }),
      () => setShare({ url, qr: null }),
    );
  }, [state.familyToken]);
  const url = share?.url ?? "";
  const qr = share?.qr ?? null;

  return (
    <aside
      className={s.drawer}
      aria-labelledby="inbox-title"
      role="dialog"
      aria-modal="false"
    >
      <div className={s.drawerHead}>
        <h2 id="inbox-title">ご家族の窓口</h2>
        <button type="button" className={s.btn} onClick={onClose}>
          閉じる
        </button>
      </div>
      {state.familyLinkRevoked ? (
        <div className={s.share} style={{ gridTemplateColumns: "1fr" }}>
          <p>窓口のリンクは止めてあります。ご家族のスマホでは開けません。</p>
          <div className={s.shareActions}>
            <button
              type="button"
              className={`${s.btn} ${s.btnPrimary}`}
              onClick={() => void onLink("reissue")}
            >
              新しいリンクを発行する
            </button>
          </div>
        </div>
      ) : (
        <div className={s.share}>
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element -- その場で作る data URL なので画像最適化の対象外
            <img
              src={qr}
              width={140}
              height={140}
              alt="ご家族の窓口を開く QR コード"
            />
          ) : (
            <span className={s.qrPlaceholder} />
          )}
          <div>
            <p>
              ご家族のスマホで読み取ってもらいます。確定したことだけが表示され、AI
              の候補や会話は見えません。
            </p>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className={s.shareLink}
            >
              {url || "…"}
            </a>
            {isLocalOnly(url) && (
              <small className={s.reqHint}>
                このアドレスはこのパソコンでしか開けません。スマホで試すときは
                NEXT_PUBLIC_FAMILY_ORIGIN に LAN
                か公開先のアドレスを設定してください。
              </small>
            )}
            <div className={s.shareActions}>
              <button
                type="button"
                className={s.btn}
                onClick={() => void onLink("revoke")}
              >
                リンクを止める
              </button>
              <button
                type="button"
                className={s.btn}
                onClick={() => void onLink("reissue")}
              >
                新しいリンクに替える
              </button>
            </div>
          </div>
        </div>
      )}
      <h3 className={s.drawerSub}>届いた依頼</h3>
      {state.requests.length === 0 ? (
        <p className={s.empty}>まだ届いていません。</p>
      ) : (
        <ul className={s.reqList}>
          {[...state.requests].reverse().map((r) => (
            <RequestCard key={r.id} request={r} onAcknowledge={onAcknowledge} />
          ))}
        </ul>
      )}
    </aside>
  );
}

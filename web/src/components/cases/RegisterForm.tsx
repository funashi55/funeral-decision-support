"use client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { FUNERAL_STYLE_OPTIONS, MEMBERSHIP_OPTIONS, RESTING_OPTIONS, SEX_OPTIONS } from "../../engine/registration";
import s from "./cases.module.css";

interface Envelope {
  readonly success: boolean;
  readonly data?: { readonly caseId: string };
  readonly error?: string;
}

const value = (f: FormData, name: string): string => String(f.get(name) ?? "").trim();

/** 選択肢を丸いボタンで並べる（受付で、目で見て選べるように） */
function Choices({ name, options, initial }: { readonly name: string; readonly options: readonly string[]; readonly initial: string }) {
  return (
    <div className={s.choices}>
      {options.map((o) => (
        <label key={o} className={s.choice}>
          <input type="radio" name={name} value={o} defaultChecked={o === initial} />
          <span>{o}</span>
        </label>
      ))}
    </div>
  );
}

/**
 * 喪家の登録。受付（お迎えの連絡）で聞くことだけを入れ、登録したらそのまま打合せの画面へ進む。
 * わからないことは空のままでよい（打合せで決める）
 */
export function RegisterForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const age = value(f, "age");
    const body = {
      familyName: value(f, "familyName"),
      deceased: { name: value(f, "deceasedName"), age: age === "" ? undefined : age, sex: value(f, "sex") || undefined, diedAt: value(f, "diedAt"), diedPlace: value(f, "diedPlace") },
      chiefMourner: { name: value(f, "mournerName"), relation: value(f, "relation"), phone: value(f, "phone") },
      membership: value(f, "membership"),
      funeralStyle: value(f, "funeralStyle"),
      religion: value(f, "religion"),
      temple: value(f, "temple"),
      restingPlace: value(f, "restingPlace"),
      memo: value(f, "memo"),
    };
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/cases", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = (await res.json()) as Envelope;
      if (!json.success || !json.data) throw new Error(json.error ?? "登録できませんでした");
      router.push(`/staff/${json.data.caseId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "登録できませんでした");
      setBusy(false);
    }
  };

  return (
    <form className={s.form} onSubmit={(e) => void submit(e)} aria-label="喪家の登録">
      <section className={s.section}>
        <h2>
          ご家族<small>家名と喪主の続柄だけは必ず</small>
        </h2>
        <div className={s.grid}>
          <label className={s.field}>
            <span>
              家名<span className={s.req}>必須</span>
            </span>
            <input name="familyName" required maxLength={30} placeholder="例：佐藤" autoComplete="off" />
          </label>
          <label className={s.field}>
            <span>
              喪主の続柄<span className={s.req}>必須</span>
            </span>
            <input name="relation" required maxLength={20} placeholder="例：長男（故人から見て）" autoComplete="off" />
          </label>
          <label className={s.field}>
            喪主のお名前
            <input name="mournerName" maxLength={40} autoComplete="off" />
          </label>
          <label className={s.field}>
            喪主の電話番号
            <input name="phone" type="tel" maxLength={20} inputMode="tel" autoComplete="off" />
          </label>
        </div>
        <div>
          <p className={s.legend}>互助会の会員か</p>
          <Choices name="membership" options={MEMBERSHIP_OPTIONS} initial="わからない" />
          <p className={s.note}>見積もりの価格（会員価格・一般価格）がこれで決まります。わからなければ会員価格で仮に出します。</p>
        </div>
      </section>

      <section className={s.section}>
        <h2>
          故人<small>わかる範囲で</small>
        </h2>
        <div className={s.grid}>
          <label className={s.field}>
            お名前
            <input name="deceasedName" maxLength={40} autoComplete="off" />
          </label>
          <label className={s.field}>
            年齢
            <input name="age" type="number" min={0} max={120} inputMode="numeric" />
          </label>
          <label className={s.field}>
            亡くなった日時
            <input name="diedAt" type="datetime-local" />
          </label>
          <label className={s.field}>
            亡くなった場所
            <input name="diedPlace" maxLength={60} placeholder="例：病院・ご自宅・施設" autoComplete="off" />
          </label>
        </div>
        <div>
          <p className={s.legend}>性別</p>
          <Choices name="sex" options={SEX_OPTIONS} initial="" />
        </div>
      </section>

      <section className={s.section}>
        <h2>
          受付で伺ったこと<small>未定のままで大丈夫です</small>
        </h2>
        <div>
          <p className={s.legend}>ご安置の場所</p>
          <Choices name="restingPlace" options={RESTING_OPTIONS} initial="未定" />
        </div>
        <div>
          <p className={s.legend}>葬儀の形のご希望</p>
          <Choices name="funeralStyle" options={FUNERAL_STYLE_OPTIONS} initial="未定" />
        </div>
        <div className={s.grid}>
          <label className={s.field}>
            宗派
            <input name="religion" maxLength={30} placeholder="例：浄土真宗" autoComplete="off" />
          </label>
          <label className={s.field}>
            菩提寺
            <input name="temple" maxLength={60} placeholder="例：市外のお寺（お付き合いあり）" autoComplete="off" />
          </label>
        </div>
        <label className={s.field}>
          受付のメモ
          <textarea name="memo" rows={3} maxLength={400} placeholder="お迎えのときの様子、気をつけることなど" />
        </label>
      </section>

      {error && (
        <p className={s.error} role="alert">
          {error}
        </p>
      )}
      <div className={s.actions}>
        <span className={s.note}>登録すると、このご家族の打合せの画面が開きます。</span>
        <button type="submit" className={s.primary} disabled={busy}>
          {busy ? "登録しています…" : "登録して打合せを始める"}
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </form>
  );
}

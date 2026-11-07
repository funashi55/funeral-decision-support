"use client";
import { AMOUNTS, AMOUNT_LABEL, BRAND, TONES, TONE_LABEL, growth, type Amount, type BuddyProfile, type Tone } from "../../domain/buddy";
import { getGriefPrinciple } from "../../domain/griefCare";
import c from "./console.module.css";
import b from "./buddy.module.css";

interface BuddyViewProps {
  readonly profile: BuddyProfile | null;
  readonly onSettings: (s: { tone?: Tone; amount?: Amount }) => void;
  readonly onRemovePhrase: (principleId: string, text: string) => void;
}

/** バディ：この担当者に合わせた出し方と、使いながら残した自分の言い方 */
export function BuddyView({ profile, onSettings, onRemovePhrase }: BuddyViewProps) {
  if (!profile) return <p className={c.quiet}>読み込んでいます…</p>;
  const g = growth(profile);
  const phrases = Object.entries(profile.phrases);
  return (
    <div className={b.wrap} data-testid="buddy">
      <header className={b.head}>
        <p className={b.brand}>{BRAND.display}</p>
        <h1 className={b.name}>
          {profile.staffName}さんのバディ
        </h1>
        <dl className={b.growth} aria-label="育ち具合">
          <div>
            <dt>伝えた</dt>
            <dd>{g.told}</dd>
          </div>
          <div>
            <dt>使わなかった</dt>
            <dd>{g.unused}</dd>
          </div>
          <div>
            <dt>自分の言い方</dt>
            <dd>{g.phrases}</dd>
          </div>
        </dl>
      </header>

      <section className={b.section} aria-labelledby="buddy-tone">
        <h2 id="buddy-tone" className={b.title}>
          言葉の調子
        </h2>
        <div className={b.segment} role="radiogroup" aria-labelledby="buddy-tone">
          {TONES.map((t) => (
            <button key={t} type="button" role="radio" aria-checked={profile.tone === t} className={b.option} onClick={() => onSettings({ tone: t })}>
              {TONE_LABEL[t]}
            </button>
          ))}
        </div>
      </section>

      <section className={b.section} aria-labelledby="buddy-amount">
        <h2 id="buddy-amount" className={b.title}>
          支援の量
        </h2>
        <div className={b.segment} role="radiogroup" aria-labelledby="buddy-amount">
          {AMOUNTS.map((a) => (
            <button key={a} type="button" role="radio" aria-checked={profile.amount === a} className={b.option} onClick={() => onSettings({ amount: a })}>
              {AMOUNT_LABEL[a]}
            </button>
          ))}
        </div>
      </section>

      <section className={b.section} aria-labelledby="buddy-phrases">
        <h2 id="buddy-phrases" className={b.title}>
          自分の言い方
        </h2>
        {phrases.length === 0 ? (
          <p className={b.empty}>寄り添いの言葉の「自分の言い方を残す」から増えていきます。</p>
        ) : (
          <ul className={b.phraseGroups}>
            {phrases.map(([id, list]) => (
              <li key={id}>
                <b>{getGriefPrinciple(id).name}</b>
                <ul className={b.phrases}>
                  {list.map((t) => (
                    <li key={t}>
                      <span>「{t}」</span>
                      <button type="button" className={b.remove} onClick={() => onRemovePhrase(id, t)} aria-label={`「${t}」を消す`}>
                        消す
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

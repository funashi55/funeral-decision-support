"use client";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { api } from "../../client/api";
import { factValue } from "../../engine/facts";
import { PLACE_KIND_LABEL, mapEmbedUrl, placesMentioned, routeEmbedUrl, routeLinkUrl, telHref, type Place } from "../../domain/directory";
import type { CaseState } from "../../engine/case";
import c from "./console.module.css";
import { HallMap } from "./HallMap";
import p from "./places.module.css";

/** Maps Embed API の鍵（なければ鍵の要らない埋め込みを使う） */
const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY || undefined;

/** 名前が出ているかを見る文章：会話と、決めたこと・候補（お寺・日程と会場・安置先・埋骨の場所） */
const PLACE_DECISIONS = ["temple", "cremation_date", "wake_date", "funeral_date", "resting_place", "burial_place"] as const;
function textsOf(state: CaseState): string[] {
  return [...state.utterances.map((u) => u.text), ...PLACE_DECISIONS.map((id) => state.decisions[id]?.value ?? "")];
}

/** 名簿の名前なら住所に、そうでなければ入れた住所のまま */
const resolve = (directory: readonly Place[], value: string): string => directory.find((x) => x.name === value.trim())?.address ?? value.trim();

type MapView = { readonly kind: "place"; readonly address: string } | { readonly kind: "route"; readonly from: string; readonly to: string };

/**
 * 関係先と地図。会話や決めたことにお寺・火葬場・墓地・会館の名前が出たら、電話番号と住所を出す。
 * 住所を入れると地図が出て、名簿の火葬場・会館などからの経路を引ける
 */
export function PlacesPanel({ state }: { readonly state: CaseState }) {
  const [directory, setDirectory] = useState<readonly Place[]>([]);
  const [view, setView] = useState<MapView | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    api
      .directory(state.caseId)
      .then((d) => alive && setDirectory(d))
      .catch(() => alive && setError("関係先の名簿を読めませんでした"));
    return () => {
      alive = false;
    };
  }, [state.caseId]);

  const mentioned = useMemo(() => placesMentioned(directory, textsOf(state)), [directory, state]);
  const presets = directory.filter((x) => x.address && (x.kind === "crematorium" || x.kind === "hall"));
  const others = directory.filter((x) => x.address && !presets.includes(x));
  const firstAddress = mentioned.find((x) => x.address)?.address ?? "";
  const home = factValue(state.registration, "homeAddress");

  const submit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const from = resolve(directory, String(f.get("from") ?? ""));
    const to = resolve(directory, String(f.get("to") ?? ""));
    if (from && to) setView({ kind: "route", from, to });
    else if (to || from) setView({ kind: "place", address: to || from });
  };

  return (
    <section aria-labelledby="places-title" className={c.block} data-testid="places">
      <h2 id="places-title" className={c.blockTitle}>
        関係先と地図{mentioned.length > 0 && <span className={c.factsCount}>{mentioned.length}</span>}
      </h2>
      {error && <p className={c.quiet}>{error}</p>}
      {mentioned.length === 0 ? (
        <p className={p.hint}>会話にお寺・火葬場・墓地・会館の名前が出ると、ここに電話番号と住所が出ます。</p>
      ) : (
        <ul className={p.list}>
          {mentioned.map((x) => (
            <li key={x.id} className={p.place} data-testid={`place-${x.id}`}>
              <span className={p.kind}>{PLACE_KIND_LABEL[x.kind]}</span>
              <div className={p.body}>
                <b>{x.name}</b>
                {x.sect && <span className={p.meta}>{x.sect}</span>}
                {x.address && <span className={p.meta}>{x.address}</span>}
              </div>
              <div className={p.actions}>
                {x.phone && (
                  <a className={p.tel} href={telHref(x.phone)} aria-label={`${x.name}に電話する（${x.phone}）`}>
                    {x.phone}
                  </a>
                )}
                {x.address && (
                  <button type="button" className={p.ghost} onClick={() => setView({ kind: "place", address: x.address ?? "" })}>
                    地図
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <form className={p.route} onSubmit={submit} aria-label="地図と経路">
        <label>
          出発
          <input name="from" list="places-presets" defaultValue={home ?? ""} key={home ?? "no-home"} placeholder="例：会館・火葬場・ご自宅の住所" autoComplete="off" />
        </label>
        <label>
          行き先
          <input name="to" list="places-presets" defaultValue={mentioned.find((x) => x.address)?.name ?? ""} key={firstAddress} placeholder="住所か、名簿の名前" autoComplete="off" />
        </label>
        <datalist id="places-presets">
          {[...presets, ...others].map((x) => (
            <option key={x.id} value={x.name}>
              {PLACE_KIND_LABEL[x.kind]}
            </option>
          ))}
        </datalist>
        <button type="submit" className={p.primary}>
          地図・経路を出す
        </button>
      </form>

      {view && (
        <figure className={p.map}>
          <iframe
            title={view.kind === "route" ? "経路の地図" : "地図"}
            src={view.kind === "route" ? routeEmbedUrl(view.from, view.to, MAPS_KEY) : mapEmbedUrl(view.address, MAPS_KEY)}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            width={720}
            height={360}
          />
          <figcaption>
            {view.kind === "route" ? (
              <a href={routeLinkUrl(view.from, view.to)} target="_blank" rel="noopener noreferrer">
                地図アプリで経路を開く
              </a>
            ) : (
              <span>{view.address}</span>
            )}
            <small>住所は Google マップに送られます。</small>
          </figcaption>
        </figure>
      )}

      <HallMap caseId={state.caseId} homeAddress={home} />
    </section>
  );
}

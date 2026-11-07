"use client";
import "leaflet/dist/leaflet.css";
import type { LayerGroup, Map as LeafletMap } from "leaflet";
import { useEffect, useRef, useState } from "react";
import { api } from "../../client/api";
import { routeLinkUrl, telHref } from "../../domain/directory";
import type { HallPin, TravelView } from "../../domain/travel";
import p from "./places.module.css";

/** 国土地理院の淡色地図（鍵が要らず、日本語の地名が読みやすい） */
const TILE_URL = "https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png";
const ATTRIBUTION = '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">国土地理院</a>';
/** 住所が決まったとき、地図に入れる近い会館の数 */
const NEAREST_IN_VIEW = 3;
const FOCUS_ZOOM = 16;

const esc = (s: string): string => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
const shortName = (name: string): string => name.replace(/（.*?）|\(.*?\)/g, "");

interface HallMapProps {
  readonly caseId: string;
  /** 確定したご自宅の住所（変わったら時間を計り直す） */
  readonly homeAddress?: string;
}

/**
 * 自社の会館にあらかじめピンを立てた地図。ご自宅の住所が確定すると、各会館までの車の時間を近い順に出す。
 * 地図は入っているピンに合わせて自動で寄り、一覧の会館を押すとそこへ寄る
 */
export function HallMap({ caseId, homeAddress }: HallMapProps) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const layer = useRef<LayerGroup | null>(null);
  const [view, setView] = useState<TravelView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .travel(caseId)
      .then((v) => {
        if (!alive) return;
        setView(v);
        setError(null);
      })
      .catch(() => alive && setError("会館の地図を読めませんでした"));
    return () => {
      alive = false;
    };
  }, [caseId, homeAddress]);

  // 地図を作る（一度だけ）
  useEffect(() => {
    let alive = true;
    void import("leaflet").then((L) => {
      if (!alive || !box.current || map.current) return;
      const m = L.map(box.current, { zoomControl: true, scrollWheelZoom: false }).setView([36.5, 139.5], 5);
      L.tileLayer(TILE_URL, { attribution: ATTRIBUTION, maxZoom: 18 }).addTo(m);
      map.current = m;
      layer.current = L.layerGroup().addTo(m);
      setView((v) => (v ? { ...v } : v));
    });
    return () => {
      alive = false;
      map.current?.remove();
      map.current = null;
      layer.current = null;
    };
  }, []);

  // ピンを立て、入っているピンに合わせて自動で寄る
  useEffect(() => {
    if (!view) return;
    void import("leaflet").then((L) => {
      const m = map.current;
      const g = layer.current;
      if (!m || !g) return;
      g.clearLayers();
      for (const h of view.halls) {
        const label = `${esc(shortName(h.name))}${h.minutes !== undefined ? `<em>${h.minutes}分</em>` : ""}`;
        L.marker([h.lat, h.lng], { icon: L.divIcon({ className: p.pin, html: `<span>${label}</span>`, iconSize: undefined }), title: h.name }).addTo(g);
      }
      if (view.home) {
        L.marker([view.home.lat, view.home.lng], { icon: L.divIcon({ className: p.homePin, html: "<span>ご自宅</span>", iconSize: undefined }), title: "ご自宅", zIndexOffset: 1000 }).addTo(g);
      }
      const inView = view.home ? [view.home, ...view.halls.slice(0, NEAREST_IN_VIEW)] : view.halls;
      if (inView.length === 1 && inView[0]) m.setView([inView[0].lat, inView[0].lng], 15);
      else if (inView.length > 1) m.fitBounds(L.latLngBounds(inView.map((x) => [x.lat, x.lng])), { padding: [36, 36], maxZoom: 15 });
    });
  }, [view]);

  const focus = (h: HallPin): void => {
    map.current?.flyTo([h.lat, h.lng], FOCUS_ZOOM, { duration: 0.6 });
  };

  return (
    <div className={p.hallMap} data-testid="hall-map">
      <h3 className={p.subTitle}>会館までの時間</h3>
      {error && <p className={p.hint}>{error}</p>}
      <div ref={box} className={p.leaflet} role="region" aria-label="会館とご自宅の地図" />
      {view?.note && <p className={p.hint}>{view.note}</p>}
      {view && !view.home && !view.note && <p className={p.hint}>喪家の住所が入ると、各会館までの時間が出ます。</p>}
      {view && view.halls.length > 0 && (
        <ol className={p.hallList}>
          {view.halls.map((h) => (
            <li key={h.id} data-testid={`hall-${h.id}`}>
              <button type="button" className={p.hallName} onClick={() => focus(h)} aria-label={`${h.name}を地図で寄せて見る`}>
                <b>{h.name}</b>
                <span className={p.meta}>{h.address}</span>
              </button>
              {h.minutes !== undefined && (
                <span className={p.time}>
                  車で約<b>{h.minutes}</b>分{h.km !== undefined && <small>{h.km}km</small>}
                </span>
              )}
              <span className={p.actions}>
                {h.phone && (
                  <a className={p.tel} href={telHref(h.phone)} aria-label={`${h.name}に電話する（${h.phone}）`}>
                    {h.phone}
                  </a>
                )}
                {view.home && (
                  <a className={p.ghost} href={routeLinkUrl(view.home.address, h.address)} target="_blank" rel="noopener noreferrer">
                    経路
                  </a>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

"use client";
import { useState } from "react";
import { HEARING_SCENES } from "../../../data/hearingScenes";
import { SceneFlow } from "./SceneFlow";
import { EMPTY_SCENE, useHearingDraft, type Experience, type InputMode, type Stage } from "./hearingDraft";
import s from "../trial.module.css";
import h from "./hearing.module.css";

const STAGE_LABEL: Record<Stage, string> = {
  card: "まだ",
  roleplay: "打合せの途中",
  fits: "見立ての途中",
  confirm: "確認の途中",
  sent: "✓ 送りました",
};

const EXPERIENCES: readonly { readonly value: Experience; readonly label: string }[] = [
  { value: "under1", label: "1年未満" },
  { value: "1to3", label: "1〜3年" },
  { value: "3to10", label: "3〜10年" },
  { value: "over10", label: "10年以上" },
];

const MODES: readonly { readonly value: InputMode; readonly label: string }[] = [
  { value: "chat", label: "チャット" },
  { value: "voice", label: "声" },
];

export function HearingApp() {
  const { draft, update, updateScene } = useHearingDraft();
  const [openId, setOpenId] = useState<string | null>(null);
  const open = HEARING_SCENES.find((x) => x.id === openId);
  const ready = draft.respondent.trim() !== "" && draft.experience !== "";
  const sent = HEARING_SCENES.filter((x) => draft.scenes[x.id]?.stage === "sent").length;

  return (
    <>
      <div className={h.top}>
        <div className={h.mode} role="group" aria-label="答え方">
          {MODES.map((m) => (
            <button key={m.value} type="button" aria-pressed={draft.mode === m.value} onClick={() => update((d) => ({ ...d, mode: m.value }))}>
              {m.label}
            </button>
          ))}
        </div>
        <span className={`${h.topNote} ${h.topExplain}`}>途中で切り替えられます。声のときは、ご家族の言葉も読み上げます</span>
        <span className={h.topNote} style={{ marginLeft: "auto" }}>
          送ったご家族 <b>{sent}</b> / {HEARING_SCENES.length}
        </span>
      </div>

      {!open && (
        <>
          <label className={`${s.field} ${s.card}`}>
            お名前（「ベテランA」のような仮の名前で構いません）
            <input className={s.input} value={draft.respondent} maxLength={40} onChange={(e) => update((d) => ({ ...d, respondent: e.target.value }))} />
          </label>
          <div className={`${s.field} ${s.card}`} role="radiogroup" aria-labelledby="experience-label">
            <span id="experience-label">葬儀の仕事の経験（経験の違う方どうしの打合せを比べるために伺います）</span>
            <div className={`${s.choices} ${h.four}`}>
              {EXPERIENCES.map((x) => (
                <label key={x.value} className={s.choice}>
                  <input type="radio" name="experience" checked={draft.experience === x.value} onChange={() => update((d) => ({ ...d, experience: x.value }))} />
                  <span>{x.label}</span>
                </label>
              ))}
            </div>
          </div>
          <ul className={h.sceneList}>
            {HEARING_SCENES.map((scene) => {
              const stage = draft.scenes[scene.id]?.stage ?? "card";
              return (
                <li key={scene.id}>
                  <button type="button" className={h.sceneItem} onClick={() => setOpenId(scene.id)} disabled={!ready}>
                    <b>{scene.title}</b>
                    <span>{scene.card[0]}</span>
                    <span className={`${h.sceneState} ${stage === "sent" ? h.sceneStateDone : ""}`}>{STAGE_LABEL[stage]}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {!ready && <p className={h.topNote}>お名前と経験を入れると、ご家族を選べます。</p>}
        </>
      )}

      {open && (
        <SceneFlow
          scene={open}
          progress={draft.scenes[open.id] ?? EMPTY_SCENE}
          mode={draft.mode}
          respondent={draft.respondent.trim()}
          experience={draft.experience}
          onChange={(fn) => updateScene(open.id, fn)}
          onBack={() => setOpenId(null)}
        />
      )}
    </>
  );
}

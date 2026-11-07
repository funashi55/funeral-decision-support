import { describe, expect, it } from "vitest";
import type { Utterance } from "../engine/case";
import { OPENING_STEPS, openingCovered, stillOpening } from "./opening";

const say = (text: string, i = 1): Utterance => ({ id: `U${i}`, speaker: "family", speakerLabel: "ご遺族", text, at: i });

describe("打合せの入り方", () => {
  it("決めることより先に、お悔やみ・亡くなるまで・最期・故人のことを伺う順に並ぶ", () => {
    expect(OPENING_STEPS.map((s) => s.id)).toEqual(["condolence", "how_it_happened", "last_moments", "who_they_were"]);
  });

  it("声かけの例は、葬儀の形や費用を尋ねない", () => {
    for (const s of OPENING_STEPS) expect(s.say).not.toMatch(/家族葬|一般葬|費用|プラン|お別れの仕方/);
  });

  it("会話で触れたものに ✓ が付き、3つ触れると入り方は済む", () => {
    const talk = [say("心よりお悔やみ申し上げます", 1), say("母は半年ほど入院していて", 2)];
    expect([...openingCovered(talk)]).toEqual(["condolence", "how_it_happened"]);
    expect(stillOpening(talk)).toBe(true);
    expect(stillOpening([...talk, say("最期は手を握って見送れました", 3)])).toBe(false);
  });
});

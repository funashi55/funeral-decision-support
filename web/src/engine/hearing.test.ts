import { describe, expect, it } from "vitest";
import { HEARING_SCENES, getHearingScene } from "../data/hearingScenes";
import {
  HearingInputError,
  extractJudgments,
  familyMessages,
  familySystem,
  keepGrounded,
  nextFamilyLines,
  quoteFromVeteran,
  sanitizeFamilyReply,
  type HearingTurn,
} from "./hearing";

const scene = getHearingScene("P1");
const vet = (text: string): HearingTurn => ({ role: "veteran", speaker: "担当者", text });
const fam = (speaker: string, text: string): HearingTurn => ({ role: "family", speaker, text });

describe("ペルソナ", () => {
  it("隠れた事情と始まりの様子は、同席している家族のもの", () => {
    for (const s of HEARING_SCENES) {
      const labels = s.family.map((m) => m.label);
      for (const h of s.hidden) expect(labels).toContain(h.heldBy);
      for (const o of s.opening) expect(labels).toContain(o.speaker);
    }
  });

  it("ご遺族役の指示に、隠れた事情・始まりの様子・作らない約束が入る", () => {
    const system = familySystem(scene);
    expect(system).toContain("P1-person");
    expect(system).toContain(scene.opening[0]?.text ?? "");
    expect(system).toContain("作らない");
  });
});

describe("ご遺族役", () => {
  it("知らない呼び名のせりふと、存在しない事情の ID を落とす", () => {
    const clean = sanitizeFamilyReply(scene, {
      lines: [
        { speaker: "長女", text: "母は花が好きでした" },
        { speaker: "隣の人", text: "作られた人物" },
      ],
      revealed: ["P1-person", "P9-unknown"],
    });
    expect(clean.lines.map((l) => l.speaker)).toEqual(["長女"]);
    expect(clean.revealed).toEqual(["P1-person"]);
  });

  it("担当者の発言のあとでなければ答えない", async () => {
    await expect(nextFamilyLines(scene, [fam("長男", "はい")], async () => ({ lines: [], revealed: [] }))).rejects.toBeInstanceOf(HearingInputError);
  });

  it("打合せは担当者の言葉から始まり、担当者と家族が交互になる", () => {
    const messages = familyMessages([vet("このたびは"), fam("長女", "明るい人でした"), fam("長男", "頑固でもあった"), vet("そうでしたか")]);
    expect(messages.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(messages[0]?.content).toBe("このたびは");
    expect(messages[1]?.content).toContain("長女：明るい人でした");
    expect(messages[1]?.content).toContain("長男：頑固でもあった");
  });

  it("せりふが空なら、黙っている返事にする", async () => {
    const reply = await nextFamilyLines(scene, [vet("いかがでしょう")], async () => ({ lines: [{ speaker: "知らない人", text: "x" }], revealed: [] }));
    expect(reply.lines).toHaveLength(1);
    expect(reply.revealed).toEqual([]);
  });
});

describe("取り出し", () => {
  const turns: HearingTurn[] = [
    vet("まず、お母さまがどんな方だったか、聞かせていただけますか。"),
    fam("長女", "花が好きな人でした"),
    vet("待つかどうかは、お気持ちを伺ってから一緒に決めましょう。"),
  ];

  it("引用は担当者の発言にあるときだけ根拠になる（句読点の違いは許す）", () => {
    expect(quoteFromVeteran("お母さまがどんな方だったか聞かせていただけますか", turns)).toBe(true);
    expect(quoteFromVeteran("花が好きな人でした", turns)).toBe(false);
    expect(quoteFromVeteran("日程を先に決めましょう", turns)).toBe(false);
  });

  it("元の発言に戻れない判断は捨て、件数を返す", () => {
    const { extraction, dropped } = keepGrounded(
      {
        judgments: [
          { when: "日程を決める前", do: "気持ちを聞いてから一緒に決める", why: "", quote: "お気持ちを伺ってから一緒に決めましょう" },
          { when: "費用", do: "安いプランを勧める", why: "", quote: "安いプランがおすすめです" },
        ],
        firstWords: "まず、お母さまがどんな方だったか",
      },
      turns,
    );
    expect(extraction.judgments).toHaveLength(1);
    expect(dropped).toBe(1);
    expect(extraction.firstWords).not.toBe("");
  });

  it("担当者の発言がなければ取り出さない", async () => {
    await expect(extractJudgments(scene, [fam("長男", "はい")], async () => ({ judgments: [], firstWords: "" }))).rejects.toBeInstanceOf(HearingInputError);
  });
});

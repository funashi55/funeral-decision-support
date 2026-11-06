import { describe, expect, it } from "vitest";
import { HEARING_SCENES, getHearingScene } from "../data/hearingScenes";
import {
  DEBRIEF_QUESTIONS,
  HearingInputError,
  extractJudgments,
  familyMessages,
  familySystem,
  keepGrounded,
  nextFamilyLines,
  nextInterviewerQuestion,
  quoteFromVeteran,
  sanitizeFamilyReply,
  type HearingTurn,
} from "./hearing";

const scene = getHearingScene("P1");
const vet = (text: string): HearingTurn => ({ role: "veteran", speaker: "担当者", text });
const fam = (speaker: string, text: string): HearingTurn => ({ role: "family", speaker, text });
const ask = (text: string): HearingTurn => ({ role: "interviewer", speaker: "聞き手", text });

describe("場面の台本", () => {
  it("隠れた事情は、家族の誰かが知っている", () => {
    for (const s of HEARING_SCENES) {
      const labels = s.family.map((m) => m.label);
      for (const h of s.hidden) expect(labels).toContain(h.heldBy);
      for (const o of s.opening) expect(labels).toContain(o.speaker);
    }
  });

  it("家族役の指示に、隠れた事情と作らない約束が入る", () => {
    const system = familySystem(scene);
    expect(system).toContain("P1-person");
    expect(system).toContain("作らない");
  });
});

describe("家族役", () => {
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

  it("家族役に渡す会話は、担当者と家族が交互になる", () => {
    const messages = familyMessages(scene, [vet("お母さまはどんな方でしたか"), fam("長女", "明るい人でした"), fam("長男", "頑固でもあった"), vet("そうでしたか")]);
    const roles = messages.map((m) => m.role);
    expect(roles).toEqual(["user", "assistant", "user", "assistant", "user"]);
    expect(messages[3]?.content).toContain("長女：明るい人でした");
    expect(messages[3]?.content).toContain("長男：頑固でもあった");
  });

  it("せりふが空なら、黙っている返事にする", async () => {
    const reply = await nextFamilyLines(scene, [vet("いかがでしょう")], async () => ({ lines: [{ speaker: "知らない人", text: "x" }], revealed: [] }));
    expect(reply.lines).toHaveLength(1);
    expect(reply.revealed).toEqual([]);
  });
});

describe("ふりかえりの聞き手", () => {
  it("決めた数を尋ねたら終える", async () => {
    const turns: HearingTurn[] = [vet("先にお孫さんのことを伺えますか")];
    for (let i = 0; i < DEBRIEF_QUESTIONS; i++) turns.push(ask(`問${i}`), vet(`答え${i}`));
    const reply = await nextInterviewerQuestion(scene, turns, async () => ({ question: "もう一問", done: false }));
    expect(reply.done).toBe(true);
  });
});

describe("取り出し", () => {
  const turns: HearingTurn[] = [
    vet("まず、お孫さんとお母さまのご関係を聞かせていただけますか。"),
    fam("長女", "おばあちゃん子でした"),
    ask("なぜ日程より先にお孫さんのことを？"),
    vet("待つかどうかは、気持ちを聞いてからでないと決められないので"),
  ];

  it("引用はベテランの発言にあるときだけ根拠になる（句読点の違いは許す）", () => {
    expect(quoteFromVeteran("お孫さんとお母さまのご関係を聞かせていただけますか", turns)).toBe(true);
    expect(quoteFromVeteran("おばあちゃん子でした", turns)).toBe(false);
    expect(quoteFromVeteran("日程を先に決めましょう", turns)).toBe(false);
  });

  it("元の発言に戻れない判断は捨て、件数を返す", () => {
    const { extraction, dropped } = keepGrounded(
      {
        judgments: [
          { when: "孫が遠方", do: "日程より先に孫との関係を聞く", why: "", quote: "待つかどうかは、気持ちを聞いてからでないと決められない" },
          { when: "費用", do: "安いプランを勧める", why: "", quote: "安いプランがおすすめです" },
        ],
        firstWords: "まず、お孫さんとお母さまのご関係を",
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

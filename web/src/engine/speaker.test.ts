import { describe, expect, it, vi } from "vitest";
import type { Utterance } from "./case";
import { DEMO_SCRIPT } from "./fixtures/demoScript";
import { detectSpeaker, guessByRules, guessByTurn } from "./speaker";

const u = (speaker: Utterance["speaker"], text: string): Utterance => ({ id: "U", speaker, speakerLabel: "", text, at: 0 });

describe("話した人の聞き分け", () => {
  it("接客の敬語は担当者、身内の呼び方や願いはご遺族と決まりごとで見分ける", () => {
    expect(guessByRules("このたびは、心よりお悔やみ申し上げます。精一杯させていただきます。")?.speaker).toBe("staff");
    expect(guessByRules("ご葬儀には、どなたに来ていただきたいとお考えですか。ご親戚はどちらにいらっしゃいますか。")?.speaker).toBe("staff");
    expect(guessByRules("母はお風呂が好きだったんです。最後に入れてあげたいです。")?.speaker).toBe("family");
  });

  it("デモの台本の大半は、決まりごとだけで正しく見分けられ、誤りはない", () => {
    const guesses = DEMO_SCRIPT.map((l) => ({ want: l.speaker === "staff" ? "staff" : "family", got: guessByRules(l.text)?.speaker }));
    const decided = guesses.filter((g) => g.got);
    expect(decided.every((g) => g.got === g.want)).toBe(true);
    expect(decided.length / guesses.length).toBeGreaterThanOrEqual(0.5);
  });

  it("はっきりしないときだけ Claude に尋ねる", async () => {
    const classify = vi.fn().mockResolvedValue({ speaker: "family" });
    expect(await detectSpeaker("ここは丁寧にお願いします", [u("staff", "どのようにしますか")], classify)).toEqual({ speaker: "family", by: "model" });
    expect(classify).toHaveBeenCalledOnce();
    const clear = vi.fn();
    await detectSpeaker("ご希望をお聞かせいただけますでしょうか、よろしいでしょうか", [], clear);
    expect(clear).not.toHaveBeenCalled();
  });

  it("Claude が使えない・失敗したときは、直前と違う人にする", async () => {
    expect(await detectSpeaker("はい", [u("staff", "よろしいですか")], null)).toEqual({ speaker: "family", by: "turn" });
    expect(await detectSpeaker("はい", [u("family", "そうですね")], vi.fn().mockRejectedValue(new Error("x")))).toEqual({ speaker: "staff", by: "turn" });
    expect(guessByTurn([])).toEqual({ speaker: "family", by: "turn" });
  });
});

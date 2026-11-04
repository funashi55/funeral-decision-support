import { describe, expect, test } from "vitest";
import { checkText } from "../guard";
import { WORDING_CASES } from "./wording";

describe("守る線：意地悪な言い回し", () => {
  test.each(WORDING_CASES.filter((c) => c.expect.length > 0).map((c) => [c.note, c] as const))("止める：%s", (_note, c) => {
    const rules = checkText(c.text).map((v) => v.rule);
    for (const r of c.expect) expect(rules, c.text).toContain(r);
  });

  test.each(WORDING_CASES.filter((c) => c.expect.length === 0).map((c) => [c.note, c] as const))("止めない：%s", (_note, c) => {
    expect(checkText(c.text), c.text).toEqual([]);
  });
});

import { describe, expect, test } from "vitest";
import { DECISIONS } from "../domain/decisions";
import type { CaseState, DecisionState } from "./case";
import { DEMO_CASE } from "./fixtures/demoCase";
import { ORDERS, buildChecklist, buildOrders, csvCell, toCoreCsv } from "./orders";

const withDecisions = (d: Record<string, [string, DecisionState["status"]]>): CaseState => ({
  ...DEMO_CASE,
  decisions: Object.fromEntries(Object.entries(d).map(([k, [value, status]]) => [k, { value, status, utteranceIds: [] }])),
});

describe("確認表", () => {
  test("決定項目すべてを、確定・候補・未定に分けて返す", () => {
    const rows = buildChecklist(withDecisions({ religion: ["浄土真宗", "confirmed"], funeral_style: ["家族葬", "candidate"] }));
    expect(rows).toHaveLength(DECISIONS.length);
    expect(rows.find((r) => r.decisionId === "religion")?.status).toBe("confirmed");
    expect(rows.find((r) => r.decisionId === "funeral_style")).toMatchObject({ status: "candidate", dueToday: true });
    expect(rows.find((r) => r.decisionId === "photo")).toMatchObject({ status: "open", dueToday: false });
  });
});

describe("発注リスト", () => {
  test("項目の id は重ならず、前提の決定はすべて決めることボードにある", () => {
    expect(new Set(ORDERS.map((o) => o.id)).size).toBe(ORDERS.length);
    const ids = new Set(DECISIONS.map((d) => d.id));
    for (const o of ORDERS) for (const n of o.needs) expect(ids.has(n), `${o.id}:${n}`).toBe(true);
  });

  test("打合せ前の枕飾りは、何も決まっていなくても手配できる", () => {
    expect(buildOrders(withDecisions({})).find((o) => o.id === "pillow_set")?.status).toBe("ready");
  });

  test("会葬礼状にラストレターを含めたときだけ、ラストレターを発注する", () => {
    const plain = buildOrders(withDecisions({ thank_you_card: ["定型の礼状", "confirmed"] }));
    expect(plain.find((o) => o.id === "last_letter")?.status).toBe("not_needed");
    const letter = buildOrders(withDecisions({ thank_you_card: ["オリジナル（ラストレターあり）", "confirmed"] }));
    expect(letter.find((o) => o.id === "last_letter")?.status).toBe("ready");
  });

  test("候補のままでは手配できる状態にしない。確定すると手配できる", () => {
    const candidate = buildOrders(withDecisions({ cremation_date: ["11月10日 10時 中央斎場", "candidate"] }));
    expect(candidate.find((o) => o.id === "crematorium")?.status).toBe("waiting");
    const confirmed = buildOrders(withDecisions({ cremation_date: ["11月10日 10時 中央斎場", "confirmed"] }));
    expect(confirmed.find((o) => o.id === "crematorium")).toMatchObject({ status: "ready", details: [{ value: "11月10日 10時 中央斎場" }] });
  });

  test("湯灌を選ばなければ、湯灌の手配は不要になる", () => {
    const rows = buildOrders(withDecisions({ laying_in_style: ["通常の納棺", "confirmed"] }));
    expect(rows.find((o) => o.id === "yukan")?.status).toBe("not_needed");
    const yes = buildOrders(withDecisions({ laying_in_style: ["湯灌", "confirmed"], laying_in_date: ["明日の午後", "confirmed"] }));
    expect(yes.find((o) => o.id === "yukan")?.status).toBe("ready");
  });

  test("会食なし・掲載しないと決めたら、発注しない", () => {
    const rows = buildOrders(withDecisions({ meals: ["会食なし", "confirmed"], obituary: ["掲載しない", "confirmed"] }));
    expect(rows.find((o) => o.id === "meals")?.status).toBe("not_needed");
    expect(rows.find((o) => o.id === "obituary")?.status).toBe("not_needed");
  });

  test("前提が決まっていないものは、何を待っているかを返す", () => {
    const rows = buildOrders(withDecisions({}));
    expect(rows.find((o) => o.id === "flowers")?.waitingFor).toEqual(["祭壇のプラン", "生花の色合い"]);
  });
});

describe("基幹システム向け CSV", () => {
  test("施行情報の項目名で、確定したものだけを書き出す", () => {
    const csv = toCoreCsv(withDecisions({ religion: ["浄土真宗", "confirmed"], temple: ["西光寺", "candidate"] }));
    expect(csv.startsWith("﻿")).toBe(true);
    const [header = "", row = ""] = csv.slice(1).trim().split("\r\n");
    const h = header.split(",");
    const r = row.split(",");
    expect(r[h.indexOf("宗旨・宗派")]).toBe("浄土真宗");
    expect(r[h.indexOf("寺院名")]).toBe("");
    expect(r[0]).toBe("山田家");
  });

  test("カンマや引用符、数式に見える値を安全に書き出す", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('「"」')).toBe('"「""」"');
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("普通")).toBe("普通");
  });
});

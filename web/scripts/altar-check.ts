/**
 * 祭壇イメージの検品（I3）。画像モデルが編集したイメージを Opus が見て、
 * 指示書どおりか（生花の色だけが変わっているか）、プランにない装飾が足されていないかを確かめる。
 * 不合格のイメージは画面に出さない（src/data/altar-images.json の passed を false にする）。
 *   npm run altar:check
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { ALTAR_PALETTES } from "../src/domain/altar";
import { MODEL_REASONING, getClient } from "../src/engine/client";

const DIR = path.resolve(__dirname, "../public/altar");
const MANIFEST = path.resolve(__dirname, "../src/data/altar-images.json");

const VerdictSchema = z.object({
  passed: z.boolean(),
  flowerColorMatches: z.boolean().describe("生花の色が指示の色合いになっているか"),
  addedObjects: z.array(z.string()).describe("元の画像になく、足されたもの（装飾・人物・文字など）"),
  problems: z.array(z.string()).describe("不合格の理由。日本語で短く"),
});

const SYSTEM = `あなたは葬儀社の祭壇イメージを検品します。1枚目が元の祭壇、2枚目が編集後です。
編集の指示は「生花の色合いだけを変える。構図・祭壇の台・遺影の額・提灯・焼香台はそのまま。新しい物や文字や人を足さない」です。
指示どおりなら passed を true にします。プランにない装飾（豪華な飾り、別の花台、文字、人物など）が足されていたら不合格です。`;

const image = (file: string) => ({
  type: "image" as const,
  source: { type: "base64" as const, media_type: "image/webp" as const, data: readFileSync(path.join(DIR, file)).toString("base64") },
});

async function check(paletteId: string, label: string): Promise<z.infer<typeof VerdictSchema>> {
  const response = await getClient().messages.parse({
    model: MODEL_REASONING,
    max_tokens: 2000,
    system: SYSTEM,
    output_config: { effort: "low", format: zodOutputFormat(VerdictSchema) },
    messages: [{ role: "user", content: [image("white.webp"), image(`${paletteId}.webp`), { type: "text", text: `指示した色合い：${label}` }] }],
  });
  if (!response.parsed_output) throw new Error(`検品の結果を読み取れませんでした: ${paletteId}`);
  return response.parsed_output;
}

async function main(): Promise<void> {
  const results = await Promise.all(
    ALTAR_PALETTES.map(async (p) => {
      if (p.id === "white") return { id: p.id, passed: true, problems: [], checkedAt: new Date().toISOString(), note: "元の画像" };
      const v = await check(p.id, p.label);
      const passed = v.passed && v.flowerColorMatches && v.addedObjects.length === 0;
      process.stdout.write(`${p.id} ${passed ? "合格" : "不合格"} ${[...v.problems, ...v.addedObjects].join("／")}\n`);
      return { id: p.id, passed, problems: [...v.problems, ...v.addedObjects.map((o) => `足された物：${o}`)], checkedAt: new Date().toISOString(), note: "" };
    }),
  );
  writeFileSync(MANIFEST, `${JSON.stringify({ model: MODEL_REASONING, images: results }, null, 2)}\n`);
  process.stdout.write(`書き出しました：${MANIFEST}\n`);
}

void main();

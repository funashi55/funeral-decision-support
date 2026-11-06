"""商品とプランの価格表（集計値）を作る。

入力：葬儀社の基幹システムから取り込んだ SQLite（環境変数 CORE_DB_PATH。リポジトリには含めない）
出力：web/src/data/product-catalog.json（品目ごとの単価の中央値と件数だけ。商品名・会場名・個人の値は出さない）

- 商品名は、下の一般的な言葉で品目にまとめる（実際の商品名や会場名は出力しない）
- 会員と一般で価格が分かれている品目は、それぞれの中央値を出す
- 件数が MIN_COUNT 未満の品目は出力しない
- 単価は 500 円単位に丸める
"""

from __future__ import annotations

import json
import os
import re
import sqlite3
import sys
from datetime import date
from pathlib import Path

import pandas as pd

MIN_COUNT = 30
SINCE_YEAR = 2021
OUT = Path(__file__).resolve().parent.parent / "web" / "src" / "data" / "product-catalog.json"

# (id, 表示名, 単位, 商品区分の正規表現 or None, 商品名の正規表現, 除く正規表現, 単価の下限)
ITEMS = [
    ("pickup", "お迎え（ご遺体の搬送）", "式", None, r"お迎え", r"距離", 10_000),
    ("pillow_set", "枕飾り一式", "式", None, r"枕飾り", r"菓子|果物|花", 10_000),
    ("laying_care", "納棺処置", "式", None, r"納棺処置", None, 10_000),
    ("robe", "仏衣", "式", r"葬用品", r"仏衣", None, 5_000),
    ("coffin", "棺", "式", r"棺", r"棺", r"花|枕|処置|アイス|シャワー", 50_000),
    ("urn", "骨箱一式", "式", r"収骨容器", r"骨箱", None, 5_000),
    ("tablet", "位牌", "式", r"葬用品", r"位牌", None, 5_000),
    ("portrait", "遺影写真", "式", r"写真加工", r"写真", None, 10_000),
    ("hearse", "霊柩車", "式", r"葬用品", r"霊柩車", r"距離", 10_000),
    ("yukan", "湯灌（お体を洗い清める）", "式", None, r"シャワー|湯灌", None, 30_000),
    ("embalming", "エンバーミング（防腐・修復の処置）", "式", None, r"エンバーミング", None, 50_000),
    ("dry_ice", "ドライアイス（1日）", "日", None, r"アイス", r"5.?(?:kg|キロ)", 5_000),
    ("resting_fee", "会館での安置（1泊）", "日", r"会場費", r"安置料.*1泊", None, 10_000),
    ("hall_fee", "会場使用料（1日）", "式", r"会場費", r"会場費.*1日", None, 10_000),
    ("farewell_flowers", "出棺花", "式", r"葬用品", r"出棺花", None, 3_000),
    ("coffin_bouquet", "棺上花束", "式", r"葬用品", r"棺上花束", None, 3_000),
    ("toba", "塔婆一式", "式", r"葬用品", r"塔婆", None, 3_000),
    ("koden_book", "香典帳一式", "式", r"葬用品", r"香典帳", None, 1_000),
    ("crematory_car", "火葬場への送迎車", "台", None, r"タクシー", None, 10_000),
    ("obituary", "新聞のお悔やみ欄（掲載）", "式", r"新聞広告", r"新聞|広告|掲載", None, 10_000),
    ("meal", "料理（お一人）", "名", r"^料理$", r".", None, 500),
    ("return_gift", "香典返し（お一つ）", "個", r"^返礼品$", r".", None, 500),
]

# 祭壇の大きさごとのプラン（祭壇の区分のうち、祭壇・プランの単価）
ALTAR_NAME = r"祭壇|プラン"
ALTAR_EXCLUDE = r"供物|花|設営|準備|火葬式"
ALTAR_MIN = 80_000


def round500(x: float) -> int:
    return int(round(x / 500) * 500)


def load(db_path: str) -> pd.DataFrame:
    con = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    df = pd.read_sql("select 商品区分名, 商品名, 単価, 抽出開始日 from sales_by_product", con)
    df["year"] = df["抽出開始日"].str[:4].astype(int)
    df["単価"] = pd.to_numeric(df["単価"], errors="coerce")
    return df[(df["year"] >= SINCE_YEAR) & (df["単価"] > 0)].fillna({"商品名": "", "商品区分名": ""})


def item_row(df: pd.DataFrame, spec: tuple) -> dict | None:
    item_id, label, unit, cat, name, exclude, floor = spec
    x = df[df["単価"] >= floor]
    if cat:
        x = x[x["商品区分名"].str.contains(cat, regex=True)]
    x = x[x["商品名"].str.contains(name, regex=True)]
    if exclude:
        x = x[~x["商品名"].str.contains(exclude, regex=True)]
    if len(x) < MIN_COUNT:
        return None
    general = x[x["商品名"].str.contains("一般")]
    member = x[~x["商品名"].str.contains("一般")]
    member_price = round500(member["単価"].median()) if len(member) >= MIN_COUNT else round500(x["単価"].median())
    general_price = round500(general["単価"].median()) if len(general) >= MIN_COUNT else member_price
    return {"id": item_id, "label": label, "unit": unit, "memberPrice": member_price, "generalPrice": max(general_price, member_price), "count": int(len(x))}


def altar(df: pd.DataFrame) -> dict:
    x = df[df["商品区分名"].str.contains("祭壇") & df["商品名"].str.contains(ALTAR_NAME) & ~df["商品名"].str.contains(ALTAR_EXCLUDE) & (df["単価"] >= ALTAR_MIN)]
    q = x["単価"].quantile([0.25, 0.5, 0.75])
    return {"small": round500(q[0.25]), "medium": round500(q[0.5]), "large": round500(q[0.75]), "count": int(len(x))}


def main() -> None:
    db = os.environ.get("CORE_DB_PATH")
    if not db:
        sys.exit("CORE_DB_PATH を設定してください")
    df = load(db)
    items = [r for r in (item_row(df, s) for s in ITEMS) if r]
    out = {
        "source": "東北地方の互助会系葬儀社の施行の記録（商品別の売上）",
        "period": f"{SINCE_YEAR}年以降",
        "builtAt": date.today().isoformat(),
        "minCount": MIN_COUNT,
        "note": "単価は品目ごとの中央値を500円単位に丸めた値。祭壇は大きさの下位25%・中央値・上位25%",
        "altar": altar(df),
        "items": items,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{len(items)} 品目と祭壇 {out['altar']['count']} 件を書き出しました")
    missing = [s[0] for s in ITEMS if s[0] not in {r['id'] for r in items}]
    if missing:
        print("件数が足りず出さなかった品目：", ", ".join(missing))


if __name__ == "__main__":
    main()

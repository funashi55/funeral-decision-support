"""基幹システムの探索：葬儀の施行で何を決めているか・何が分かれるかを、集計値だけで見る。

    CORE_DB_PATH=/path/to/core.db python3 scripts/explore_core.py

- 値そのものを出すのは、MIN_COUNT 件以上ある値だけ（少ない値は「少数の値」にまとめる）
- 住所・氏名・電話・担当者名・請求先の列は読まない
- 結果は docs/private/core-explore.md に書く（公開しない）
"""

from __future__ import annotations

import os
import re
import sqlite3
import sys
from pathlib import Path

import pandas as pd

MIN_COUNT = 30
OUT = Path(__file__).resolve().parent.parent / "docs" / "private" / "core-explore.md"
SKIP = re.compile(r"住所|名$|名カナ|電話|staff|担当|請求先|施行$|^id$|_no$|No|番号|downloaded|抽出")
CATEGORICAL = ["department_name", "basic_pattern", "喪主からみた続柄", "故人に同じ", "安置先名", "法要場所", "利用斎場", "申込区分_コード",
               "葬儀区分_コード", "会員区分_コード", "葬儀形式_コード", "故人性別_コード", "安置先区分_コード", "宗旨_コード", "宗派_コード", "個人情報", "行年・享年区分"]


def counts(series: pd.Series) -> list[str]:
    vc = series.fillna("（空欄）").astype(str).value_counts()
    shown = [f"{v}：{n}（{n * 100 / len(series):.1f}%）" for v, n in vc.items() if n >= MIN_COUNT]
    rest = int(vc[vc < MIN_COUNT].sum())
    if rest:
        shown.append(f"少数の値（{int((vc < MIN_COUNT).sum())}種）：{rest}")
    return shown


def section_info(con: sqlite3.Connection, out: list[str]) -> None:
    info = pd.read_sql("select * from construction_info", con)
    out.append(f"## 施行情報の区分（{len(info)} 件）\n")
    for col in CATEGORICAL:
        if col in info.columns:
            out.append(f"### {col}\n" + "\n".join(f"- {x}" for x in counts(info[col])) + "\n")
    for col in ["葬儀会場名", "死亡場所", "寺院名"]:
        if col in info.columns:
            out.append(f"### {col}（{info[col].nunique()}種。{MIN_COUNT}件以上のものだけ）\n" + "\n".join(f"- {x}" for x in counts(info[col])) + "\n")
    dates = {c: pd.to_datetime(info[c], errors="coerce") for c in ["受付日", "通夜日", "葬儀日"]}
    gap = (dates["葬儀日"] - dates["通夜日"]).dt.days
    out.append("### 通夜日と葬儀日の差（日）\n" + "\n".join(f"- {x}" for x in counts(gap.where(gap.between(-3, 10)))) + "\n")


def section_items(con: sqlite3.Connection, out: list[str]) -> None:
    staff = pd.read_sql("select * from sales_by_staff", con)
    meta = {"施行法要", "ご法要場所", "ご法宴場所", "基本パターン区分", "会員区分", "区分"}
    for col in meta & set(staff.columns):
        out.append(f"### 明細の {col}\n" + "\n".join(f"- {x}" for x in counts(staff[col])) + "\n")
    numeric = [c for c in staff.columns if c not in meta and not SKIP.search(c) and c not in {"年月日", "受付日", "死亡日"}]
    values = staff[numeric].apply(pd.to_numeric, errors="coerce")
    rows = []
    for col in numeric:
        filled = values[col].notna()
        n = int(filled.sum())
        if n < MIN_COUNT:
            continue
        rate = float(values.loc[filled, col].ne(0).mean() * 100)
        rows.append((col, n, rate))
    out.append(f"## 施行ごとの明細：品目が選ばれた割合（{len(staff)} 施行、記録のある施行のうち）\n")
    for title, lo, hi in [("家族によって分かれる品目（5〜95%）", 5, 95), ("ほぼ全員の品目（95%超）", 95, 101), ("まれな品目（1〜5%）", 1, 5)]:
        picked = sorted([r for r in rows if lo <= r[2] < hi], key=lambda r: -r[2])
        out.append(f"### {title}：{len(picked)} 品目\n" + "\n".join(f"- {c}：{rate:.1f}%（{n}）" for c, n, rate in picked) + "\n")


def section_products(con: sqlite3.Connection, out: list[str]) -> None:
    prod = pd.read_sql('select 商品区分名, 商品名, 数量 from sales_by_product', con)
    prod["数量"] = pd.to_numeric(prod["数量"], errors="coerce").fillna(0)
    out.append("## 商品区分ごとの品目（数量の合計。上位10）\n")
    by_cat = prod.groupby("商品区分名")["数量"].sum().sort_values(ascending=False)
    for cat, qty in by_cat.items():
        top = prod[prod["商品区分名"] == cat].groupby("商品名")["数量"].sum().sort_values(ascending=False)
        top = top[top >= MIN_COUNT].head(10)
        out.append(f"### {cat}（合計 {int(qty)}・{prod[prod['商品区分名'] == cat]['商品名'].nunique()} 品目）\n" + "\n".join(f"- {n}：{int(q)}" for n, q in top.items()) + "\n")


def main() -> None:
    db_path = os.path.expanduser(os.environ.get("CORE_DB_PATH", ""))
    if not db_path:
        sys.exit("CORE_DB_PATH を設定してください")
    con = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    out: list[str] = ["# 基幹システムの探索（集計値のみ・非公開）\n"]
    section_info(con, out)
    section_items(con, out)
    section_products(con, out)
    OUT.write_text("\n".join(out), encoding="utf-8")
    print(f"書き出し：{OUT}（{sum(len(x) for x in out)} 文字）")


if __name__ == "__main__":
    main()

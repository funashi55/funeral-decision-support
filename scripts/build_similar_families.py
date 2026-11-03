"""似た家族の選び方の匿名集計表を作る。

入力：葬儀社の基幹システムから取り込んだ SQLite（環境変数 CORE_DB_PATH。リポジトリには含めない）
出力：web/src/data/similar-families.json（集計値のみ。個人を特定できる値は一切含めない）

- 件数が MIN_COUNT 未満の区分は出力しない（少数の家族が推測されるのを防ぐ）
- 割合は小数第1位まで
"""

from __future__ import annotations

import json
import os
import sqlite3
import sys
from datetime import date
from pathlib import Path

import pandas as pd

MIN_COUNT = 30
OUT = Path(__file__).resolve().parent.parent / "web" / "src" / "data" / "similar-families.json"
STYLE = {1: "家族葬", 2: "一般葬", 3: "一日葬", 4: "火葬式"}
MEMBER = {1: "互助会の会員", 2: "会員ではない", 3: "メンバーズ会員"}


def load(db_path: str) -> pd.DataFrame:
    con = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    staff = pd.read_sql("select * from sales_by_staff", con)
    item_cols = [c for c in staff.columns if "シャワー" in c]
    staff = staff.assign(
        yukan=staff[item_cols].apply(pd.to_numeric, errors="coerce").fillna(0).ne(0).any(axis=1),
        no=pd.to_numeric(staff["施行No."], errors="coerce"),
    )[["no", "yukan"]]
    info = pd.read_sql(
        "select execution_no, 受付日, 葬儀日, 故人の満年齢, 葬儀区分_コード, 会員区分_コード from construction_info",
        con,
    )
    df = info.merge(staff, left_on="execution_no", right_on="no", how="left")
    days = (pd.to_datetime(df["葬儀日"], errors="coerce") - pd.to_datetime(df["受付日"], errors="coerce")).dt.days
    return pd.DataFrame(
        {
            "days_band": pd.cut(days, [-1, 3, 5, 30], labels=["3日以内", "4〜5日", "6日以上"]),
            "age_band": pd.cut(pd.to_numeric(df["故人の満年齢"], errors="coerce"), [0, 64, 79, 89, 120], labels=["64歳以下", "65〜79歳", "80〜89歳", "90歳以上"]),
            "style": df["葬儀区分_コード"].map(STYLE),
            "membership": df["会員区分_コード"].map(MEMBER),
            "yukan": df["yukan"],
            "year": pd.to_datetime(df["葬儀日"], errors="coerce").dt.year,
        }
    )


def rate(series: pd.Series) -> float:
    return round(float(series.mean()) * 100, 1)


def breakdown(df: pd.DataFrame, by: str, outcome: str) -> list[dict]:
    rows = []
    for key, group in df.dropna(subset=[by, outcome]).groupby(by, observed=True):
        if len(group) < MIN_COUNT:
            continue
        rows.append({"group": str(key), "count": int(len(group)), "percent": rate(group[outcome].astype(bool))})
    return rows


def style_share(df: pd.DataFrame, by: str) -> list[dict]:
    rows = []
    for key, group in df.dropna(subset=[by]).groupby(by, observed=True):
        known = group.dropna(subset=["style"])
        if len(known) < MIN_COUNT:
            continue
        shares = (known["style"].value_counts(normalize=True) * 100).round(1)
        rows.append({"group": str(key), "count": int(len(known)), "shares": {k: float(v) for k, v in shares.items()}})
    return rows


def main() -> None:
    db_path = os.environ.get("CORE_DB_PATH")
    if not db_path:
        sys.exit("CORE_DB_PATH を設定してください")
    df = load(db_path)
    yukan_known = df[df["yukan"].notna()]
    recent = df[df["year"] >= 2023]
    result = {
        "source": "東北地方の互助会系葬儀社の基幹システム（匿名集計）",
        "period": f"{int(df['year'].min())}〜{int(df['year'].max())}年",
        "generatedAt": date.today().isoformat(),
        "minCount": MIN_COUNT,
        "totalFunerals": int(len(df)),
        "yukan": {
            "description": "湯灌（お体を洗い清める）を選んだ家族の割合",
            "overall": {"count": int(len(yukan_known)), "percent": rate(yukan_known["yukan"].astype(bool))},
            "byDaysUntilFuneral": breakdown(yukan_known, "days_band", "yukan"),
            "byAge": breakdown(yukan_known, "age_band", "yukan"),
            "byStyle": breakdown(yukan_known, "style", "yukan"),
        },
        # 通夜の有無は集計しない：一日葬でも通夜日が入っている家族が多く、
        # 通夜日の欄が通夜以外の日時にも使われていたと考えられるため
        "funeralStyle": {
            "description": "葬儀の形の内訳（2023年以降、形が記録された家族のみ）",
            "byAge": style_share(recent, "age_band"),
            "byMembership": style_share(recent, "membership"),
        },
    }
    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()

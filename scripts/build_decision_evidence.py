"""決めることボードの項目に添える「実績」を、基幹システムの施行データから作る（集計値のみ）。

入力：環境変数 CORE_DB_PATH（リポジトリの外の SQLite）
出力：web/src/data/decision-evidence.json（公開してよい集計値だけ。社名・施設名・寺院名・個人は含めない）

- 施行1件ずつの記録から数える。MIN_COUNT 件未満の区分は出さない
- 基幹システムの取り込みで空欄が文字列 "nan" になっている列があるため、空欄としてそろえる
- パッケージの一式として全施行に入る品目（位牌・塔婆・写真など）は「家族が決めた」とは数えない
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
OUT = Path(__file__).resolve().parent.parent / "web" / "src" / "data" / "decision-evidence.json"
STYLE = {1: "家族葬", 2: "一般葬", 3: "一日葬", 4: "火葬式"}
BLANK = {"", "nan", "None", "none", "NaN"}
CHILD = {"1:父", "2:母", "13:義母", "12:義父"}
SPOUSE = {"3:妻", "4:夫"}


def blank(s: pd.Series) -> pd.Series:
    return s.isna() | s.astype(str).str.strip().isin(BLANK)


def pct(mask: pd.Series) -> float:
    return round(float(mask.mean()) * 100, 1)


def has(df: pd.DataFrame, keys: list[str]) -> pd.Series:
    cols = [c for c in df.columns if any(k in c for k in keys)]
    return df[cols].apply(pd.to_numeric, errors="coerce").fillna(0).ne(0).any(axis=1)


def main() -> None:
    db = os.path.expanduser(os.environ.get("CORE_DB_PATH", ""))
    if not db:
        sys.exit("CORE_DB_PATH を設定してください")
    con = sqlite3.connect(f"file:{db}?mode=ro", uri=True)
    info = pd.read_sql("select execution_no, department_name, 葬儀日, 喪主からみた続柄, 葬儀区分_コード, 会員区分_コード, 宗旨_コード, 宗派_コード, 寺院名, 安置先名 from construction_info", con)
    staff = pd.read_sql("select * from sales_by_staff", con)
    staff["no"] = pd.to_numeric(staff["施行No."], errors="coerce")
    staff = staff.assign(yukan=has(staff, ["シャワー"]), hospitality=pd.to_numeric(staff["おもてなし"], errors="coerce").fillna(0).ne(0))
    df = info.merge(staff[["no", "yukan", "hospitality"]], left_on="execution_no", right_on="no", how="left")
    ceremony = df[~df["department_name"].astype(str).str.contains("火")]
    recent = df[pd.to_datetime(df["葬儀日"], errors="coerce").dt.year >= 2023]
    styles = recent["葬儀区分_コード"].map(STYLE).dropna()
    sects = df.loc[~blank(df["宗派_コード"]), "宗派_コード"].astype(str)
    relation = df["喪主からみた続柄"].astype(str)
    total = len(df)

    def entry(text: str, count: int) -> dict:
        if count < MIN_COUNT:
            raise SystemExit(f"件数が少なすぎます：{text}")
        return {"text": text, "count": int(count)}

    share = (styles.value_counts(normalize=True) * 100).round(1)
    top_sects = (sects.value_counts(normalize=True) * 100).round(1).head(4)
    evidence = {
        "funeral_style": entry("2023年以降の形の内訳：" + "・".join(f"{k} {v}%" for k, v in share.items()), len(styles)),
        "wake_held": entry(f"2023年以降、通夜を行わない一日葬は {share.get('一日葬', 0)}%", len(styles)),
        "religion": entry("宗派：" + "・".join(f"{k} {v}%" for k, v in top_sects.items()) + f"。記入なしが {pct(blank(df['宗派_コード']))}%", total),
        "temple": entry(f"式場で葬儀をした家族でも {pct(blank(ceremony['寺院名']))}% は寺院の記録がない（菩提寺がない家族は珍しくない）", len(ceremony)),
        "membership": entry(f"互助会の会員は {pct(df['会員区分_コード'] == 1)}%。会員には積み立ての残りの精算がある", total),
        "chief_mourner": entry(f"喪主は故人の子が約 {pct(relation.isin(CHILD))}%、配偶者が {pct(relation.isin(SPOUSE))}%（高齢の喪主への配慮が要る）", total),
        "resting_place": entry(f"会館など式場側に安置した記録がある家族は {pct(~blank(df['安置先名']))}%", total),
        "laying_in_style": entry(f"湯灌を選んだ家族は {pct(df['yukan'].eq(True))}%", int(df["yukan"].notna().sum())),
        "meals": entry(f"料理・返礼品などのおもてなしがあった家族は {pct(df['hospitality'].eq(True))}%（数は参列の見込みで決める）", int(df["hospitality"].notna().sum())),
    }
    result = {
        "source": "東北地方の互助会系葬儀社の基幹システム（施行の記録・匿名集計）",
        "generatedAt": date.today().isoformat(),
        "minCount": MIN_COUNT,
        "totalFunerals": total,
        "evidence": evidence,
    }
    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

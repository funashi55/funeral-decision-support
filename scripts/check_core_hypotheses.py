"""知見の案を、施行1件ずつのデータに当てて確かめる（集計値だけを出す。MIN_COUNT 件未満の区分は出さない）。

    CORE_DB_PATH=/path/to/core.db python3 scripts/check_core_hypotheses.py
"""

from __future__ import annotations

import os
import sqlite3

import pandas as pd

MIN_COUNT = 30
STYLE = {1: "家族葬", 2: "一般葬", 3: "一日葬", 4: "火葬式"}
BLANK = {"", "nan", "None", "none", "NaN"}


def blank(s: pd.Series) -> pd.Series:
    return s.isna() | s.astype(str).str.strip().isin(BLANK)


def num(df: pd.DataFrame, keys: list[str]) -> pd.Series:
    cols = [c for c in df.columns if any(k in c for k in keys)]
    return df[cols].apply(pd.to_numeric, errors="coerce").fillna(0).sum(axis=1) if cols else pd.Series(0, index=df.index)


def show(title: str, table: pd.DataFrame) -> None:
    print(f"\n## {title}")
    print(table.to_string())


def main() -> None:
    con = sqlite3.connect(f"file:{os.path.expanduser(os.environ['CORE_DB_PATH'])}?mode=ro", uri=True)
    info = pd.read_sql('select execution_no, department_name, basic_pattern, 受付日, 葬儀日, 故人の満年齢, 喪主からみた続柄, 葬儀区分_コード, 会員区分_コード, 宗旨_コード, 宗派_コード, 寺院名, 死亡場所, 安置先名, 葬儀会場名 from construction_info', con)
    staff = pd.read_sql("select * from sales_by_staff", con)
    staff["no"] = pd.to_numeric(staff["施行No."], errors="coerce")
    df = info.merge(staff, left_on="execution_no", right_on="no", how="inner")
    days = (pd.to_datetime(df["葬儀日"], errors="coerce") - pd.to_datetime(df["受付日_x"], errors="coerce")).dt.days
    df = df.assign(
        style=df["葬儀区分_コード"].map(STYLE).fillna("その他・不明"),
        days_band=pd.cut(days.where(days.between(0, 30)), [-1, 3, 5, 30], labels=["3日以内", "4〜5日", "6日以上"]),
        dept_kind=df["department_name"].astype(str).str.contains("火").map({True: "火葬のみの部門", False: "式場・自宅など"}),
        temple_none=blank(df["寺院名"]),
        sect_none=blank(df["宗派_コード"]),
        sect=df["宗派_コード"].astype(str).where(~blank(df["宗派_コード"]), "（未記入）"),
        ihai=num(df, ["位牌"]).ne(0),
        ice=num(df, ["ドライアイス", "スーパーアイス", "冷却"]),
        hospitality=pd.to_numeric(df["おもてなし"], errors="coerce").fillna(0),
        upgrade=num(df, ["グレードアップ"]).ne(0),
        soul=num(df, ["ソウルジュエリー"]).ne(0),
        net=df["基本パターン区分"].astype(str).str.contains("ネット") | df["basic_pattern"].astype(str).str.contains("ﾈｯﾄ|ネット"),
    )

    def rate(group: str, col: str) -> pd.DataFrame:
        g = df.groupby(group, observed=True)[col].agg(["count", "mean"])
        g = g[g["count"] >= MIN_COUNT]
        return g.assign(percent=(g["mean"] * 100).round(1)).drop(columns="mean")

    show("寺院名なし（空欄・nan を含めて）：部門別", rate("dept_kind", "temple_none"))
    show("寺院名なし：葬儀の形別", rate("style", "temple_none"))
    show("宗派の記入なし：葬儀の形別", rate("style", "sect_none"))
    show("位牌が明細にある割合：宗派別（パッケージの一式かを確かめる）", rate("sect", "ihai").sort_values("count", ascending=False).head(12))
    ice = df[df["ice"] > 0].groupby("days_band", observed=True)["ice"].agg(["count", "median", "mean"])
    show("冷却（ドライアイス等）の金額：受付から葬儀までの日数別（冷却の明細がある施行）", ice[ice["count"] >= MIN_COUNT].round(0))
    hosp = df.groupby("style", observed=True)["hospitality"].agg(count="count", zero_percent=lambda s: round(float(s.eq(0).mean()) * 100, 1), median="median", p75=lambda s: s.quantile(0.75))
    show("おもてなし（料理・返礼品など）：葬儀の形別", hosp[hosp["count"] >= MIN_COUNT])
    show("祭壇のグレードアップがある割合：葬儀の形別", rate("style", "upgrade"))
    show("ソウルジュエリーがある割合：葬儀の形別", rate("style", "soul"))
    show("ネット経由のプランの割合：部門別", rate("dept_kind", "net"))


if __name__ == "__main__":
    main()

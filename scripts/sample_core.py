"""施行を1件ずつ見る（個別確認用。結果は画面に出すだけで、ファイルに残さない）。

    CORE_DB_PATH=/path/to/core.db python3 scripts/sample_core.py [件数] [条件]

条件の例：yukan（湯灌あり）、temple_none（寺院なし）、police（警察署）、welfare（葬祭扶助）、long（受付から7日以上）、shin（真宗系）、soka（創価学会）
住所・氏名・電話・担当者名・請求先は読まない。死亡場所は「病院・自宅・警察・施設・その他」に丸める。
"""

from __future__ import annotations

import os
import sqlite3
import sys

import pandas as pd

STYLE = {1: "家族葬", 2: "一般葬", 3: "一日葬", 4: "火葬式"}
INFO_COLS = ["execution_no", "department_name", "basic_pattern", "受付日", "葬儀日", "故人の満年齢", "故人性別_コード", "喪主からみた続柄",
             "葬儀区分_コード", "会員区分_コード", "宗旨_コード", "宗派_コード", "寺院名", "死亡場所", "安置先名", "葬儀会場名", "利用斎場", "売上金額_税込"]
SKIP = {"id", "部門CD", "部門名", "担当者CD", "担当者名", "区分", "年月日", "受付日", "死亡日", "請求番号", "施行No.", "施行No2.", "施行", "請求先名",
        "抽出開始日", "抽出終了日", "downloaded_at", "合計", "葬送儀礼", "おもてなし", "その他"}


def place_kind(value: object) -> str:
    text = str(value)
    if text in {"", "nan", "None"}:
        return "不明"
    if "自宅" in text:
        return "自宅"
    if "警察" in text:
        return "警察"
    if any(k in text for k in ["病院", "医院", "クリニック", "内科", "外科"]):
        return "病院"
    if any(k in text for k in ["園", "荘", "ホーム", "苑", "施設"]):
        return "施設"
    return "その他"


def main() -> None:
    db = os.path.expanduser(os.environ.get("CORE_DB_PATH", ""))
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 5
    cond = sys.argv[2] if len(sys.argv) > 2 else ""
    con = sqlite3.connect(f"file:{db}?mode=ro", uri=True)
    info = pd.read_sql(f"select {', '.join(chr(34) + c + chr(34) for c in INFO_COLS)} from construction_info", con)
    staff = pd.read_sql("select * from sales_by_staff", con)
    staff["no"] = pd.to_numeric(staff["施行No."], errors="coerce")
    items = [c for c in staff.columns if c not in SKIP and c != "no"]
    df = info.merge(staff, left_on="execution_no", right_on="no", how="inner")
    df["days"] = (pd.to_datetime(df["葬儀日"], errors="coerce") - pd.to_datetime(df["受付日_x"], errors="coerce")).dt.days
    df["place"] = df["死亡場所"].map(place_kind)
    filters = {
        "yukan": df[[c for c in items if "シャワー" in c]].apply(pd.to_numeric, errors="coerce").fillna(0).ne(0).any(axis=1),
        "temple_none": df["寺院名"].isna() | (df["寺院名"].astype(str).str.strip() == ""),
        "police": df["place"] == "警察",
        "long": df["days"] >= 7,
        "shin": df["宗派_コード"].astype(str).str.contains("真宗"),
        "soka": df["宗派_コード"].astype(str).str.contains("創価"),
    }
    pool = df[filters[cond]] if cond in filters else df
    print(f"条件 {cond or 'なし'}：{len(pool)} 件から {min(n, len(pool))} 件")
    for _, r in pool.sample(min(n, len(pool)), random_state=None).iterrows():
        age = r["故人の満年齢"]
        print("\n────")
        print(f"{r['department_name']}｜{r['basic_pattern']}｜{STYLE.get(r['葬儀区分_コード'], r['葬儀区分_コード'])}｜会員区分 {r['会員区分_コード']}｜{r['基本パターン区分']}")
        print(f"故人 {'' if pd.isna(age) else int(age)}歳・性別{r['故人性別_コード']}｜喪主から見て {r['喪主からみた続柄']}｜受付→葬儀 {r['days']}日｜亡くなった所：{r['place']}")
        print(f"{r['宗旨_コード']}・{r['宗派_コード']}｜寺院 {'あり' if pd.notna(r['寺院名']) and str(r['寺院名']).strip() else 'なし'}｜安置 {r['安置先名']}｜会場 {r['葬儀会場名']}｜斎場 {r['利用斎場']}")
        print(f"合計 {r['合計']}（葬送儀礼 {r['葬送儀礼']}・おもてなし {r['おもてなし']}・その他 {r['その他']}）｜法要 {r['施行法要']}・法宴 {r['ご法宴場所']}")
        values = pd.to_numeric(r[items], errors="coerce")
        chosen = [f"{c}={int(v)}" for c, v in values.items() if pd.notna(v) and v != 0]
        print("品目：" + "、".join(chosen))


if __name__ == "__main__":
    main()

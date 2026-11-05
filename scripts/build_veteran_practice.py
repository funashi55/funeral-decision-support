"""ベテランの施行実績の匿名集計（初期の「となりのベテランから」の根拠づくり）。

入力：基幹システムから取り込んだ SQLite（環境変数 CORE_DB_PATH。リポジトリには含めない）
      ベテランの名前（環境変数 VETERAN_NAMES。カンマ区切り。リポジトリには書かない）
出力：docs/private/veteran/core-practice.json（公開しない。集計値のみ）
      docs/private/veteran/aliases.json（名前と記号 A〜D の対応。公開しない）

使い方：
    CORE_DB_PATH=/path/to/core.db VETERAN_NAMES="名前1,名前2,名前3,名前4" \\
      python3 scripts/build_veteran_practice.py

- ベテランが施行担当だった施行と、それ以外の施行を、葬儀の形ごとに比べる（形の違いで選び方が変わるのを除くため）
- 件数が MIN_COUNT 未満の区分は出さない
- 画面に出すのは名前ではなく記号（ベテランA〜D）。氏名・住所・金額の個別値は出さない
"""

from __future__ import annotations

import difflib
import json
import os
import sqlite3
import sys
from datetime import date
from pathlib import Path

import pandas as pd

MIN_COUNT = 30
ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "docs" / "private" / "veteran"
STYLE = {1: "家族葬", 2: "一般葬", 3: "一日葬", 4: "火葬式"}
MEMBER = {1: "互助会の会員", 2: "会員ではない", 3: "メンバーズ会員"}

# 明細の列名に含まれる言葉で、施行ごとに「選んだか」を判定する
ITEMS: dict[str, dict[str, object]] = {
    "yukan": {"label": "湯灌（ボディーシャワー）", "keys": ["シャワー"]},
    "farewell_flowers": {"label": "出棺花・棺上花束・献花", "keys": ["出棺花", "棺上花束", "献花"]},
    "extra_ice": {"label": "ドライアイス・冷却の追加", "keys": ["ドライアイス", "スーパーアイス", "冷却"]},
    "home_altar": {"label": "自宅祭壇（花・供物）", "keys": ["自宅祭壇", "自宅用祭壇"]},
    "jumbo_taxi": {"label": "ジャンボタクシー", "keys": ["ジャンボタクシー"]},
    "anchi_fee": {"label": "安置料・安置費用", "keys": ["安置料", "安置費用"]},
}
# 金額の合計列（0 でなければ「あった」とみなす）
TOTALS = {"hospitality": {"label": "おもてなし（料理・返礼品など）", "column": "おもてなし"}}


# 名前の字体の違い（旧字・異体字）をそろえる
VARIANTS = str.maketrans({"舘": "館", "髙": "高", "﨑": "崎", "嵜": "崎", "齋": "斉", "齊": "斉", "斎": "斉", "邊": "辺", "邉": "辺", "濱": "浜", "澤": "沢", "櫻": "桜", "廣": "広", "德": "徳", "惠": "恵"})


def normalize(name: object) -> str:
    return "".join(str(name).split()).translate(VARIANTS)


def load(db_path: str) -> tuple[pd.DataFrame, dict[str, list[str]]]:
    con = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    info = pd.read_sql(
        'select execution_no, department_name, basic_pattern, execution_staff_name, reception_staff_name, 受付日, 葬儀日, 故人の満年齢, 葬儀区分_コード, 会員区分_コード from construction_info',
        con,
    )
    staff = pd.read_sql('select * from sales_by_staff', con)
    staff["no"] = pd.to_numeric(staff["施行No."], errors="coerce")
    matched_columns: dict[str, list[str]] = {}
    flags = pd.DataFrame({"no": staff["no"]})
    for key, spec in ITEMS.items():
        cols = [c for c in staff.columns if any(k in c for k in spec["keys"])]  # type: ignore[union-attr]
        matched_columns[key] = cols
        values = staff[cols].apply(pd.to_numeric, errors="coerce").fillna(0) if cols else pd.DataFrame(index=staff.index)
        flags[key] = values.ne(0).any(axis=1) if cols else pd.NA
    for key, spec in TOTALS.items():
        col = str(spec["column"])
        matched_columns[key] = [col] if col in staff.columns else []
        flags[key] = pd.to_numeric(staff[col], errors="coerce").fillna(0).ne(0) if col in staff.columns else pd.NA
    # 同じ施行が複数行ある場合は、どれかで選んでいれば選んだとみなす
    flags = flags.dropna(subset=["no"]).groupby("no", as_index=False).max()
    df = info.merge(flags, left_on="execution_no", right_on="no", how="inner")
    days = (pd.to_datetime(df["葬儀日"], errors="coerce") - pd.to_datetime(df["受付日"], errors="coerce")).dt.days
    df = df.assign(
        staff=df["execution_staff_name"].map(normalize),
        reception=df["reception_staff_name"].map(normalize),
        days=days.where(days.between(0, 30)),
        days_band=pd.cut(days, [-1, 3, 5, 30], labels=["3日以内", "4〜5日", "6日以上"]),
        age_band=pd.cut(pd.to_numeric(df["故人の満年齢"], errors="coerce"), [0, 64, 79, 89, 120], labels=["64歳以下", "65〜79歳", "80〜89歳", "90歳以上"]),
        style=df["葬儀区分_コード"].map(STYLE),
        membership=df["会員区分_コード"].map(MEMBER),
        year=pd.to_datetime(df["葬儀日"], errors="coerce").dt.year,
        # ネット経由のプランと火葬だけの部門（担当者の判断より申込の経路で形が決まる施行）
        routed=df["department_name"].astype(str).str.contains("火") | df["basic_pattern"].astype(str).str.contains("ﾈｯﾄ|ネット"),
    )
    return df, matched_columns


def assign_groups(df: pd.DataFrame, names: list[str]) -> tuple[pd.DataFrame, list[dict]]:
    """名前を記号に置き換える。名前が複数の担当者に当たる・当たらないときは止める（取り違えを防ぐ）"""
    staff_names = sorted(df["staff"].dropna().unique())
    group = pd.Series("その他の担当者", index=df.index)
    report = []
    for i, raw in enumerate(names):
        alias = f"ベテラン{chr(ord('A') + i)}"
        target = normalize(raw)
        hits = [s for s in staff_names if target in s]
        if len(hits) != 1:
            in_reception = sum(target in r for r in df["reception"].dropna().unique())
            close = difflib.get_close_matches(target, staff_names, n=3, cutoff=0.4)
            sys.exit(
                f"{alias}（{raw}）：施行担当の名前に当てはまる人が {len(hits)} 人います。"
                f"受付担当には {in_reception} 人当てはまります。施行担当の近い名前：{'、'.join(close) or 'なし'}"
            )
        mask = df["staff"] == hits[0]
        group[mask] = alias
        years = df.loc[mask, "year"].dropna()
        report.append({"alias": alias, "funerals": int(mask.sum()), "years": f"{int(years.min())}〜{int(years.max())}" if len(years) else ""})
    return df.assign(group=group), report


def rate(series: pd.Series) -> float:
    return round(float(series.astype(bool).mean()) * 100, 1)


def cell(sub: pd.DataFrame) -> dict | None:
    if len(sub) < MIN_COUNT:
        return None
    out: dict[str, object] = {"count": int(len(sub))}
    for key in [*ITEMS, *TOTALS]:
        known = sub[key].dropna()
        if len(known) >= MIN_COUNT:
            out[key] = rate(known)
    days = sub["days"].dropna()
    if len(days) >= MIN_COUNT:
        out["daysMedian"] = float(days.median())
    return out


def compare(df: pd.DataFrame, groups: list[str]) -> list[dict]:
    rows = []
    for style in ["全体", *STYLE.values()]:
        scoped = df if style == "全体" else df[df["style"] == style]
        row: dict[str, object] = {"style": style, "groups": {}}
        for g in groups:
            sub = scoped[scoped["group"] == g] if g != "ベテラン4人" else scoped[scoped["group"].str.startswith("ベテラン")]
            c = cell(sub)
            if c:
                row["groups"][g] = c  # type: ignore[index]
        if row["groups"]:
            rows.append(row)
    return rows


def style_share(df: pd.DataFrame, groups: list[str], by: str) -> list[dict]:
    rows = []
    for key, scoped in df.dropna(subset=[by]).groupby(by, observed=True):
        entry: dict[str, object] = {"group": str(key), "shares": {}}
        for g in groups:
            sub = scoped[scoped["group"] == g] if g != "ベテラン4人" else scoped[scoped["group"].str.startswith("ベテラン")]
            known = sub.dropna(subset=["style"])
            if len(known) >= MIN_COUNT:
                shares = (known["style"].value_counts(normalize=True) * 100).round(1)
                entry["shares"][g] = {"count": int(len(known)), **{k: float(v) for k, v in shares.items()}}  # type: ignore[index]
        if entry["shares"]:
            rows.append(entry)
    return rows


def main() -> None:
    db_path = os.path.expanduser(os.environ.get("CORE_DB_PATH", ""))
    names = [n for n in os.environ.get("VETERAN_NAMES", "").split(",") if n.strip()]
    if not db_path or not names:
        sys.exit("CORE_DB_PATH と VETERAN_NAMES（カンマ区切り）を設定してください")
    df, matched_columns = load(db_path)
    df, report = assign_groups(df, names)
    aliases = [r["alias"] for r in report]
    groups = [*aliases, "ベテラン4人", "その他の担当者"]
    result = {
        "source": "東北地方の互助会系葬儀社の基幹システム（施行担当者別の匿名集計）",
        "generatedAt": date.today().isoformat(),
        "minCount": MIN_COUNT,
        "period": f"{int(df['year'].min())}〜{int(df['year'].max())}年",
        "items": {k: v["label"] for k, v in {**ITEMS, **TOTALS}.items()},
        "matchedColumnCounts": {k: len(v) for k, v in matched_columns.items()},
        "veterans": report,
        "byStyle": compare(df, groups),
        "styleShareByAge": style_share(df[df["year"] >= 2023], groups, "age_band"),
        "styleShareByDays": style_share(df[df["year"] >= 2023], groups, "days_band"),
        "styleShareByAgeExRouted": style_share(df[(df["year"] >= 2023) & ~df["routed"]], groups, "age_band"),
        "styleShareByDaysExRouted": style_share(df[(df["year"] >= 2023) & ~df["routed"]], groups, "days_band"),
        "routedShare": {g: round(float(df.loc[df["group"] == g, "routed"].mean()) * 100, 1) for g in groups if g != "ベテラン4人"} | {"ベテラン4人": round(float(df.loc[df["group"].str.startswith("ベテラン"), "routed"].mean()) * 100, 1)},
    }
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "core-practice.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (OUT_DIR / "aliases.json").write_text(json.dumps({r["alias"]: n.strip() for r, n in zip(report, names)}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    # 画面には名前を出さない
    for r in report:
        print(f"{r['alias']}：施行 {r['funerals']} 件（{r['years']}）")
    print(f"明細の列の一致数：{result['matchedColumnCounts']}")
    print(f"書き出し：{OUT_DIR / 'core-practice.json'}")


if __name__ == "__main__":
    main()

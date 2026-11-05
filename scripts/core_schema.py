"""基幹システムの SQLite の「形」だけを出す。値（氏名・住所・電話・金額など）は一切出さない。

使い方（リポジトリの外にあるデータベースを読み取り専用で開く）：
    CORE_DB_PATH=/path/to/core.db python3 scripts/core_schema.py

出すもの：テーブル名、行数、列名、型、空欄でない割合（%）、値の種類の数（多い列は「多数」）
"""

from __future__ import annotations

import os
import sqlite3
import sys

MANY = 50


def main() -> None:
    db_path = os.path.expanduser(os.environ.get("CORE_DB_PATH", ""))
    if not db_path:
        sys.exit("CORE_DB_PATH を設定してください")
    con = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    tables = [r[0] for r in con.execute("select name from sqlite_master where type='table' order by name")]
    for table in tables:
        total = con.execute(f'select count(*) from "{table}"').fetchone()[0]
        print(f"\n## {table}（{total} 行）")
        for _, name, col_type, *_ in con.execute(f'pragma table_info("{table}")'):
            if total == 0:
                print(f"- {name} [{col_type}]")
                continue
            filled = con.execute(f'select count(*) from "{table}" where "{name}" is not null and "{name}" != \'\'').fetchone()[0]
            kinds = con.execute(f'select count(*) from (select distinct "{name}" from "{table}" limit {MANY + 1})').fetchone()[0]
            kinds_text = "多数" if kinds > MANY else f"{kinds}種"
            print(f"- {name} [{col_type}] 記入 {round(filled * 100 / total)}%・{kinds_text}")


if __name__ == "__main__":
    main()

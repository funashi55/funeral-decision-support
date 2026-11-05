"use client";
import s from "./sheet.module.css";

/** 印刷の画面を開く。プリンターの代わりに「PDF に保存」を選ぶとファイルになり、FAX の送信に使える */
export function PrintButton() {
  return (
    <button type="button" className={s.print} onClick={() => window.print()}>
      印刷する／PDF に保存する
    </button>
  );
}

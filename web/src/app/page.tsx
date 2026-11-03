import Link from "next/link";

export default function Home() {
  return (
    <main style={{ padding: "3rem", maxWidth: 720, margin: "0 auto", lineHeight: 2 }}>
      <h1 style={{ fontSize: "1.6rem" }}>葬儀の打合せ支援（仮称）</h1>
      <p>遺族が数日のうちに迫られる難しい決定を、ベテランの判断と実データで支えます。人物・会話・金額はすべて架空です。</p>
      <p>
        <Link href="/staff/demo-yamada">担当者の画面（山田家・デモ）を開く →</Link>
      </p>
    </main>
  );
}

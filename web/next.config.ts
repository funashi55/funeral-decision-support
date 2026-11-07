import path from "node:path";
import type { NextConfig } from "next";

const root = path.resolve(__dirname);

const nextConfig: NextConfig = {
  cacheComponents: true,
  // 開発用の表示（左下の N）を出さない。撮影や画面の確認の邪魔になるため
  devIndicators: false,
  partialPrefetching: true,
  // 親フォルダにある別の package-lock.json を拾わないよう、このアプリのフォルダを根にする
  turbopack: { root },
  outputFileTracingRoot: root,
};

export default nextConfig;

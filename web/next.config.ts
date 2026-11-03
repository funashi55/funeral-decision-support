import path from "node:path";
import type { NextConfig } from "next";

const root = path.resolve(__dirname);

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // 親フォルダにある別の package-lock.json を拾わないよう、このアプリのフォルダを根にする
  turbopack: { root },
  outputFileTracingRoot: root,
};

export default nextConfig;

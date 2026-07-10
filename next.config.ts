import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cloud RunのDockerイメージを軽量化するため standalone 出力を使用する
  output: "standalone",
};

export default nextConfig;

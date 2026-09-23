import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // pins the workspace root to this project (a stray package-lock.json
  // further up C:\Users\User otherwise makes Turbopack guess wrong)
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;

import type { NextConfig } from "next"
import path from "node:path";

const nextConfig: NextConfig = {
    output: "standalone",
    transpilePackages: ["@workspace/ui"],
    outputFileTracingRoot: path.join(import.meta.dirname, "../..")
}

export default nextConfig

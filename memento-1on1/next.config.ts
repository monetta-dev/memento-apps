import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
  experimental: {
    optimizePackageImports: ['antd', '@ant-design/icons', '@xyflow/react', 'lodash', 'date-fns'],
  },
};

export default nextConfig;

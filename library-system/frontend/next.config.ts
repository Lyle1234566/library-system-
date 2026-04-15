import path from "path";
import type { NextConfig } from "next";

const frontendRoot = __dirname;
const tailwindPackagePath = path.join(frontendRoot, "node_modules", "tailwindcss");
type MediaRemotePattern = NonNullable<NonNullable<NextConfig["images"]>["remotePatterns"]>[number];

const buildRemotePattern = (value: string): MediaRemotePattern | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.includes("://")) {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return {
      protocol: parsed.protocol.slice(0, -1) as "http" | "https",
      hostname: parsed.hostname,
      ...(parsed.port ? { port: parsed.port } : {}),
    };
  }

  if (trimmed.includes("*")) {
    return {
      protocol: "https",
      hostname: trimmed,
    };
  }

  const [hostname, port] = trimmed.split(":", 2);
  return {
    protocol: hostname === "localhost" ? "http" : "https",
    hostname,
    ...(port ? { port } : {}),
  };
};

const collectMediaRemotePatterns = (): MediaRemotePattern[] => {
  const candidates = [
    "https://*.railway.app",
    "http://localhost",
    process.env.NEXT_PUBLIC_API_URL ?? "",
    ...(process.env.NEXT_PUBLIC_MEDIA_HOSTS ?? "").split(","),
  ];
  const seen = new Set<string>();
  const patterns: MediaRemotePattern[] = [];

  for (const candidate of candidates) {
    const pattern = buildRemotePattern(candidate);
    if (!pattern) {
      continue;
    }
    const key = `${pattern.protocol}:${pattern.hostname}:${pattern.port ?? ""}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    patterns.push(pattern);
  }

  return patterns;
};

const nextConfig: NextConfig = {
  images: {
    remotePatterns: collectMediaRemotePatterns(),
  },
  turbopack: {
    root: frontendRoot,
    resolveAlias: {
      tailwindcss: tailwindPackagePath,
    },
  },
  webpack: (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      tailwindcss: tailwindPackagePath,
    };
    return config;
  },
};

export default nextConfig;

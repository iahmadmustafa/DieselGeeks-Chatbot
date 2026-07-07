import { getAllowedOrigins } from "@/lib/env/read-env";

export function buildCorsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get("Origin");
  const allowedOrigins = getAllowedOrigins();

  if (!origin || !allowedOrigins.includes(origin)) {
    return {};
  }

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

export function isOriginAllowed(request: Request): boolean {
  const origin = request.headers.get("Origin");
  if (!origin) {
    return true;
  }

  return getAllowedOrigins().includes(origin);
}

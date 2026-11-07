import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Moota must be able to call the webhook without dashboard Basic Auth.
  if (pathname.startsWith("/api/webhooks/moota")) return NextResponse.next();
  if (pathname.startsWith("/_next/") || pathname === "/favicon.ico") return NextResponse.next();

  const user = process.env.LAB_DASHBOARD_USER;
  const password = process.env.LAB_DASHBOARD_PASSWORD;

  // Local development may run without a password. Production must be protected.
  if (process.env.NODE_ENV !== "production" && !user && !password) return NextResponse.next();
  if (!user || !password) {
    return new NextResponse("Dashboard protection is not configured.", { status: 503 });
  }

  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Basic ")) {
    const encoded = authorization.slice(6);
    try {
      const decoded = atob(encoded);
      const separator = decoded.indexOf(":");
      const suppliedUser = separator >= 0 ? decoded.slice(0, separator) : "";
      const suppliedPassword = separator >= 0 ? decoded.slice(separator + 1) : "";
      if (suppliedUser === user && suppliedPassword === password) return NextResponse.next();
    } catch {
      // Invalid base64 credentials fall through to the challenge response.
    }
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Moota Testing Lab", charset="UTF-8"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};

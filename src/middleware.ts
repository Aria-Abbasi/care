import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "super-secret-care-key-change-in-production-2026"
);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public paths
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth/login") ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/uploads") ||
    pathname.includes("favicon") ||
    pathname.includes("icon") ||
    pathname.includes("manifest")
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get("care_token")?.value;

  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  try {
    const { payload } = await jwtVerify(JWT_SECRET, token);
    const role = payload.role as string;

    // Root path redirects to appropriate role home
    if (pathname === "/") {
      if (role === "ADMIN") {
        return NextResponse.redirect(new URL("/admin/dashboard", request.url));
      } else {
        return NextResponse.redirect(new URL("/nurse/timeline", request.url));
      }
    }

    // Protect admin routes
    if (pathname.startsWith("/admin") && role !== "ADMIN") {
      return NextResponse.redirect(new URL("/nurse/timeline", request.url));
    }

    // Set user headers for downstream server components
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-user-id", payload.id as string);
    requestHeaders.set("x-user-role", role);
    requestHeaders.set("x-user-name", encodeURIComponent(payload.fullName as string));

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  } catch {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};

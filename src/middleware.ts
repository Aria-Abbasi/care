import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "prod-super-secret-care-key-2026-yazdani"
);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Static assets, public resources, sw.js, and health check
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/uploads") ||
    pathname.startsWith("/api/health") ||
    pathname === "/sw.js" ||
    pathname.includes("favicon") ||
    pathname.includes("icon") ||
    pathname.includes("manifest")
  ) {
    return NextResponse.next();
  }

  // Allow login API route without authentication
  if (pathname.startsWith("/api/auth/login")) {
    return NextResponse.next();
  }

  const token = request.cookies.get("care_token")?.value;

  // If user is accessing /login while already authenticated, redirect to their role home
  if (pathname.startsWith("/login")) {
    if (token) {
      try {
        const { payload } = await jwtVerify(token, JWT_SECRET);
        const role = payload.role as string;
        const from = request.nextUrl.searchParams.get("from");

        // If a redirect destination was passed and user has access
        if (from && from.startsWith("/") && !from.startsWith("//") && !from.startsWith("/login")) {
          return NextResponse.redirect(new URL(from, request.url));
        }

        // Default home redirect by role
        if (role === "ADMIN") {
          return NextResponse.redirect(new URL("/dashboard", request.url));
        } else {
          return NextResponse.redirect(new URL("/nurse/timeline", request.url));
        }
      } catch {
        // Invalid or expired token, proceed to login page
        return NextResponse.next();
      }
    }
    return NextResponse.next();
  }

  // Redirect legacy /admin/* routes to flat /* routes
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    const target = pathname.replace(/^\/admin/, "") || "/dashboard";
    return NextResponse.redirect(new URL(target, request.url));
  }

  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const role = payload.role as string;

    // Root path redirects to appropriate role home
    if (pathname === "/") {
      if (role === "ADMIN") {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      } else {
        return NextResponse.redirect(new URL("/nurse/timeline", request.url));
      }
    }

    // Protect users management route (ADMIN only)
    if (pathname.startsWith("/users") && role !== "ADMIN") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
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
    "/((?!_next/static|_next/image|favicon.ico|sw.js).*)",
  ],
};

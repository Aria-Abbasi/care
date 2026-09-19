import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "super-secret-care-key-change-in-production-2026"
);

export interface AuthUser {
  id: string;
  username: string;
  fullName: string;
  role: "ADMIN" | "NURSE";
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function signToken(user: AuthUser): Promise<string> {
  return new SignJWT({
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<AuthUser | null> {
  try {
    const { payload } = await jwtVerify(JWT_SECRET, token);
    return {
      id: payload.id as string,
      username: payload.username as string,
      fullName: payload.fullName as string,
      role: payload.role as "ADMIN" | "NURSE",
    };
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("care_token")?.value;
    if (!token) return null;
    return verifyToken(token);
  } catch {
    return null;
  }
}

export async function getUserFromRequest(request: NextRequest): Promise<AuthUser | null> {
  const token =
    request.cookies.get("care_token")?.value ||
    request.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return null;
  return verifyToken(token);
}

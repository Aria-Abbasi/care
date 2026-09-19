import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    app: "care-web",
    timestamp: new Date().toISOString(),
  });
}

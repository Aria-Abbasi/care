import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const vitals = await prisma.vitalLog.findMany({
      take: 20,
      orderBy: { recordedAt: "desc" },
      include: {
        nurse: { select: { fullName: true } },
      },
    });

    const tasks = await prisma.taskLog.findMany({
      take: 15,
      orderBy: { completedAt: "desc" },
      include: {
        nurse: { select: { fullName: true } },
      },
    });

    const notes = await prisma.clinicalNote.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: {
        nurse: { select: { fullName: true } },
      },
    });

    return NextResponse.json({ vitals, tasks, notes });
  } catch (error) {
    console.error("Recent logs error:", error);
    return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 });
  }
}

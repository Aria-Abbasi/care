import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Today range (UTC)
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    // Fetch active schedules
    const schedules = await prisma.schedule.findMany({
      where: { isActive: true },
      include: {
        medication: {
          select: {
            boxNumber: true,
            instructions: true,
            timeConstraints: true,
            stockCount: true,
          },
        },
      },
      orderBy: { targetTime: "asc" },
    });

    // Fetch today's task logs
    const taskLogs = await prisma.taskLog.findMany({
      where: {
        completedAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: {
        nurse: {
          select: { fullName: true },
        },
      },
      orderBy: { completedAt: "asc" },
    });

    // Map schedule with completion status
    const mappedSchedules = schedules.map((s) => {
      const log = taskLogs.find((tl) => tl.scheduleId === s.id);
      return {
        id: s.id,
        title: s.title,
        targetTime: s.targetTime,
        category: s.category,
        itemType: s.itemType,
        mealRelation: s.mealRelation,
        medication: s.medication,
        isCompleted: !!log,
        completedAt: log?.completedAt || null,
        completedBy: log?.nurse?.fullName || null,
        status: log?.status || "PENDING",
      };
    });

    // Fetch today's summary metrics
    const todayVitals = await prisma.vitalLog.findMany({
      where: {
        recordedAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      select: {
        type: true,
        valueNum: true,
        recordedAt: true,
      },
    });

    const waterToday = todayVitals
      .filter((v) => v.type === "water_intake" && v.valueNum)
      .reduce((sum, v) => sum + (v.valueNum || 0), 0);

    const urineToday = todayVitals
      .filter((v) => v.type === "urine_output" && v.valueNum)
      .reduce((sum, v) => sum + (v.valueNum || 0), 0);

    const lastSugar = await prisma.vitalLog.findFirst({
      where: { type: "blood_sugar", valueNum: { not: null } },
      orderBy: { recordedAt: "desc" },
      select: { valueNum: true, recordedAt: true, mealTag: true },
    });

    const lastBowel = await prisma.vitalLog.findFirst({
      where: { type: "bowel_movement" },
      orderBy: { recordedAt: "desc" },
      select: { recordedAt: true, bowelGrade: true, laxativeGiven: true },
    });

    return NextResponse.json({
      schedules: mappedSchedules,
      stats: {
        waterToday,
        urineToday,
        lastSugar,
        lastBowel,
      },
    });
  } catch (error) {
    console.error("Timeline error:", error);
    return NextResponse.json({ error: "Failed to load timeline" }, { status: 500 });
  }
}

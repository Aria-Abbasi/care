import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { getTehranTodayStart, getTehranTodayEnd } from "@/lib/jalali";

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const startOfDay = getTehranTodayStart();
    const endOfDay = getTehranTodayEnd();

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

    // Fetch today's task logs (both scheduled and ad-hoc)
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

    // Map scheduled items
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

    // Ad-hoc tasks logged today (tasks registered via ad-hoc quick action)
    const adhocTasks = taskLogs
      .filter((tl) => tl.taskTitle.startsWith("[موردی]"))
      .map((tl) => ({
        id: tl.id,
        title: tl.taskTitle.replace("[موردی] ", ""),
        completedAt: tl.completedAt,
        completedBy: tl.nurse?.fullName || "پرستار",
        status: tl.status,
        notes: tl.notes,
      }));

    // Today's summary vitals metrics
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
      where: { type: "blood_sugar", valueNum: { not: null }, recordedAt: { lte: new Date() } },
      orderBy: { recordedAt: "desc" },
      select: { valueNum: true, recordedAt: true, mealTag: true },
    });

    const lastBowel = await prisma.vitalLog.findFirst({
      where: { type: "bowel_movement", recordedAt: { lte: new Date() } },
      orderBy: { recordedAt: "desc" },
      select: { recordedAt: true, bowelGrade: true, laxativeGiven: true },
    });

    return NextResponse.json({
      schedules: mappedSchedules,
      adhocTasks,
      stats: {
        waterToday: Math.round(waterToday),
        urineToday: Math.round(urineToday),
        lastSugar,
        lastBowel,
      },
    });
  } catch (error) {
    console.error("Timeline error:", error);
    return NextResponse.json({ error: "Failed to load timeline" }, { status: 500 });
  }
}

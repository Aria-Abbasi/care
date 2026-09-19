import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { getTehranTodayStart, getTehranTodayEnd, tehranMoment } from "@/lib/jalali";

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

    // Compute today's scheduled occurrences based on interval and date range
    const mappedSchedules: any[] = [];
    const usedLogIds = new Set<string>();

    for (const s of schedules) {
      // 1. Check end date
      if (s.endDate && new Date(s.endDate).getTime() < startOfDay.getTime()) {
        continue; // Expired
      }

      // 2. Check start date
      const scheduleStart = s.startDate ? new Date(s.startDate) : startOfDay;
      if (scheduleStart.getTime() > endOfDay.getTime()) {
        continue; // Future task, hasn't started yet
      }

      const unit = s.intervalUnit || "DAYS";
      const val = s.intervalValue || 1;
      const targetTime = s.targetTime || "08:00";

      let occurrencesToday: string[] = [];

      if (unit === "ONCE") {
        if (scheduleStart.getTime() >= startOfDay.getTime() && scheduleStart.getTime() <= endOfDay.getTime()) {
          occurrencesToday.push(targetTime);
        }
      } else if (unit === "HOURS") {
        // Sub-daily intervals (e.g. every 4, 6, 8, 12 hours)
        const [baseH, baseM] = targetTime.split(":").map(Number);
        const intervalHours = Math.max(1, val);
        let currH = (baseH || 0) % intervalHours;
        while (currH < 24) {
          occurrencesToday.push(`${String(currH).padStart(2, "0")}:${String(baseM || 0).padStart(2, "0")}`);
          currH += intervalHours;
        }
      } else if (unit === "DAYS") {
        if (val === 1) {
          occurrencesToday.push(targetTime);
        } else {
          const startDayEpoch = tehranMoment(scheduleStart).startOf("day").valueOf();
          const todayEpoch = startOfDay.getTime();
          const diffDays = Math.round((todayEpoch - startDayEpoch) / 86400000);
          if (diffDays >= 0 && diffDays % val === 0) {
            occurrencesToday.push(targetTime);
          }
        }
      } else if (unit === "WEEKS") {
        const startDayEpoch = tehranMoment(scheduleStart).startOf("day").valueOf();
        const todayEpoch = startOfDay.getTime();
        const diffDays = Math.round((todayEpoch - startDayEpoch) / 86400000);
        if (diffDays >= 0 && diffDays % 7 === 0 && Math.floor(diffDays / 7) % val === 0) {
          occurrencesToday.push(targetTime);
        }
      } else {
        occurrencesToday.push(targetTime);
      }

      // Add each occurrence and match against taskLogs
      for (const timeStr of occurrencesToday) {
        const scheduleLogs = taskLogs.filter((tl) => tl.scheduleId === s.id && !usedLogIds.has(tl.id));
        let matchedLog: any = null;
        if (scheduleLogs.length > 0) {
          matchedLog = scheduleLogs[0];
          usedLogIds.add(matchedLog.id);
        }

        mappedSchedules.push({
          id: occurrencesToday.length > 1 ? `${s.id}_${timeStr.replace(":", "")}` : s.id,
          scheduleId: s.id,
          title: s.title,
          targetTime: timeStr,
          category: s.category,
          itemType: s.itemType,
          mealRelation: s.mealRelation,
          medication: s.medication,
          requiresNote: s.requiresNote || false,
          vitalType: s.vitalType || null,
          isCompleted: !!matchedLog,
          completedAt: matchedLog?.completedAt || null,
          completedBy: matchedLog?.nurse?.fullName || null,
          status: matchedLog?.status || "PENDING",
          notes: matchedLog?.notes || null,
        });
      }
    }

    // Sort all occurrences chronologically
    mappedSchedules.sort((a, b) => a.targetTime.localeCompare(b.targetTime));

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

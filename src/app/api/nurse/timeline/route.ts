import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { getTehranTodayStart, getTehranTodayEnd, tehranMoment, isScheduleActiveOnDay } from "@/lib/jalali";

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

    // Fetch meal reference slots for dynamic meal-relative timings
    const mealSlots = await prisma.mealTimeSlot.findMany({
      where: { isActive: true },
    });
    const mealSlotsMap = new Map<string, string>();
    mealSlots.forEach((slot) => mealSlotsMap.set(slot.name, slot.defaultTime));
    const defaultMealTimes: Record<string, string> = {
      BREAKFAST: "07:00",
      MORNING_SNACK: "10:00",
      LUNCH: "12:30",
      AFTERNOON_SNACK: "16:00",
      DINNER: "19:00",
      BEDTIME: "20:00",
    };

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
      // 0. Check days of week
      if (!isScheduleActiveOnDay(s.daysOfWeek)) {
        continue; // Not active today
      }

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
      let targetTime = s.targetTime || "08:00";
      let mealRelativeLabel: string | null = null;

      // Handle meal-relative scheduling from rulesJson
      if (s.rulesJson) {
        try {
          const rules = JSON.parse(s.rulesJson);
          if (rules.timingMode === "MEAL_RELATIVE" && rules.mealSlot) {
            const baseTime = mealSlotsMap.get(rules.mealSlot) || defaultMealTimes[rules.mealSlot] || "12:30";
            const [bH, bM] = baseTime.split(":").map(Number);
            const offset = Number(rules.offsetMinutes) || 0;
            let totalM = (bH * 60 + (bM || 0));
            if (rules.relation === "AFTER") {
              totalM += offset;
            } else if (rules.relation === "BEFORE") {
              totalM -= offset;
            }
            totalM = ((totalM % 1440) + 1440) % 1440;
            const finalH = Math.floor(totalM / 60);
            const finalM = totalM % 60;
            targetTime = `${String(finalH).padStart(2, "0")}:${String(finalM).padStart(2, "0")}`;
            if (rules.label) {
              mealRelativeLabel = rules.label;
            } else {
              const slotObj = mealSlots.find((ms) => ms.name === rules.mealSlot);
              const slotLabel = slotObj?.labelFa || rules.mealSlot;
              if (rules.relation === "WITH") {
                mealRelativeLabel = `همراه با ${slotLabel}`;
              } else {
                const prefix = rules.relation === "BEFORE" ? "قبل از" : "بعد از";
                const h = Math.floor(offset / 60);
                const m = offset % 60;
                let dur = "";
                if (h > 0 && m > 0) dur = `${h} ساعت و ${m} دقیقه`;
                else if (h > 0) dur = `${h} ساعت`;
                else if (m > 0) dur = `${m} دقیقه`;
                mealRelativeLabel = dur ? `${dur} ${prefix} ${slotLabel}` : `${prefix} ${slotLabel}`;
              }
            }
          }
        } catch {
          // ignore parsing error
        }
      }

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

      // Filter occurrences today by exact startDate and endDate timestamp
      const validOccurrences = occurrencesToday.filter((timeStr) => {
        const [occH, occM] = timeStr.split(":").map(Number);
        const occurrenceDate = tehranMoment().hour(occH || 0).minute(occM || 0).second(0).millisecond(0).toDate();
        if (s.startDate && occurrenceDate.getTime() < new Date(s.startDate).getTime()) {
          return false;
        }
        if (s.endDate && occurrenceDate.getTime() > new Date(s.endDate).getTime()) {
          return false;
        }
        return true;
      });

      // Add each occurrence and match against taskLogs
      for (const timeStr of validOccurrences) {
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
          rulesJson: s.rulesJson || null,
          mealRelativeLabel: mealRelativeLabel || null,
          isCompleted: !!matchedLog,
          completedAt: matchedLog?.completedAt || null,
          completedBy: matchedLog?.nurse?.fullName || null,
          status: matchedLog?.status || "PENDING",
          notes: matchedLog?.notes || null,
          taskLogId: matchedLog?.id || null,
        });
      }
    }

    // Include unscheduled and bedside quick-action completed logs in mappedSchedules
    const unusedLogs = taskLogs.filter((tl) => !usedLogIds.has(tl.id));
    for (const tl of unusedLogs) {
      const d = new Date(tl.completedAt);
      const timeParts = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Tehran",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).formatToParts(d);
      const h = timeParts.find((p) => p.type === "hour")?.value || "00";
      const m = timeParts.find((p) => p.type === "minute")?.value || "00";
      const timeStr = `${h}:${m}`;

      mappedSchedules.push({
        id: `adhoc_${tl.id}`,
        scheduleId: tl.scheduleId || null,
        title: tl.taskTitle.replace("[موردی] ", ""),
        targetTime: timeStr,
        category: "vital",
        itemType: "routine_task",
        isCompleted: true,
        completedAt: tl.completedAt.toISOString(),
        completedBy: tl.nurse?.fullName || "پرستار",
        status: tl.status || "DONE",
        notes: tl.notes || null,
        taskLogId: tl.id,
      });
    }

    // Sort all occurrences chronologically
    mappedSchedules.sort((a, b) => a.targetTime.localeCompare(b.targetTime));

    // Ad-hoc tasks logged today (tasks registered via ad-hoc quick action)
    const adhocTasks = taskLogs
      .filter((tl) => tl.taskTitle.startsWith("[موردی]") || !tl.scheduleId)
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

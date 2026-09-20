import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { getTehranTodayStart, formatJalaliDate, formatJalaliTime, toPersianDigits, TEHRAN_TZ, tehranMoment } from "@/lib/jalali";

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const range = searchParams.get("range") || "7d"; // today, 7d, 30d, all

    const now = new Date();
    let startDate: Date;

    if (range === "today") {
      startDate = getTehranTodayStart();
    } else if (range === "7d") {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (range === "30d") {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else {
      // all time
      startDate = new Date("2020-01-01T00:00:00Z");
    }

    // 1. KPI: Last Bowel Movement & Hours Elapsed
    const lastBowel = await prisma.vitalLog.findFirst({
      where: {
        type: "bowel_movement",
        recordedAt: { lte: now },
      },
      orderBy: { recordedAt: "desc" },
      select: { recordedAt: true, bowelGrade: true, laxativeGiven: true, valueText: true },
    });

    let hoursSinceLastBowel = 0;
    if (lastBowel) {
      hoursSinceLastBowel = Math.max(
        0,
        Math.round((now.getTime() - new Date(lastBowel.recordedAt).getTime()) / (1000 * 60 * 60))
      );
    }

    // 2. Vitals in selected timeframe
    const vitals = await prisma.vitalLog.findMany({
      where: {
        recordedAt: {
          gte: startDate,
          lte: now,
        },
      },
      orderBy: { recordedAt: "asc" },
    });

    // 3. Fluid Balance Chart
    let fluidBalanceChart: Array<{ date: string; jalaliDate: string; intake: number; output: number }> = [];

    if (range === "today") {
      // Group by 2-hour intervals for today
      const hourlyMap: { [slot: string]: { date: string; jalaliDate: string; intake: number; output: number } } = {};
      const slots = ["06:00", "08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00", "22:00"];
      slots.forEach((s) => {
        hourlyMap[s] = { date: s, jalaliDate: toPersianDigits(s), intake: 0, output: 0 };
      });

      vitals.forEach((v) => {
        const timeStr = tehranMoment(v.recordedAt).format("HH:mm");
        const hour = parseInt(timeStr.slice(0, 2), 10);
        let nearestSlot = "06:00";
        if (hour >= 21) nearestSlot = "22:00";
        else if (hour >= 19) nearestSlot = "20:00";
        else if (hour >= 17) nearestSlot = "18:00";
        else if (hour >= 15) nearestSlot = "16:00";
        else if (hour >= 13) nearestSlot = "14:00";
        else if (hour >= 11) nearestSlot = "12:00";
        else if (hour >= 9) nearestSlot = "10:00";
        else if (hour >= 7) nearestSlot = "08:00";

        if (v.type === "water_intake" && v.valueNum) {
          hourlyMap[nearestSlot].intake += Math.round(v.valueNum);
        } else if (v.type === "urine_output" && v.valueNum) {
          hourlyMap[nearestSlot].output += Math.round(v.valueNum);
        }
      });
      fluidBalanceChart = Object.values(hourlyMap);
    } else {
      // Group by day for 7d, 30d, all
      const dayMap: { [day: string]: { date: string; jalaliDate: string; intake: number; output: number } } = {};
      vitals.forEach((v) => {
        const dayKey = tehranMoment(v.recordedAt).format("YYYY-MM-DD");
        if (!dayMap[dayKey]) {
          const jDate = tehranMoment(v.recordedAt).locale("fa").format("jMM/jDD");
          dayMap[dayKey] = { date: dayKey, jalaliDate: toPersianDigits(jDate), intake: 0, output: 0 };
        }
        if (v.type === "water_intake" && v.valueNum) {
          dayMap[dayKey].intake += Math.round(v.valueNum);
        } else if (v.type === "urine_output" && v.valueNum) {
          dayMap[dayKey].output += Math.round(v.valueNum);
        }
      });
      fluidBalanceChart = Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date));
      if (range === "all" && fluidBalanceChart.length > 30) {
        // Take latest 30 points for readability
        fluidBalanceChart = fluidBalanceChart.slice(-30);
      }
    }

    // 4. Blood Glucose Series in timeframe
    const glucoseLogs = vitals.filter((v) => v.type === "blood_sugar" && v.valueNum);
    const glucoseChart = glucoseLogs.map((g) => ({
      id: g.id,
      date: g.recordedAt.toISOString(),
      jalaliTime: toPersianDigits(tehranMoment(g.recordedAt).locale("fa").format(range === "today" ? "HH:mm" : "jMM/jDD HH:mm")),
      value: g.valueNum,
      mealTag: g.mealTag || "random",
      isSpike: (g.valueNum || 0) > 180,
      isHypo: (g.valueNum || 0) < 70,
    }));

    const glucoseAvg = glucoseLogs.length > 0
      ? Math.round(glucoseLogs.reduce((s, g) => s + (g.valueNum || 0), 0) / glucoseLogs.length)
      : 0;
    const glucoseSpikesCount = glucoseLogs.filter((g) => (g.valueNum || 0) > 180).length;
    const glucoseHypoCount = glucoseLogs.filter((g) => (g.valueNum || 0) < 70).length;

    // 5. DVT & Leg Elevation Stats in timeframe
    const dvtLogs = vitals.filter((v) => v.type === "dvt_timer" && v.valueNum);
    const dvtByDay: { [day: string]: { jalaliDate: string; totalMinutes: number } } = {};
    dvtLogs.forEach((d) => {
      const dayKey = tehranMoment(d.recordedAt).format("YYYY-MM-DD");
      const mins = Math.round((d.valueNum || 0) / 60);
      if (!dvtByDay[dayKey]) {
        dvtByDay[dayKey] = {
          jalaliDate: toPersianDigits(tehranMoment(d.recordedAt).locale("fa").format("jMM/jDD")),
          totalMinutes: 0,
        };
      }
      dvtByDay[dayKey].totalMinutes += mins;
    });
    const dvtChart = Object.values(dvtByDay).slice(-14);

    // DVT Circumference measurements
    const dvtMeasurements = vitals
      .filter((v) => v.type === "dvt_measurement" && v.valueNum)
      .map((m) => ({
        date: m.recordedAt.toISOString(),
        jalaliDate: formatJalaliDate(m.recordedAt),
        value: m.valueNum,
        desc: m.valueText,
      }));

    // 6. Comparative Clinical Photos
    const clinicalPhotos = await prisma.clinicalNote.findMany({
      where: {
        photoUrl: { not: null },
        createdAt: { lte: now },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        category: true,
        noteText: true,
        photoUrl: true,
        createdAt: true,
      },
    });

    // 7. Laxative timeline & bowel reactions
    const bowelTimeline = vitals
      .filter((v) => v.type === "bowel_movement" || v.type === "laxative")
      .slice(-15)
      .map((b) => ({
        id: b.id,
        type: b.type,
        date: b.recordedAt.toISOString(),
        jalaliDateTime: formatJalaliTime(b.recordedAt),
        text: b.valueText,
        grade: b.bowelGrade,
        laxative: b.laxativeGiven,
      }));

    // 8. Period Totals
    const totalIntake = vitals
      .filter((v) => v.type === "water_intake" && v.valueNum)
      .reduce((sum, v) => sum + (v.valueNum || 0), 0);

    const totalOutput = vitals
      .filter((v) => v.type === "urine_output" && v.valueNum)
      .reduce((sum, v) => sum + (v.valueNum || 0), 0);

    const retentionRisk = totalIntake > 1000 && totalOutput < totalIntake * 0.45;

    return NextResponse.json({
      range,
      kpi: {
        hoursSinceLastBowel,
        lastBowelDate: lastBowel?.recordedAt,
        lastBowelGrade: lastBowel?.bowelGrade,
        bowelAlert: hoursSinceLastBowel > 36,
        todayIntake: Math.round(totalIntake),
        todayOutput: Math.round(totalOutput),
        retentionRisk,
        glucoseAvg,
        glucoseSpikesCount,
        glucoseHypoCount,
        totalDvtMinutes: dvtLogs.reduce((s, d) => s + Math.round((d.valueNum || 0) / 60), 0),
      },
      fluidBalanceChart,
      glucoseChart,
      dvtChart,
      dvtMeasurements,
      bowelTimeline,
      clinicalPhotos,
    });
  } catch (error) {
    console.error("Analytics API error:", error);
    return NextResponse.json({ error: "Failed to load analytics" }, { status: 500 });
  }
}

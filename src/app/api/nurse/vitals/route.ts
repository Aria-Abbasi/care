import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      type,
      valueNum,
      valueText,
      systolic,
      diastolic,
      mealTag,
      bowelGrade,
      laxativeGiven,
      extraData,
    } = body;

    if (!type) {
      return NextResponse.json({ error: "نوع ثبت الزامی است" }, { status: 400 });
    }

    const vital = await prisma.vitalLog.create({
      data: {
        nurseId: user.id,
        recordedAt: new Date(),
        type,
        valueNum: valueNum !== undefined && valueNum !== null ? Number(valueNum) : null,
        valueText: valueText || null,
        systolic: systolic ? Number(systolic) : null,
        diastolic: diastolic ? Number(diastolic) : null,
        mealTag: mealTag || null,
        bowelGrade: bowelGrade || null,
        laxativeGiven: laxativeGiven || null,
        extraData: extraData ? JSON.stringify(extraData) : null,
      },
    });

    let taskLog = null;
    const cleanScheduleId = body.scheduleId ? String(body.scheduleId).split("_")[0] : null;
    let valueSummary = "";
    if (type === "blood_sugar") valueSummary = `قند خون: ${valueNum} mg/dL${mealTag ? ` (${mealTag})` : ""}`;
    else if (type === "blood_pressure") valueSummary = `فشار خون: ${systolic}/${diastolic} mmHg`;
    else if (type === "water_intake") valueSummary = `مصرف مایعات: ${valueNum} cc`;
    else if (type === "urine_output") valueSummary = `تخلیه ادرار: ${valueNum} cc${valueText ? ` (${valueText})` : ""}`;
    else if (type === "dvt_timer") {
      const totalSec = Math.round(Number(valueNum) || 0);
      const minutes = Math.floor(totalSec / 60);
      const seconds = totalSec % 60;
      const durationStr = minutes > 0 ? `${minutes} دقیقه` : `${seconds} ثانیه`;
      valueSummary = `مراقبت DVT: ${durationStr} بالا بردن پا`;
    }
    else if (type === "bowel_movement") valueSummary = `کارکرد روده: ${bowelGrade || "طبیعی"}${laxativeGiven ? ` (ملین: ${laxativeGiven})` : ""}`;

    const defaultTitles: Record<string, string> = {
      blood_sugar: "ثبت قند خون",
      blood_pressure: "ثبت فشار خون",
      water_intake: "مصرف آب و مایعات",
      urine_output: "تخلیه ادرار",
      dvt_timer: "مراقبت DVT و بالا بردن پا",
      bowel_movement: "کارکرد روده و ملین",
    };
    const finalTaskTitle = body.taskTitle || defaultTitles[type] || "ثبت بالینی پای تخت";

    taskLog = await prisma.taskLog.create({
      data: {
        scheduleId: cleanScheduleId,
        taskTitle: finalTaskTitle,
        nurseId: user.id,
        status: "DONE",
        notes: valueSummary || valueText || null,
        completedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, vital, taskLog });
  } catch (error) {
    console.error("Vital log error:", error);
    return NextResponse.json({ error: "Failed to log vitals" }, { status: 500 });
  }
}

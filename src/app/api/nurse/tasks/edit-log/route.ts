import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";

export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { taskLogId, scheduleId, notes, valueNum, systolic, diastolic, valueText } = await request.json();

    if (!taskLogId && !scheduleId) {
      return NextResponse.json({ error: "شناسه لاگ یا تسک الزامی است" }, { status: 400 });
    }

    let taskLog = null;
    if (taskLogId) {
      taskLog = await prisma.taskLog.findUnique({
        where: { id: taskLogId },
        include: { schedule: true },
      });
    } else if (scheduleId) {
      const cleanScheduleId = String(scheduleId).split("_")[0];
      taskLog = await prisma.taskLog.findFirst({
        where: { scheduleId: cleanScheduleId },
        orderBy: { completedAt: "desc" },
        include: { schedule: true },
      });
    }

    if (!taskLog) {
      return NextResponse.json({ error: "لاگ مورد نظر یافت نشد" }, { status: 404 });
    }

    // Helper: clean out any automated system prefixes from user's manual note
    function cleanUserNote(rawNote: string | null | undefined): string {
      if (!rawNote) return "";
      let cleaned = rawNote.trim();
      const prefixRegex = /^(?:مصرف مایعات|تخلیه ادرار|قند خون|فشار خون|مراقبت DVT|کارکرد روده|مصرف ملین)[^:]*:\s*[^-]+(?:-\s*)?/i;
      while (prefixRegex.test(cleaned)) {
        cleaned = cleaned.replace(prefixRegex, "").trim();
      }
      return cleaned;
    }

    // Determine vital type if applicable
    let detectedVitalType: string | null = taskLog.schedule?.vitalType || null;
    const taskTitle = taskLog.taskTitle || "";
    if (!detectedVitalType) {
      if (taskTitle.includes("قند خون") || taskTitle.includes("blood_sugar")) detectedVitalType = "blood_sugar";
      else if (taskTitle.includes("فشار خون") || taskTitle.includes("blood_pressure")) detectedVitalType = "blood_pressure";
      else if (taskTitle.includes("مصرف مایعات") || taskTitle.includes("آب") || taskTitle.includes("water_intake")) detectedVitalType = "water_intake";
      else if (taskTitle.includes("تخلیه ادرار") || taskTitle.includes("ادرار") || taskTitle.includes("urine_output")) detectedVitalType = "urine_output";
      else if (taskTitle.includes("DVT") || taskTitle.includes("بالا بردن پا") || taskTitle.includes("dvt_timer")) detectedVitalType = "dvt_timer";
      else if (taskTitle.includes("کارکرد روده") || taskTitle.includes("اجابت مزاج")) detectedVitalType = "bowel_movement";
      else if (taskTitle.includes("ملین")) detectedVitalType = "laxative";
    }

    // 1. Locate the exact related VitalLog
    let relatedVital: any = null;

    // A) Search by exact taskLogId stored in extraData
    relatedVital = await prisma.vitalLog.findFirst({
      where: {
        extraData: { contains: taskLog.id },
      },
    });

    // B) Fallback: match by detectedVitalType within 15 minutes
    if (!relatedVital && detectedVitalType) {
      const logTime = new Date(taskLog.completedAt).getTime();
      const minTime = new Date(logTime - 15 * 60 * 1000);
      const maxTime = new Date(logTime + 15 * 60 * 1000);

      relatedVital = await prisma.vitalLog.findFirst({
        where: {
          nurseId: taskLog.nurseId,
          type: detectedVitalType,
          recordedAt: { gte: minTime, lte: maxTime },
        },
        orderBy: { recordedAt: "desc" },
      });
    }

    // C) Fallback: search by detectedVitalType on the same calendar day, closest in time
    if (!relatedVital && detectedVitalType) {
      const startOfDay = new Date(taskLog.completedAt);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(taskLog.completedAt);
      endOfDay.setHours(23, 59, 59, 999);

      const candidateVitals = await prisma.vitalLog.findMany({
        where: {
          type: detectedVitalType,
          recordedAt: { gte: startOfDay, lte: endOfDay },
        },
      });

      if (candidateVitals.length > 0) {
        const logTime = new Date(taskLog.completedAt).getTime();
        candidateVitals.sort(
          (a, b) => Math.abs(a.recordedAt.getTime() - logTime) - Math.abs(b.recordedAt.getTime() - logTime)
        );
        relatedVital = candidateVitals[0];
      }
    }

    const userCleanNote = cleanUserNote(notes);
    let updatedSummary = userCleanNote || notes || null;

    if (relatedVital) {
      const updateData: any = {};
      if (valueNum !== undefined && valueNum !== null && !isNaN(Number(valueNum))) {
        updateData.valueNum = Number(valueNum);
      }
      if (valueText !== undefined) updateData.valueText = valueText;
      if (systolic !== undefined && systolic !== null && !isNaN(Number(systolic))) {
        updateData.systolic = Number(systolic);
      }
      if (diastolic !== undefined && diastolic !== null && !isNaN(Number(diastolic))) {
        updateData.diastolic = Number(diastolic);
      }

      await prisma.vitalLog.update({
        where: { id: relatedVital.id },
        data: updateData,
      });

      // Update formatted note summary for task card display
      const finalNum = updateData.valueNum ?? relatedVital.valueNum;
      const finalSys = updateData.systolic ?? relatedVital.systolic;
      const finalDia = updateData.diastolic ?? relatedVital.diastolic;

      const noteSuffix = userCleanNote ? ` - ${userCleanNote}` : "";
      if (relatedVital.type === "blood_sugar") {
        updatedSummary = `قند خون: ${finalNum} mg/dL${noteSuffix}`;
      } else if (relatedVital.type === "blood_pressure") {
        updatedSummary = `فشار خون: ${finalSys}/${finalDia} mmHg${noteSuffix}`;
      } else if (relatedVital.type === "water_intake") {
        updatedSummary = `مصرف مایعات: ${finalNum} cc${noteSuffix}`;
      } else if (relatedVital.type === "urine_output") {
        updatedSummary = `تخلیه ادرار: ${finalNum} cc${noteSuffix}`;
      } else if (relatedVital.type === "dvt_timer") {
        const totalSec = Math.round(Number(finalNum) || 0);
        const minutes = Math.floor(totalSec / 60);
        const seconds = totalSec % 60;
        const durStr = minutes > 0 ? `${minutes} دقیقه` : `${seconds} ثانیه`;
        updatedSummary = `مراقبت DVT: ${durStr} بالا بردن پا${noteSuffix}`;
      }
    } else if (detectedVitalType && (valueNum !== undefined || systolic !== undefined)) {
      // Vital log didn't exist yet, create it linked to this taskLog so future edits and aggregations are 100% accurate
      const finalNum = valueNum !== undefined && valueNum !== null && !isNaN(Number(valueNum)) ? Number(valueNum) : null;
      const finalSys = systolic !== undefined && systolic !== null && !isNaN(Number(systolic)) ? Number(systolic) : null;
      const finalDia = diastolic !== undefined && diastolic !== null && !isNaN(Number(diastolic)) ? Number(diastolic) : null;

      await prisma.vitalLog.create({
        data: {
          nurseId: taskLog.nurseId,
          recordedAt: taskLog.completedAt,
          type: detectedVitalType,
          valueNum: finalNum,
          valueText: valueText || null,
          systolic: finalSys,
          diastolic: finalDia,
          extraData: JSON.stringify({ taskLogId: taskLog.id }),
        },
      });

      const noteSuffix = userCleanNote ? ` - ${userCleanNote}` : "";
      if (detectedVitalType === "blood_sugar") {
        updatedSummary = `قند خون: ${finalNum} mg/dL${noteSuffix}`;
      } else if (detectedVitalType === "blood_pressure") {
        updatedSummary = `فشار خون: ${finalSys}/${finalDia} mmHg${noteSuffix}`;
      } else if (detectedVitalType === "water_intake") {
        updatedSummary = `مصرف مایعات: ${finalNum} cc${noteSuffix}`;
      } else if (detectedVitalType === "urine_output") {
        updatedSummary = `تخلیه ادرار: ${finalNum} cc${noteSuffix}`;
      }
    }

    // 2. Update taskLog notes
    const updatedLog = await prisma.taskLog.update({
      where: { id: taskLog.id },
      data: {
        notes: updatedSummary !== undefined ? updatedSummary : taskLog.notes,
      },
    });

    // 3. Update any clinical note created alongside
    if (userCleanNote) {
      const logTime = new Date(taskLog.completedAt).getTime();
      await prisma.clinicalNote.updateMany({
        where: {
          nurseId: taskLog.nurseId,
          createdAt: {
            gte: new Date(logTime - 15 * 60 * 1000),
            lte: new Date(logTime + 15 * 60 * 1000),
          },
          noteText: { contains: taskLog.taskTitle },
        },
        data: {
          noteText: `گزارش تسک: ${taskLog.taskTitle} - توضیحات: ${userCleanNote}`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "گزارش تسک با موفقیت به‌روزرسانی شد",
      log: updatedLog,
    });
  } catch (error) {
    console.error("Task edit error:", error);
    return NextResponse.json({ error: "Failed to edit task log" }, { status: 500 });
  }
}

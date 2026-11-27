import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";

const OUT_OF_STOCK_MESSAGE = "موجودی این دارو صفر است — اول خرید ثبت کن";

class OutOfStockError extends Error {}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      scheduleId,
      taskTitle,
      adhocTitle,
      status = "DONE",
      notes,
      isAdHoc,
      category,
      medicationId,
      templateId,
    } = await request.json();
    const rawTitle = (taskTitle || adhocTitle || "").trim();

    if (!rawTitle) {
      return NextResponse.json({ error: "عنوان اقدام الزامی است" }, { status: 400 });
    }

    const finalTitle = isAdHoc ? `[موردی] ${rawTitle}` : rawTitle;
    const cleanScheduleId = scheduleId ? String(scheduleId).split("_")[0] : null;

    // Resolve the linked medication up front: a medicationId sent by the mobile
    // client wins, otherwise the schedule's medication is used.
    const schedule = cleanScheduleId
      ? await prisma.schedule.findUnique({
          where: { id: cleanScheduleId },
          select: { medicationId: true },
        })
      : null;

    const explicitMedicationId =
      typeof medicationId === "string" && medicationId.trim() ? medicationId.trim() : null;
    const targetMedicationId = explicitMedicationId || schedule?.medicationId || null;
    const cleanTemplateId =
      typeof templateId === "string" && templateId.trim() ? templateId.trim() : null;

    // Stock is only deducted for a successful completion.
    let canDeductStock = false;
    if (status === "DONE" && targetMedicationId) {
      const medication = await prisma.medication.findUnique({
        where: { id: targetMedicationId },
        select: { id: true, isActive: true, stockCount: true },
      });

      if (explicitMedicationId) {
        // A medication explicitly chosen by the nurse must exist, be active and
        // have stock; otherwise the mobile app shows the returned Persian error.
        if (!medication || !medication.isActive) {
          return NextResponse.json(
            { error: "داروی انتخاب‌شده یافت نشد یا غیرفعال شده است" },
            { status: 400 }
          );
        }
        if (medication.stockCount <= 0) {
          return NextResponse.json({ error: OUT_OF_STOCK_MESSAGE }, { status: 409 });
        }
        canDeductStock = true;
      } else if (!medication || !medication.isActive) {
        // Legacy behaviour for schedule-linked tasks: record the completion
        // without deducting stock when the medication was removed/deactivated.
        console.warn(
          `[tasks/complete] Skipping stock deduction: medication ${targetMedicationId} of schedule ${cleanScheduleId} is missing or inactive`
        );
      } else if (medication.stockCount <= 0) {
        return NextResponse.json({ error: OUT_OF_STOCK_MESSAGE }, { status: 409 });
      } else {
        canDeductStock = true;
      }
    }

    // Log + deduction happen atomically: a concurrent completion cannot drive
    // stock below zero, and a rejected deduction never leaves an orphan log.
    const log = await prisma
      .$transaction(async (tx) => {
        if (canDeductStock && targetMedicationId) {
          const deducted = await tx.medication.updateMany({
            where: { id: targetMedicationId, isActive: true, stockCount: { gt: 0 } },
            data: { stockCount: { decrement: 1 } },
          });
          if (deducted.count === 0) {
            throw new OutOfStockError();
          }
        }

        return tx.taskLog.create({
          data: {
            scheduleId: cleanScheduleId,
            taskTitle: finalTitle,
            nurseId: user.id,
            status,
            notes: notes || null,
            completedAt: new Date(),
            medicationId: targetMedicationId,
            templateId: cleanTemplateId,
          },
        });
      })
      .catch((error: unknown) => {
        if (error instanceof OutOfStockError) return null;
        throw error;
      });

    if (!log) {
      return NextResponse.json({ error: OUT_OF_STOCK_MESSAGE }, { status: 409 });
    }

    // If notes provided, also log to ClinicalNote for comprehensive history
    if (notes) {
      await prisma.clinicalNote.create({
        data: {
          nurseId: user.id,
          category: category || (isAdHoc ? "general" : "task_report"),
          noteText: isAdHoc
            ? `اقدام موردی: ${rawTitle} - توضیحات: ${notes}`
            : `گزارش تسک: ${rawTitle} - توضیحات: ${notes}`,
          createdAt: new Date(),
        },
      });
    }

    return NextResponse.json({ success: true, log });
  } catch (error) {
    console.error("Task completion error:", error);
    return NextResponse.json({ error: "Failed to complete task" }, { status: 500 });
  }
}

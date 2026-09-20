import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, reason, doctorName, notes, date } = body;

    if (!id) {
      return NextResponse.json({ error: "شناسه دارو الزامی است" }, { status: 400 });
    }

    const med = await prisma.medication.findUnique({ where: { id } });
    if (!med) {
      return NextResponse.json({ error: "دارو یافت نشد" }, { status: 404 });
    }

    const stopDate = date ? new Date(date) : new Date();
    const reasonText = (reason && reason.trim()) || "به دستور پزشک معالج";
    const doctorText = (doctorName && doctorName.trim()) || med.doctorName || user.fullName;

    // 1. Update Medication
    const updated = await prisma.medication.update({
      where: { id },
      data: {
        isActive: false,
        discontinuedAt: stopDate,
        discontinuedReason: reasonText,
        discontinuedBy: doctorText,
      },
    });

    // 2. Deactivate any active schedules connected to this medication
    await prisma.schedule.updateMany({
      where: { medicationId: id, isActive: true },
      data: { isActive: false },
    });

    // 3. Construct exact Persian narrative:
    // فلان دارو به علت [reason] مصرف اش متوقف شد. [توضیحات: ...]
    let description = `داروی ${med.nameFa} به علت ${reasonText} مصرف‌اش متوقف شد.`;
    if (notes && notes.trim()) {
      description += ` توضیحات: ${notes.trim()}`;
    }

    const historyEntry = await prisma.medicationHistory.create({
      data: {
        medicationId: id,
        medicationName: med.nameFa,
        actionType: "STOPPED",
        description,
        reason: reasonText,
        doctorName: doctorText,
        performedBy: user.fullName || "سرپرست پرونده",
        detailsJson: JSON.stringify({ notes: notes || null, stopDate }),
        createdAt: stopDate,
      },
    });

    return NextResponse.json({ success: true, medication: updated, history: historyEntry });
  } catch (error) {
    console.error("Stop medication error:", error);
    return NextResponse.json({ error: "خطا در توقف دارو" }, { status: 500 });
  }
}

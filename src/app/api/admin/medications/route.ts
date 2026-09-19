import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const medications = await prisma.medication.findMany({
      orderBy: [{ isActive: "desc" }, { boxNumber: "asc" }],
    });

    return NextResponse.json({ medications });
  } catch (error) {
    console.error("Medications error:", error);
    return NextResponse.json({ error: "Failed to fetch medications" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      nameFa,
      nameEn,
      dosage,
      unit = "قرص",
      boxNumber,
      instructions,
      doctorName,
      stockCount = 100,
      lowStockThreshold = 15,
      timeConstraints,
    } = body;

    if (!nameFa) {
      return NextResponse.json({ error: "نام دارو الزامی است" }, { status: 400 });
    }

    const medication = await prisma.medication.create({
      data: {
        nameFa,
        nameEn: nameEn || null,
        dosage: dosage || null,
        unit,
        boxNumber: boxNumber ? String(boxNumber) : null,
        instructions: instructions || null,
        doctorName: doctorName || null,
        stockCount: Number(stockCount) || 100,
        lowStockThreshold: Number(lowStockThreshold) || 15,
        timeConstraints: timeConstraints || null,
        isActive: true,
      },
    });

    return NextResponse.json({ success: true, medication });
  } catch (error) {
    console.error("Create medication error:", error);
    return NextResponse.json({ error: "Failed to create medication" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, stockDelta, ...data } = body;

    if (!id) {
      return NextResponse.json({ error: "شناسه دارو الزامی است" }, { status: 400 });
    }

    // Support quick stock increment/decrement
    if (stockDelta !== undefined) {
      const updated = await prisma.medication.update({
        where: { id },
        data: { stockCount: { increment: Number(stockDelta) } },
      });
      return NextResponse.json({ success: true, medication: updated });
    }

    const updated = await prisma.medication.update({
      where: { id },
      data: {
        nameFa: data.nameFa,
        nameEn: data.nameEn,
        dosage: data.dosage,
        unit: data.unit,
        boxNumber: data.boxNumber ? String(data.boxNumber) : null,
        instructions: data.instructions,
        doctorName: data.doctorName,
        stockCount: data.stockCount !== undefined ? Number(data.stockCount) : undefined,
        lowStockThreshold: data.lowStockThreshold !== undefined ? Number(data.lowStockThreshold) : undefined,
        timeConstraints: data.timeConstraints,
        isActive: data.isActive !== undefined ? Boolean(data.isActive) : undefined,
      },
    });

    return NextResponse.json({ success: true, medication: updated });
  } catch (error) {
    console.error("Update medication error:", error);
    return NextResponse.json({ error: "Failed to update medication" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "شناسه دارو الزامی است" }, { status: 400 });
    }

    await prisma.medication.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete medication error:", error);
    return NextResponse.json({ error: "Failed to delete medication" }, { status: 500 });
  }
}

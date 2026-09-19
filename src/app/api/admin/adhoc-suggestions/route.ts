import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";

const DEFAULT_SUGGESTIONS = [
  { title: "تعویض پانسمان موضعی", category: "مراقبتی" },
  { title: "پانسمان زخم پای راست (DVT)", category: "مراقبتی" },
  { title: "ماساژ اضافه و چرب کردن ساق پا", category: "مراقبتی" },
  { title: "تعویض ملحفه و نظافت فوری", category: "بهداشتی" },
  { title: "کنترل دمای بدن و تب", category: "پایش علائم" },
  { title: "تنظیم سرم / آنژیوکت", category: "مراقبتی" },
  { title: "کمک به جابجایی / ویلچر", category: "مراقبتی" },
  { title: "دادن میان‌وعده اضافه", category: "بهداشتی" },
];

// GET /api/admin/adhoc-suggestions
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let suggestions = await prisma.adhocSuggestion.findMany({
      orderBy: { createdAt: "asc" },
    });

    // Seed default suggestions if none exist
    if (suggestions.length === 0) {
      for (const def of DEFAULT_SUGGESTIONS) {
        await prisma.adhocSuggestion.upsert({
          where: { title: def.title },
          update: {},
          create: def,
        });
      }
      suggestions = await prisma.adhocSuggestion.findMany({
        orderBy: { createdAt: "asc" },
      });
    }

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error("GET adhoc suggestions error:", error);
    return NextResponse.json({ error: "Failed to load suggestions" }, { status: 500 });
  }
}

// POST /api/admin/adhoc-suggestions
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { title, category = "مراقبتی" } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ error: "عنوان پیشنهاد الزامی است." }, { status: 400 });
    }

    const trimmedTitle = title.trim();

    const existing = await prisma.adhocSuggestion.findUnique({
      where: { title: trimmedTitle },
    });

    if (existing) {
      return NextResponse.json(
        { error: "این عنوان از قبل در لیست پیشنهادات وجود دارد." },
        { status: 400 }
      );
    }

    const suggestion = await prisma.adhocSuggestion.create({
      data: {
        title: trimmedTitle,
        category: category || "مراقبتی",
      },
    });

    return NextResponse.json({ success: true, suggestion });
  } catch (error) {
    console.error("POST adhoc suggestion error:", error);
    return NextResponse.json({ error: "Failed to create suggestion" }, { status: 500 });
  }
}

// DELETE /api/admin/adhoc-suggestions
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "شناسه پیشنهاد الزامی است." }, { status: 400 });
    }

    await prisma.adhocSuggestion.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE adhoc suggestion error:", error);
    return NextResponse.json({ error: "Failed to delete suggestion" }, { status: 500 });
  }
}

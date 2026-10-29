import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "12", 10) || 12));
    const category = searchParams.get("category");

    const whereClause: {
      photoUrl: { not: null };
      category?: string;
    } = {
      photoUrl: { not: null },
    };

    if (category && category !== "all") {
      whereClause.category = category;
    }

    const [totalCount, notes] = await Promise.all([
      prisma.clinicalNote.count({ where: whereClause }),
      prisma.clinicalNote.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          nurse: {
            select: {
              id: true,
              fullName: true,
              role: true,
            },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(totalCount / limit) || 1;

    return NextResponse.json({
      photos: notes.map((n) => ({
        id: n.id,
        category: n.category,
        noteText: n.noteText,
        photoUrl: n.photoUrl,
        createdAt: n.createdAt.toISOString(),
        nurseName: n.nurse?.fullName || "پرستار",
      })),
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
      },
    });
  } catch (error) {
    console.error("Error fetching clinical photos archive:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

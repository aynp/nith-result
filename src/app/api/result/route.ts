import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const skip = searchParams.get("skip") || 0;
  const take = searchParams.get("take") || 3000;

  const students = await prisma.student.findMany({
    include: {
      summary: true,
      rank: true,
    },
    skip: Number(skip),
    take: Number(take),
    orderBy: {
      summary: {
        cgpi: "desc",
      },
    },
  });
  return NextResponse.json(students);
}

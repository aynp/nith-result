import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(request: Request) {
    const result = await prisma.student.findMany({});
    return NextResponse.json(result);
}

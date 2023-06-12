import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(request: Request) {
    const branches = await prisma.branch.findMany({})
    return NextResponse.json(branches);
}

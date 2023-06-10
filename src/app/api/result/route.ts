import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(request: Request) {
    const students = await prisma.student.findMany({
        where: {
            batch: 20
        },
        orderBy: {
            summary: {
                cgpi: "desc"
            }
        },
    });
    return NextResponse.json(students);
}

import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(request: Request, { params }: { params: { roll_no: string } }) {
    const roll_no = params.roll_no.toLowerCase();

    const result = await prisma.student.findFirst({
        where: {
            rollno: roll_no
        },
    });

    return NextResponse.json(result);
}

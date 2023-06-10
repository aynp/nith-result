import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function _rank(query, type, basedOn) {
    const students = await prisma.student.findMany({
        where: query,
        orderBy: {
            summary: {
                [basedOn]: "desc"
            }
        }
    })

    for (let i = 1; i <= students.length; i++) {
        await prisma.rank.upsert({
            create: {
                rollno: students[i - 1].rollno,
                [`${type}_rank_${basedOn}`]: i
            },
            update: {
                [`${type}_rank_${basedOn}`]: i
            },
            where: {
                rollno: students[i - 1].rollno
            }
        })
    }
}

async function main() {
    // rank in entire college
    await _rank({}, 'college', 'cgpi');
    await _rank({}, 'college', 'sgpi');

    // rank in the batch
    await _rank({
        batch: 20
    }, 'year', 'cgpi',);
    await _rank({
        batch: 20
    }, 'year', 'sgpi');

    // TODO rank in class
}

await main();

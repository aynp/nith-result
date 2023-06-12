import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export const branchMap = {
    'bcs': 'Computer Science & Engineering',
    'dcs': 'Computer Science & Engineering Dual Degree',

    'bec': 'Electronics & Communication Engineering',
    'dec': 'Electronics & Communication Engineering Dual Degree',

    'bce': 'Civil Engineering',
    'bar': 'Architecture',
    'bch': 'Chemical Engineering',
    'bee': 'Electrical Engineering',

    'bme': 'Mechanical Engineering',
    'bms': 'Material Science & Engineering',
    'bma': 'Mathematics & Scientific Computing',

    // '': 'Humanities and Social Sciences',
    // '': 'Management Studies',

    'bph': 'Physics & Photonics Science',
    // '': 'Centre for Energy Studies'
}

for (const branch in branchMap) {
    await prisma.branch.upsert({
        update: {
            name: branch
        },
        create: {
            code: branch,
            name: branchMap[branch]
        },
        where: {
            code: branch
        }
    })
}

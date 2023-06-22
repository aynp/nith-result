import { PrismaClient } from "@prisma/client";
import { readdirSync } from "fs";
import { branchMap } from "./branch.mjs";
const prisma = new PrismaClient();

const rankMap = new Map();

async function _rank(query, type, basedOn) {
  const students = await prisma.student.findMany({
    where: query,
    orderBy: {
      summary: {
        [basedOn]: "desc",
      },
    },
  });

  for (let i = 1; i <= students.length; i++) {
    if (!rankMap.has(students[i - 1].rollno)) {
      rankMap.set(students[i - 1].rollno, {});
    }

    rankMap.get(students[i - 1].rollno)[`${type}_rank_${basedOn}`] = i;
  }
}

async function _updateRank() {
  await prisma.rank.deleteMany({});

  const ranksArr = [];
  for (const [rollno, ranks] of rankMap) {
    ranksArr.push({
      rollno: rollno,
      ...ranks,
    });
  }

  await prisma.rank.createMany({
    data: ranksArr,
  });
}

async function main() {
  // rank in entire college
  await _rank({}, "college", "cgpi", true);
  await _rank({}, "college", "sgpi");

  const batches = readdirSync("./data");
  for (const batch of batches) {
    // rank in the batch
    await _rank(
      {
        batch: batch,
      },
      "year",
      "cgpi"
    );
    await _rank(
      {
        batch: batch,
      },
      "year",
      "sgpi"
    );

    // rank in the class
    const branches = Object.keys(branchMap);
    for (const branch of branches) {
      await _rank(
        {
          branch_code: branch,
          batch: batch,
        },
        "class",
        "cgpi"
      );
      await _rank(
        {
          branch_code: branch,
          batch: batch,
        },
        "class",
        "sgpi"
      );
    }
  }

  await _updateRank();
}

await main();

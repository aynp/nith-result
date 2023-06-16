import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { JSDOM } from 'jsdom';
import fs from 'fs';

const prisma = new PrismaClient();

let parseErrorCount = 0;
let fetchErrCount = 0;

async function parseHTML(rawHTML, batch) {
    try {
        const dom = new JSDOM(rawHTML);

        // fetch all tables
        const tables = dom.window.document.querySelectorAll("table");

        // table[1] contains information about the student
        const studentInfo = tables[1].querySelectorAll('td');

        const rollNo = studentInfo[0].querySelectorAll('p')[1].textContent.trim().toLowerCase();

        //* Will only work with with roll numbers such as 20bcs020
        const branch_code = rollNo.substring(2, 5);

        const name = studentInfo[1].querySelectorAll('p')[1].textContent.trim();
        const fathersName = studentInfo[2].querySelectorAll('p')[1].textContent.trim();

        const student = {
            name,
            rollno: rollNo,
            fathers_name: fathersName,
            batch: batch,
            branch_code: branch_code,
        }

        const courses = [];
        const results = [];
        const semSummaries = [];

        // table[2] through table[n-3] contains the result of the student in a pair of two!
        for (let i = 2; i < tables.length - 2; i += 2) {
            let semNo = i / 2;

            // table[i] contains the detailed result of the student in a particular semester
            const semInfo = tables[i].querySelectorAll('tr');

            // sem_info[0] contains the semester number
            // sem_info[1] contains the headers of the table
            for (let j = 2; j < semInfo.length; j++) {
                const subjectInfo = semInfo[j].querySelectorAll('td');

                const courseName = subjectInfo[1].textContent.trim();
                const courseCode = subjectInfo[2].textContent.trim();
                const courseCredits = parseInt(subjectInfo[3].textContent.trim());
                const gradeLetter = subjectInfo[4].textContent.trim();
                const GP = parseInt(subjectInfo[5].textContent.trim());

                courses.push({
                    course_code: courseCode,
                    course_title: courseName,
                    course_credits: courseCredits
                })

                results.push({
                    rollno: rollNo,
                    course_code: courseCode,
                    semester: semNo,
                    grade: GP / courseCredits,
                    grade_letter: gradeLetter,
                    gp: GP
                })
            }

            // table[i+1] contains the summary of the student in a particular semester
            const semSummary = tables[i + 1].querySelectorAll('td');

            const sgpaEq = semSummary[1].querySelectorAll('p')[1].textContent.trim();
            const sgpi = sgpaEq.substring(sgpaEq.indexOf('=') + 1).trim();

            const sgpiTotal = parseInt(semSummary[2].querySelectorAll('p')[1].textContent.trim());

            const cgpiEq = semSummary[3].querySelectorAll('p')[1].textContent.trim();
            const cgpi = cgpiEq.substring(cgpiEq.indexOf('=') + 1).trim();

            const cgpiTotal = parseInt(semSummary[4].querySelectorAll('p')[1].textContent.trim());

            semSummaries.push({
                // rollno: rollNo,
                semester: semNo,
                sgpi: sgpi,
                sgpi_total: sgpiTotal,
                cgpi: cgpi,
                cgpi_total: cgpiTotal
            });
        }

        // Insert all the data into the database
        await prisma.student.upsert({
            create: {
                ...student,
                branch_code: branch_code,
                sem_summary: {
                    createMany: {
                        data: semSummaries,
                        skipDuplicates: true
                    }
                },
                summary: {
                    create: semSummaries[semSummaries.length - 1]
                }
            },
            update: {
                ...student,
                sem_summary: {
                    createMany: {
                        data: semSummaries,
                        skipDuplicates: true
                    }
                },
                summary: {
                    update: semSummaries[semSummaries.length - 1],
                }
            },
            where: {
                rollno: rollNo
            }
        });

        await prisma.course.createMany({
            data: courses,
            skipDuplicates: true
        });

        await prisma.result.createMany({
            data: results,
            skipDuplicates: true
        });
    } catch (err) {
        console.log(err);
        parseErrorCount++;
    }
}

async function fetchBatch(batch) {
    const emailsAll = fs.readFileSync(`./data/${batch}`, 'utf-8');

    const emails = emailsAll.split(',');

    for (let i = 0; i < emails.length; i++) {
        const email = emails[i];
        const rollNo = email.substring(0, email.indexOf('@'));
        console.log(rollNo);
        try {
            const res = await axios.post(`http://results.nith.ac.in/scheme${batch}/studentresult/result.asp`, `RollNumber=${rollNo}`, {
                timeout: 5000
            });

            await parseHTML(res.data, batch);
        } catch (err) {
            console.log(err);
            fetchErrCount++;
        }
    }
}

async function main() {
    const files = fs.readdirSync('./data');

    for (const batch of files) {
        console.log(`Processing ${batch} batch`);
        await fetchBatch(batch);
    };

    console.log("Failed to parse for", parseErrorCount, "students.");
    console.log("Failed to fetch for", fetchErrCount, "students.");
}

await main();


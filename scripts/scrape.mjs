import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { JSDOM } from 'jsdom';
import fs from 'fs';

const prisma = new PrismaClient();

let parseErrorCount = 0;
let fetchErrCount = 0;

async function parseHTML(rawHTML, batch, rollNo) {
    try {
        const dom = new JSDOM(rawHTML);

        // fetch all tables
        const tables = dom.window.document.querySelectorAll("table");

        // table[1] contains information about the student
        const studentInfo = tables[1].querySelectorAll('td');

        // const rollNo = studentInfo[0].querySelectorAll('p')[1].textContent.trim().toLowerCase();

        //* Will only work with with roll numbers such as 20bcs020
        const branch_code = rollNo.substring(2, 5);

        const name = studentInfo[1].querySelectorAll('p')[1].textContent.trim();
        const fathersName = studentInfo[2].querySelectorAll('p')[1].textContent.trim();

        const student = await prisma.student.upsert({
            create: {
                name,
                rollno: rollNo,
                fathers_name: fathersName,
                batch: batch,
                branch_code: branch_code,
            },
            update: {},
            where: {
                rollno: rollNo
            }
        })

        // console.log(student);

        // table[2] through table[n-3] contains the result of the student in a pair of two!
        for (let i = 2; i < tables.length - 2; i += 2) {
            let semNo = i / 2;

            //* sem_summary needs to be created first as it is a foreign key in results
            // table[i+1] contains the summary of the student in a particular semester
            const semSummary = tables[i + 1].querySelectorAll('td');

            const sgpaEq = semSummary[1].querySelectorAll('p')[1].textContent.trim();
            const sgpi = sgpaEq.substring(sgpaEq.indexOf('=') + 1).trim();

            const sgpiTotal = parseInt(semSummary[2].querySelectorAll('p')[1].textContent.trim());

            const cgpiEq = semSummary[3].querySelectorAll('p')[1].textContent.trim();
            const cgpi = cgpiEq.substring(cgpiEq.indexOf('=') + 1).trim();

            const cgpiTotal = parseInt(semSummary[4].querySelectorAll('p')[1].textContent.trim());

            await prisma.sem_summary.upsert({
                create: {
                    rollno: rollNo,
                    semester: semNo,
                    sgpi: sgpi,
                    sgpi_total: sgpiTotal,
                    cgpi: cgpi,
                    cgpi_total: cgpiTotal
                },
                update: {
                    sgpi: sgpi,
                    sgpi_total: sgpiTotal,
                    cgpi: cgpi,
                    cgpi_total: cgpiTotal
                },
                where: {
                    rollno_semester: {
                        rollno: rollNo,
                        semester: semNo
                    }
                }
            });

            await prisma.summary.upsert({
                create: {
                    rollno: rollNo,
                    semester: semNo,
                    sgpi: sgpi,
                    sgpi_total: sgpiTotal,
                    cgpi: cgpi,
                    cgpi_total: cgpiTotal
                },
                update: {
                    semester: semNo,
                    sgpi: sgpi,
                    sgpi_total: sgpiTotal,
                    cgpi: cgpi,
                    cgpi_total: cgpiTotal
                },
                where: {
                    rollno: rollNo
                }
            });

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

                await prisma.course.upsert({
                    create: {
                        code: courseCode,
                        title: courseName,
                        credits: courseCredits
                    },
                    update: {},
                    where: {
                        code: courseCode
                    }
                })

                await prisma.result.upsert({
                    create: {
                        rollno: rollNo,
                        grade: GP / courseCredits,
                        code: courseCode,
                        semester: semNo,
                        grade_letter: gradeLetter,
                        gp: GP
                    },
                    update: {
                        grade: GP / courseCredits,
                        grade_letter: gradeLetter,
                        gp: GP
                    },
                    where: {
                        rollno_code_semester: {
                            code: courseCode,
                            rollno: rollNo,
                            semester: semNo
                        }
                    }
                })
            }

        }
    } catch (err) {
        parseErrorCount++;
    }
}

async function fetchBatch(location, batch) {
    const emailsAll = fs.readFileSync(`./${location}/${batch}`, 'utf-8');

    // remove all error files if present
    fs.existsSync(`./error/${batch}`) && fs.unlinkSync(`./error/${batch}`);

    const emails = emailsAll.split(',');

    for (let i = 0; i < emails.length; i++) {
        const email = emails[i];
        const rollNo = email.substring(0, email.indexOf('@'));
        console.log(rollNo);
        try {
            const res = await axios.post(`http://results.nith.ac.in/scheme${batch}/studentresult/result.asp`, `RollNumber=${rollNo}`, {
                timeout: 5000
            });

            await parseHTML(res.data, batch, rollNo);
        } catch (err) {
            fs.appendFileSync(`./error/${batch}`, email + ',');
            console.log(err);
            fetchErrCount++;
        }
    }
}

async function main() {
    const files = fs.readdirSync('./data');

    for (const batch of files) {
        console.log(`Processing ${batch} batch`);
        await fetchBatch('data', batch);
    };

    console.log("Failed to parse for", parseErrorCount, "students."); parseErrorCount = 0;
    console.log("Failed to fetch for", fetchErrCount, "students."); fetchErrCount = 0;

    // try again for roll numbers in error files
    const errorFiles = fs.readdirSync('./error');

    for (const batch of errorFiles) {
        console.log(`Processing ${batch} batch`);
        await fetchBatch('error', batch);
    };

    console.log("Failed to parse for", parseErrorCount, "students.");
    console.log("Failed to fetch for", fetchErrCount, "students.");
}

await main();


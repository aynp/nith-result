import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { JSDOM } from 'jsdom';
import fs from 'fs';

const prisma = new PrismaClient();

const emailsAll = fs.readFileSync('./data/ug2020-test', 'utf-8');
const emails = emailsAll.split(',');

let errCount = 0;

async function parseHTML(rawHTML) {
    const dom = new JSDOM(rawHTML);

    // fetch all tables
    const tables = dom.window.document.querySelectorAll("table");

    // table[1] contains information about the student
    const studentInfo = tables[1].querySelectorAll('td');

    const rollno = studentInfo[0].querySelectorAll('p')[1].textContent.trim().toLowerCase();
    const name = studentInfo[1].querySelectorAll('p')[1].textContent.trim();
    const fathersName = studentInfo[2].querySelectorAll('p')[1].textContent.trim();

    console.log(rollno)
    const student = await prisma.student.create({
        data: {
            name,
            rollno,
            fathers_name: fathersName
        },
    })

    console.log(student);

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

            await prisma.result.create({
                data: {
                    rollno: rollno,
                    grade: GP / courseCredits,
                    code: courseCode,
                    semester: semNo,
                    grade_letter: gradeLetter,
                    gp: GP
                }
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

        await prisma.sem_summary.create({
            data: {
                rollno: rollno,
                semester: semNo,
                sgpi: sgpi,
                sgpi_total: sgpiTotal,
                cgpi: cgpi,
                cgpi_total: cgpiTotal
            }
        })

        await prisma.summary.upsert({
            create: {
                rollno: rollno,
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
                rollno: rollno
            }
        })
    }

    tables[tables.length - 2].querySelector
}

async function main() {
    for (let i = 0; i < emails.length; i++) {
        const email = emails[i];
        const roll_no = email.substring(0, email.indexOf('@'));
        console.log(roll_no);
        try {
            const res = await axios.post('http://results.nith.ac.in/scheme20/studentresult/result.asp', `RollNumber=${roll_no}`, {
                timeout: 5000
            });

            parseHTML(res.data);
        } catch (err) {
            console.log("Error with roll no - ", roll_no, err)
            errCount++;
        }
    }
}

try {
    await main();
} catch (error) {
    console.log(error);
}

console.log(errCount);

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const departments = [
    { code: 'CSE', name: 'Computer Science and Engineering', prefix: 'CS', subjects: ['Programming for Problem Solving', 'Data Structures', 'Object Oriented Programming', 'Database Management Systems', 'Operating Systems', 'Computer Networks', 'Software Engineering', 'Artificial Intelligence', 'Machine Learning', 'Web Technologies', 'Compiler Design', 'Cloud Computing'] },
    { code: 'ECE', name: 'Electronics and Communication Engineering', prefix: 'EC', subjects: ['Engineering Mathematics', 'Digital Electronics', 'Microprocessors', 'Signals and Systems', 'Analog Circuits', 'Communication Systems', 'Embedded Systems', 'Digital Signal Processing', 'VLSI Design', 'Computer Architecture', 'Control Systems', 'Wireless Communication'] },
    { code: 'EEE', name: 'Electrical and Electronics Engineering', prefix: 'EE', subjects: ['Engineering Mathematics', 'Circuit Theory', 'Electrical Machines', 'Power Systems', 'Power Electronics', 'Electrical Measurements', 'Control Systems', 'Renewable Energy Systems', 'Digital Electronics', 'Microcontrollers', 'High Voltage Engineering', 'Smart Grid Technologies'] },
    { code: 'MECH', name: 'Mechanical Engineering', prefix: 'ME', subjects: ['Engineering Mathematics', 'Engineering Mechanics', 'Thermodynamics', 'Fluid Mechanics', 'Manufacturing Processes', 'Strength of Materials', 'Machine Design', 'Heat Transfer', 'CAD and CAM', 'Mechatronics', 'Industrial Engineering', 'Automobile Engineering'] },
] as const;
const years = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
const blockNames = ['A Block', 'H Block', 'N Block', 'U Block'];
const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const firstNames = ['Anitha', 'Ravi', 'Priya', 'Suresh', 'Meera', 'Karthik', 'Lakshmi', 'Venkata', 'Divya', 'Arjun', 'Swathi', 'Nikhil', 'Kavya', 'Mohan', 'Pooja', 'Rahul'];
const lastNames = ['Rao', 'Kumar', 'Sharma', 'Reddy', 'Nair', 'Sen', 'Iyer', 'Varma', 'Joshi', 'Patel', 'Menon', 'Desai'];
const floorNames = ['Ground Floor', 'First Floor', 'Second Floor', 'Third Floor'];

async function main() {
    const seedDataset = await prisma.timetableDataset.create({
        data: {
            name: 'Seed Dataset',
            academicYear: '2025-26',
            semester: 'Semester 1',
            datasetType: 'COLLEGE',
            isActive: true,
            source: 'seed',
            payload: JSON.stringify({ departments: [], sections: [], faculty: [], courses: [], rooms: [], laboratories: [], availability: [], allocations: [], batches: [], constraints: [] }),
            status: 'ACTIVE',
        },
    });

    await prisma.timetableEntry.deleteMany();
    await prisma.facultyAvailability.deleteMany();
    await prisma.labBatch.deleteMany();
    await prisma.courseSection.deleteMany();
    await prisma.facultyCourse.deleteMany();
    await prisma.course.deleteMany();
    await prisma.faculty.deleteMany();
    await prisma.section.deleteMany();
    await prisma.room.deleteMany();
    await prisma.laboratory.deleteMany();
    await prisma.workingDay.deleteMany();
    await prisma.period.deleteMany();
    await prisma.changeRequest.deleteMany();
    await prisma.constraintRule.deleteMany();
    await prisma.block.deleteMany();
    await prisma.department.deleteMany();

    const departmentRecords = await Promise.all(departments.map((department) => prisma.department.create({ data: { code: department.code, name: department.name } })));
    const departmentMap = Object.fromEntries(departmentRecords.map((department) => [department.code, department]));
    const blockRecords = await Promise.all(blockNames.map((name) => prisma.block.create({ data: { name } })));
    const blockMap = Object.fromEntries(blockRecords.map((block) => [block.name, block]));

    const sectionRecords = [];
    for (const [departmentIndex, department] of departments.entries()) {
        for (const [yearIndex, year] of years.entries()) {
            for (let parallel = 1; parallel <= 2; parallel += 1) {
                sectionRecords.push(await prisma.section.create({
                    data: {
                        name: `${department.code}-${String(yearIndex * 2 + parallel).padStart(2, '0')}`,
                        year,
                        semester: `Semester ${yearIndex * 2 + 1}`,
                        departmentId: departmentMap[department.code].id,
                        strength: 50 + ((departmentIndex + yearIndex + parallel) % 11),
                        assignedBlock: blockNames[(departmentIndex + yearIndex + parallel - 1) % blockNames.length],
                        advisor: `Dr. ${firstNames[(departmentIndex * 4 + yearIndex + parallel) % firstNames.length]} ${lastNames[(yearIndex * 2 + parallel) % lastNames.length]}`,
                    }
                }));
            }
        }
    }

    const facultyRecords = [];
    for (let index = 0; index < 48; index += 1) {
        const department = departments[index % departments.length];
        const firstName = firstNames[index % firstNames.length];
        const lastName = lastNames[(index + Math.floor(index / firstNames.length)) % lastNames.length];
        facultyRecords.push(await prisma.faculty.create({
            data: {
                facultyId: `${department.code}-F${String(index + 1).padStart(3, '0')}`,
                name: `${index % 3 === 0 ? 'Dr.' : 'Prof.'} ${firstName} ${lastName}`,
                designation: index % 5 === 0 ? 'Professor' : index % 2 === 0 ? 'Associate Professor' : 'Assistant Professor',
                departmentId: departmentMap[department.code].id,
                email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${index + 1}@vignan.edu`,
                weeklyLoad: 14 + (index % 7),
            }
        }));
    }

    const courseRecords = [];
    for (const department of departments) {
        for (const [yearIndex, year] of years.entries()) {
            for (let subjectIndex = 0; subjectIndex < 3; subjectIndex += 1) {
                const isLab = subjectIndex === 2;
                const subject = isLab ? `${department.subjects[yearIndex * 3 + subjectIndex]} Lab` : department.subjects[yearIndex * 3 + subjectIndex];
                courseRecords.push(await prisma.course.create({
                    data: {
                        code: `${department.prefix}${yearIndex + 1}${String(subjectIndex + 1).padStart(2, '0')}`,
                        name: subject,
                        departmentId: departmentMap[department.code].id,
                        year,
                        semester: `Semester ${yearIndex * 2 + 1}`,
                        type: isLab ? 'LAB' : 'THEORY',
                        requiredPeriodsPerWeek: isLab ? 2 : 4,
                        isLab,
                    }
                }));
            }
        }
    }

    const roomRecords = [];
    for (let blockIndex = 0; blockIndex < blockNames.length; blockIndex += 1) {
        for (let roomIndex = 1; roomIndex <= 8; roomIndex += 1) {
            const floorIndex = Math.min(Math.floor((roomIndex - 1) / 2), 3);
            roomRecords.push(await prisma.room.create({
                data: {
                    roomName: `${blockNames[blockIndex][0]}-${(floorIndex + 1) * 100 + roomIndex}`,
                    blockId: blockMap[blockNames[blockIndex]].id,
                    floor: floorNames[floorIndex],
                    capacity: 60 + ((blockIndex + roomIndex) % 5),
                    roomType: 'TEACHING_ROOM',
                    department: departments[blockIndex].code,
                }
            }));
        }
    }

    const labNames = [['Programming Lab', 'Data Structures Lab', 'DBMS Lab', 'Computer Networks Lab'], ['Digital Electronics Lab', 'Communication Lab', 'Embedded Systems Lab'], ['Electrical Machines Lab', 'Power Systems Lab', 'Control Systems Lab'], ['Mechanical Workshop', 'Manufacturing Lab', 'CAD and CAM Lab']];
    const labRecords = [];
    for (let blockIndex = 0; blockIndex < blockNames.length; blockIndex += 1) {
        for (const [labIndex, name] of labNames[blockIndex].entries()) {
            labRecords.push(await prisma.laboratory.create({
                data: {
                    name,
                    blockId: blockMap[blockNames[blockIndex]].id,
                    floor: labIndex % 2 === 0 ? 'First Floor' : 'Second Floor',
                    capacity: 30,
                    labType: blockIndex === 0 ? 'Computer' : blockIndex === 1 ? 'Electronics' : blockIndex === 2 ? 'Electrical' : 'Mechanical',
                    equipment: blockIndex === 0 ? 'Desktop Systems, Projector' : blockIndex === 1 ? 'Oscilloscopes, Breadboards' : blockIndex === 2 ? 'Meters, Power Analyzer' : 'Bench Tools, Test Rigs',
                }
            }));
        }
    }

    const workingDays = await Promise.all(dayNames.map((name, index) => prisma.workingDay.create({ data: { name, dayOrder: index + 1 } })));
    const starts = ['09:00', '09:50', '10:50', '11:40', '13:30', '14:20'];
    const ends = ['09:50', '10:40', '11:40', '12:30', '14:20', '15:10'];
    const periods = await Promise.all(starts.map((startTime, index) => prisma.period.create({ data: { periodNumber: index + 1, startTime, endTime: ends[index] } })));
    for (const [facultyIndex, member] of facultyRecords.entries()) {
        for (const day of workingDays) {
            for (const period of periods) await prisma.facultyAvailability.create({ data: { facultyId: member.id, dayId: day.id, periodId: period.id, available: true, preferred: facultyIndex % 3 === 0 && period.periodNumber <= 2 } });
        }
    }

    for (const [sectionIndex, section] of sectionRecords.entries()) {
        const department = departments.find((item) => section.name.startsWith(`${item.code}-`))!;
        const departmentRecord = departmentMap[department.code];
        const sectionCourses = courseRecords.filter((course) => course.departmentId === departmentRecord.id && course.year === section.year);
        const facultyPool = facultyRecords.filter((member) => member.departmentId === departmentRecord.id);
        const rooms = roomRecords.filter((room) => room.department === department.code);
        const labs = labRecords.filter((lab) => lab.blockId === blockMap[section.assignedBlock].id);
        for (const [courseIndex, course] of sectionCourses.entries()) {
            await prisma.courseSection.create({ data: { courseId: course.id, sectionId: section.id } });
            await prisma.facultyCourse.create({ data: { facultyId: facultyPool[(courseIndex + sectionIndex) % facultyPool.length].id, courseId: course.id } });
        }
        const batchRecords = await Promise.all([
            prisma.labBatch.create({ data: { sectionId: section.id, name: 'Batch A', studentCount: Math.ceil(section.strength / 2) } }),
            prisma.labBatch.create({ data: { sectionId: section.id, name: 'Batch B', studentCount: Math.floor(section.strength / 2) } }),
        ]);
        let slotIndex = sectionIndex % dayNames.length;
        for (const course of sectionCourses) {
            for (let occurrence = 0; occurrence < course.requiredPeriodsPerWeek; occurrence += 1) {
                const day = workingDays[slotIndex % workingDays.length];
                const period = periods[Math.floor(slotIndex / workingDays.length) % periods.length];
                const facultyMember = facultyPool[(sectionIndex + occurrence + courseRecords.indexOf(course)) % facultyPool.length];
                const lab = course.isLab ? labs[(sectionIndex + occurrence) % labs.length] : null;
                await prisma.timetableEntry.create({
                    data: {
                        datasetId: seedDataset.id,
                        sectionId: section.id,
                        courseId: course.id,
                        facultyId: facultyMember.id,
                        roomId: lab ? null : rooms[(sectionIndex + occurrence) % rooms.length].id,
                        laboratoryId: lab?.id,
                        labBatchId: lab ? batchRecords[occurrence % batchRecords.length].id : null,
                        dayId: day.id,
                        periodId: period.id,
                        entryType: lab ? 'LAB' : 'THEORY',
                    }
                });
                slotIndex += 1;
            }
        }
    }

    await prisma.changeRequest.create({ data: { id: 'demo-request-1', requestedBy: 'admin@vignan.edu', description: 'Review faculty leave requests for the upcoming week.', status: 'PENDING' } });
    await prisma.constraintRule.createMany({
        data: [
            { id: 'rule-hard-one', name: 'No room overlap', description: 'No two classes can use the same room in the same period.', type: 'HARD', enabled: true, value: 'room-overlap' },
            { id: 'rule-soft-one', name: 'Prefer faculty availability', description: 'Prefer faculty preferred time slots when scheduling classes.', type: 'SOFT', enabled: true, value: 'preferred-slot' },
        ]
    });
}

main().then(() => prisma.$disconnect()).catch(async (error) => { console.error('Seed error:', error); await prisma.$disconnect(); process.exit(1); });

import { blocks, courses, departments, faculty, laboratories, rooms, sections, timetableEntries } from './sampleCollegeData';

export const sampleApiDepartments = departments.map((department) => ({
    code: department.code,
    name: department.name,
}));

export const sampleApiSections = sections.map((section) => ({
    name: section.id,
    year: section.year,
    strength: section.studentStrength,
    assignedBlock: section.block,
    advisor: section.advisor,
    department: { code: section.department },
}));

export const sampleApiFaculty = faculty.map((member) => ({
    id: member.id,
    facultyId: member.id,
    name: member.name,
    designation: member.designation,
    weeklyLoad: member.weeklyLoad,
    active: member.status !== 'On Leave',
    department: { code: member.department },
    courses: member.courses.map((name) => ({ course: { name } })),
    availability: Object.entries(member.availability).flatMap(([day, slots]) => slots.available.map((period) => ({ day: { name: day }, period: { periodNumber: Number(period.slice(1)) }, available: true, preferred: slots.preferred.includes(period as never) }))),
}));

export const sampleApiCourses = courses.map((course) => ({
    code: course.code,
    name: course.name,
    year: course.year,
    type: course.type,
    requiredPeriodsPerWeek: course.requiredPeriodsPerWeek,
    isLab: course.type === 'Laboratory',
    department: { code: course.department },
    facultyAssignments: [{ faculty: { name: faculty.find((member) => member.id === course.facultyId)?.name ?? 'Unassigned' } }],
}));

export const sampleApiRooms = rooms.map((room) => ({
    id: room.id,
    roomName: room.roomNumber,
    capacity: room.capacity,
    roomType: 'TEACHING_ROOM',
    active: true,
    block: { name: room.block },
}));

export const sampleApiLabs = laboratories.map((lab) => ({
    id: lab.id,
    name: lab.name,
    capacity: lab.capacity,
    labType: lab.type,
    equipment: lab.equipment.join(', '),
    active: true,
    block: { name: lab.block },
}));

export const sampleApiBlocks = blocks;

export const sampleApiTimetable = timetableEntries.map((entry) => ({
    id: entry.id,
    section: entry.sectionId,
    sectionId: entry.sectionId,
    courseCode: entry.courseCode,
    course: courses.find((course) => course.code === entry.courseCode)?.name ?? entry.details ?? 'Scheduled class',
    faculty: faculty.find((member) => member.id === entry.facultyId)?.name ?? 'Unassigned',
    room: rooms.find((room) => room.id === entry.roomId)?.roomNumber ?? null,
    laboratory: laboratories.find((lab) => lab.id === entry.labId)?.name ?? null,
    day: entry.day,
    period: entry.period,
    type: entry.type,
    block: rooms.find((room) => room.id === entry.roomId)?.block ?? laboratories.find((lab) => lab.id === entry.labId)?.block ?? null,
}));

import type { ChangeRequest, ConstraintRule, DayName, DepartmentName, Faculty, PeriodName, Room, Section, Laboratory, LabBatch, Course, TimetableEntry } from './types';

export const academicYear = '2026-2027';
export const semester = 'Semester 1';
export const days: DayName[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const periods: PeriodName[] = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];

export const departments = [
    { id: 'CSE', name: 'Computer Science and Engineering', code: 'CSE' },
    { id: 'ECE', name: 'Electronics and Communication Engineering', code: 'ECE' },
    { id: 'EEE', name: 'Electrical and Electronics Engineering', code: 'EEE' },
    { id: 'ME', name: 'Mechanical Engineering', code: 'ME' },
];

export const blocks = [
    { id: 'A', name: 'A Block', description: 'Computer Science and shared classrooms' },
    { id: 'H', name: 'H Block', description: 'Electronics and communication facilities' },
    { id: 'N', name: 'N Block', description: 'Electrical engineering facilities' },
    { id: 'U', name: 'U Block', description: 'Mechanical engineering facilities' },
];

const departmentBlock: Record<DepartmentName, string> = { CSE: 'A Block', ECE: 'H Block', EEE: 'N Block', ME: 'U Block' };
const facultyNames: Record<DepartmentName, string[]> = {
    CSE: ['Dr. Anitha Rao', 'Prof. Ravi Kumar', 'Dr. Priya Sharma', 'Prof. Nikhil Das'],
    ECE: ['Dr. Suresh Babu', 'Prof. Malini Reddy', 'Dr. Vinod Nair', 'Prof. Leena Thomas'],
    EEE: ['Dr. Meena Reddy', 'Prof. Harish Iyer', 'Dr. Reena Joseph', 'Prof. Bharat Rao'],
    ME: ['Dr. Arjun Varma', 'Prof. Karthik Sen', 'Dr. Sudhakar Rao', 'Prof. Nandini Rao'],
};

const availability = (): Faculty['availability'] => {
    const result = {} as Faculty['availability'];
    for (const day of days) {
        result[day] = { available: periods, unavailable: [], preferred: ['P1', 'P2'] };
    }
    return result;
};

export const faculty: Faculty[] = (Object.keys(facultyNames) as DepartmentName[]).flatMap((department) => facultyNames[department].map((name, index) => ({
    id: `FAC-${department}-${String(index + 1).padStart(2, '0')}`,
    name,
    department,
    designation: index === 0 ? 'Professor' : index === 1 ? 'Associate Professor' : 'Assistant Professor',
    courses: [],
    weeklyLoad: 12 + index * 2,
    availability: availability(),
    status: 'Available' as const,
})));

const courseDefinitions: Array<[DepartmentName, string, string, string, 'Theory' | 'Laboratory', number, number]> = [
    ['CSE', 'CSE101', 'Programming for Problem Solving', '1st Year', 'Theory', 4, 0],
    ['CSE', 'CSE201', 'Data Structures', '2nd Year', 'Theory', 4, 0],
    ['CSE', 'CSE205', 'Programming Laboratory', '2nd Year', 'Laboratory', 2, 1],
    ['ECE', 'ECE101', 'Digital Electronics', '1st Year', 'Theory', 4, 4],
    ['ECE', 'ECE201', 'Signals and Systems', '2nd Year', 'Theory', 4, 4],
    ['ECE', 'ECE205', 'Electronics Laboratory', '2nd Year', 'Laboratory', 2, 5],
    ['EEE', 'EEE101', 'Circuit Theory', '1st Year', 'Theory', 4, 8],
    ['EEE', 'EEE201', 'Electrical Machines', '2nd Year', 'Theory', 4, 8],
    ['EEE', 'EEE205', 'Electrical Laboratory', '2nd Year', 'Laboratory', 2, 9],
    ['ME', 'ME101', 'Engineering Mechanics', '1st Year', 'Theory', 4, 12],
    ['ME', 'ME201', 'Thermodynamics', '2nd Year', 'Theory', 4, 12],
    ['ME', 'ME205', 'Mechanical Workshop Laboratory', '2nd Year', 'Laboratory', 2, 13],
];

export const courses: Course[] = courseDefinitions.map(([department, code, name, year, type, requiredPeriodsPerWeek, facultyIndex]) => ({
    code, name, department, year: year as Course['year'], type, requiredPeriodsPerWeek,
    roomRequirement: type === 'Laboratory' ? ({ CSE: 'Computer Lab', ECE: 'Electronics Lab', EEE: 'Electrical Lab', ME: 'Mechanical Lab' }[department] as Course['roomRequirement']) : 'Classroom',
    facultyId: faculty.find((member) => member.department === department && member.id.endsWith(String((facultyIndex % 4) + 1).padStart(2, '0')))?.id ?? faculty.find((member) => member.department === department)!.id,
}));

faculty.forEach((member) => { member.courses = courses.filter((course) => course.facultyId === member.id).map((course) => course.name); });

export const sections: Section[] = (Object.keys(departmentBlock) as DepartmentName[]).flatMap((department) => [1, 2].flatMap((number, index) => [
    { id: `${department}-${String(number).padStart(2, '0')}`, department, year: index === 0 ? '1st Year' : '2nd Year', studentStrength: index === 0 ? 55 : 52, block: departmentBlock[department], advisor: faculty.find((member) => member.department === department)!.name },
]));

const roomSeeds: Array<[string, string, string, number, DepartmentName]> = [
    ['A-101', 'A Block', 'Ground Floor', 60, 'CSE'], ['A-201', 'A Block', 'First Floor', 60, 'CSE'], ['A-301', 'A Block', 'Second Floor', 55, 'CSE'],
    ['H-101', 'H Block', 'Ground Floor', 60, 'ECE'], ['H-201', 'H Block', 'First Floor', 60, 'ECE'], ['H-301', 'H Block', 'Second Floor', 55, 'ECE'],
    ['N-101', 'N Block', 'Ground Floor', 60, 'EEE'], ['N-201', 'N Block', 'First Floor', 60, 'EEE'], ['N-301', 'N Block', 'Second Floor', 55, 'EEE'],
    ['U-101', 'U Block', 'Ground Floor', 60, 'ME'], ['U-201', 'U Block', 'First Floor', 60, 'ME'], ['U-301', 'U Block', 'Second Floor', 55, 'ME'],
];
export const rooms: Room[] = roomSeeds.map(([roomNumber, block, floor, capacity, department], index) => ({ id: `ROOM-${index + 1}`, roomNumber, block, floor, capacity, type: 'Classroom', equipment: ['Projector'], currentUtilization: 0 }));
export const teachingRooms = rooms;

export const laboratories: Laboratory[] = [
    { id: 'LAB-CSE', name: 'Programming Laboratory', block: 'A Block', capacity: 30, equipment: ['Computers', 'Projector'], type: 'Computer', currentAllocation: 0 },
    { id: 'LAB-ECE', name: 'Electronics Laboratory', block: 'H Block', capacity: 30, equipment: ['Oscilloscope', 'Projector'], type: 'Electronics', currentAllocation: 0 },
    { id: 'LAB-EEE', name: 'Electrical Laboratory', block: 'N Block', capacity: 30, equipment: ['Power Analyzer'], type: 'Electrical', currentAllocation: 0 },
    { id: 'LAB-ME', name: 'Mechanical Workshop Laboratory', block: 'U Block', capacity: 30, equipment: ['Workshop Tools'], type: 'Mechanical', currentAllocation: 0 },
];

export const labBatches: LabBatch[] = sections.map((section, index) => ({ id: `BATCH-${index + 1}`, sectionId: section.id, courseCode: courses.find((course) => course.department === section.department && course.type === 'Laboratory')!.code, batchName: 'Batch A', studentCount: Math.ceil(section.studentStrength / 2), labId: laboratories.find((lab) => lab.block === section.block)!.id, facultyId: courses.find((course) => course.department === section.department && course.type === 'Laboratory')!.facultyId }));

const sectionCourses = (section: Section) => courses.filter((course) => course.department === section.department && course.year === section.year);
export const timetableEntries: TimetableEntry[] = sections.flatMap((section, sectionIndex) => sectionCourses(section).flatMap((course, courseIndex) => Array.from({ length: course.requiredPeriodsPerWeek }, (_, occurrence) => {
    const day = days[(sectionIndex + courseIndex + occurrence) % days.length];
    const period = periods[(courseIndex + occurrence) % periods.length];
    const lab = course.type === 'Laboratory' ? laboratories.find((item) => item.block === section.block) : undefined;
    return { id: `T-${section.id}-${course.code}-${occurrence}`, day, period, sectionId: section.id, type: course.type, courseCode: course.code, facultyId: course.facultyId, roomId: lab ? undefined : rooms.find((room) => room.block === section.block)!.id, labId: lab?.id, details: course.name };
})));

export const departmentSummaries = departments.map((department) => {
    const departmentCode = department.code as DepartmentName;
    return {
        ...department,
        shortName: department.code === 'EEE' ? 'EEE / Triple E' : department.code === 'ME' ? 'Mechanical' : department.name,
        sections: sections.filter((section) => section.department === department.code).length,
        facultyCount: faculty.filter((member) => member.department === department.code).length,
        block: departmentBlock[departmentCode],
    };
});
export const conflictSamples: never[] = [];
export const changeRequests: ChangeRequest[] = [];
export const dashboardStats = { departments: departments.length, sections: sections.length, faculty: faculty.length, teachingRooms: teachingRooms.length, laboratories: laboratories.length, blocks: blocks.length, sessionsScheduled: timetableEntries.length };
export const blocksWithFloors = blocks;

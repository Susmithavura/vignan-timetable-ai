const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
    const datasets = await prisma.timetableDataset.findMany({ orderBy: { createdAt: 'asc' } });
    const active = await prisma.timetableDataset.findFirst({ where: { status: 'ACTIVE' }, orderBy: { createdAt: 'desc' } });
    const payload = active ? JSON.parse(active.payload || '{}') : {};
    const counts = {
        departments: Array.isArray(payload.departments) ? payload.departments.length : 0,
        blocks: Array.isArray(payload.blocks) ? payload.blocks.length : 0,
        sections: Array.isArray(payload.sections) ? payload.sections.length : 0,
        faculty: Array.isArray(payload.faculty) ? payload.faculty.length : 0,
        courses: Array.isArray(payload.courses) ? payload.courses.length : 0,
        rooms: Array.isArray(payload.rooms) ? payload.rooms.length : 0,
        laboratories: Array.isArray(payload.laboratories) ? payload.laboratories.length : 0,
    };
    const totalEntries = await prisma.timetableEntry.count();
    const activeEntries = active ? await prisma.timetableEntry.count({ where: { datasetId: active.id } }) : 0;
    const firstRows = await prisma.timetableEntry.findMany({ take: 5, include: { course: true, section: true }, orderBy: { createdAt: 'asc' } });
    console.log(JSON.stringify({
        activeDataset: active ? { id: active.id, name: active.name, academicYear: active.academicYear, semester: active.semester, datasetType: active.datasetType, isActive: active.isActive, status: active.status, createdAt: active.createdAt, updatedAt: active.updatedAt } : null,
        payloadCounts: counts,
        sampleCourses: (payload.courses || []).slice(0, 5).map(c => ({ code: c.code || c.courseCode, name: c.name || c.courseName })),
        totalEntries,
        activeEntries,
        firstRows: firstRows.map(e => ({ course: e.course ? e.course.code + ' | ' + e.course.name : '', section: e.section ? e.section.name : '', createdAt: e.createdAt }))
    }, null, 2));
    process.exit(0);
})();

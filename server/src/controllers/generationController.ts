import type { Request, Response, NextFunction } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { successResponse } from '../utils/response.js';

type DatasetPayload = {
    name?: string;
    academicYear?: string;
    semester?: string;
    departments?: Array<{ code?: string; name?: string; id?: string }>;
    blocks?: Array<{ code?: string; name?: string; id?: string }>;
    faculty?: Array<{ id?: string; facultyId?: string; email?: string; name?: string; department?: string; dept?: string; designation?: string; weeklyLoad?: number; active?: boolean }>;
    sections?: Array<{ id?: string; section?: string; sectionName?: string; name?: string; department?: string; dept?: string; year?: string; semester?: string; strength?: number; block?: string; advisor?: string }>;
    courses?: Array<{ code?: string; courseCode?: string; name?: string; courseName?: string; department?: string; dept?: string; year?: string; semester?: string; type?: string; requiredPeriodsPerWeek?: number; periodsPerWeek?: number; isLab?: boolean }>;
    rooms?: Array<{ id?: string; roomId?: string; roomName?: string; roomNumber?: string; name?: string; block?: string; blockName?: string; floor?: string; capacity?: number; department?: string; roomType?: string; active?: boolean }>;
    laboratories?: Array<{ id?: string; labId?: string; name?: string; block?: string; blockName?: string; floor?: string; capacity?: number; labType?: string; type?: string; equipment?: string; active?: boolean }>;
    availability?: Array<{ facultyId?: string; day?: string; period?: string | number; available?: boolean; preferred?: boolean }>;
    allocations?: Array<{ facultyId?: string; courseCode?: string; sectionName?: string; department?: string }>;
    batches?: Array<{ sectionName?: string; name?: string; studentCount?: number }>;
    constraints?: Array<Record<string, unknown>>;
};

const readString = (value: unknown) => {
    if (value === undefined || value === null) return '';
    return String(value).trim();
};

const normalizeDepartmentCode = (value: string) => readString(value || 'UNKNOWN').replace(/\s+/g, '_').replace(/[^A-Z0-9_]/gi, '').toUpperCase() || 'UNKNOWN';

const parseActiveDatasetPayload = (payload: string | null | undefined): DatasetPayload | null => {
    if (!payload) return null;
    try {
        const parsed = JSON.parse(payload) as unknown;
        if (!parsed || typeof parsed !== 'object') return null;
        return parsed as DatasetPayload;
    } catch {
        return null;
    }
};

const ensureDay = async (tx: Prisma.TransactionClient, dayName: string) => {
    const normalized = readString(dayName) || 'Monday';
    const existing = await tx.workingDay.findFirst({ where: { name: normalized } });
    if (existing) return existing;
    const last = await tx.workingDay.findMany({ orderBy: { dayOrder: 'asc' } });
    return tx.workingDay.create({
        data: {
            name: normalized,
            dayOrder: (last.at(-1)?.dayOrder ?? 0) + 1,
        },
    });
};

const ensurePeriod = async (tx: Prisma.TransactionClient, periodNumber: number) => {
    const number = Number.isFinite(periodNumber) ? Number(periodNumber) : 1;
    const existing = await tx.period.findFirst({ where: { periodNumber: number } });
    if (existing) return existing;
    const last = await tx.period.findMany({ orderBy: { periodNumber: 'asc' } });
    const slotCount = Math.max(last.length, 0) + 1;
    return tx.period.create({
        data: {
            periodNumber: number,
            startTime: `09:${String((number - 1) * 50).padStart(2, '0')}`,
            endTime: `09:${String((number - 1) * 50 + 40).padStart(2, '0')}`,
        },
    });
};

const ensureDepartment = async (tx: Prisma.TransactionClient, departmentValue: string) => {
    const code = normalizeDepartmentCode(departmentValue);
    const name = readString(departmentValue) || 'Unknown Department';
    const existing = await tx.department.findUnique({ where: { code } });
    if (existing) return existing;
    return tx.department.create({ data: { code, name } });
};

const upsertMaterializedDataset = async (dataset: DatasetPayload) => {
    await prisma.$transaction(async (tx) => {
        const departmentMap = new Map<string, { id: string; code: string }>();
        for (const department of dataset.departments ?? []) {
            const record = await ensureDepartment(tx, readString(department.name ?? department.code ?? 'UNKNOWN'));
            departmentMap.set(normalizeDepartmentCode(readString(department.code ?? department.name ?? 'UNKNOWN')), { id: record.id, code: record.code });
        }

        for (const section of dataset.sections ?? []) {
            const departmentCode = normalizeDepartmentCode(readString(section.department ?? section.dept ?? 'UNKNOWN'));
            const department = departmentMap.get(departmentCode) ?? await ensureDepartment(tx, readString(section.department ?? section.dept ?? 'UNKNOWN'));
            const sectionName = readString(section.section ?? section.sectionName ?? section.name ?? 'SECTION');
            const strength = Number(section.strength ?? 0) || 60;
            await tx.section.upsert({
                where: { departmentId_name: { departmentId: department.id, name: sectionName } },
                update: {
                    year: readString(section.year ?? '1'),
                    semester: readString(section.semester ?? '1'),
                    strength,
                    assignedBlock: readString(section.block ?? 'A Block'),
                    advisor: readString(section.advisor ?? 'Academic Office'),
                },
                create: {
                    name: sectionName,
                    year: readString(section.year ?? '1'),
                    semester: readString(section.semester ?? '1'),
                    departmentId: department.id,
                    strength,
                    assignedBlock: readString(section.block ?? 'A Block'),
                    advisor: readString(section.advisor ?? 'Academic Office'),
                },
            });
        }

        for (const facultyMember of dataset.faculty ?? []) {
            const departmentValue = readString(facultyMember.department ?? facultyMember.dept ?? 'UNKNOWN');
            const department = departmentMap.get(normalizeDepartmentCode(departmentValue)) ?? await ensureDepartment(tx, departmentValue);
            const facultyId = readString(
                facultyMember.facultyId ??
                facultyMember.id ??
                facultyMember.email ??
                facultyMember.name ??
                'FACULTY'
            );
            const email = readString(facultyMember.email ?? `${facultyId.replace(/\s+/g, '.').toLowerCase()}@college.edu`);
            await tx.faculty.upsert({
                where: { facultyId },
                update: {
                    name: readString(facultyMember.name ?? 'Unknown Faculty'),
                    designation: readString(facultyMember.designation ?? 'Assistant Professor'),
                    departmentId: department.id,
                    email,
                    weeklyLoad: Number(facultyMember.weeklyLoad ?? 14),
                    active: facultyMember.active !== false,
                },
                create: {
                    facultyId,
                    name: readString(facultyMember.name ?? 'Unknown Faculty'),
                    designation: readString(facultyMember.designation ?? 'Assistant Professor'),
                    departmentId: department.id,
                    email,
                    weeklyLoad: Number(facultyMember.weeklyLoad ?? 14),
                    active: facultyMember.active !== false,
                },
            });
        }

        for (const course of dataset.courses ?? []) {
            const departmentValue = readString(course.department ?? course.dept ?? 'UNKNOWN');
            const department = departmentMap.get(normalizeDepartmentCode(departmentValue)) ?? await ensureDepartment(tx, departmentValue);
            const code = readString(course.code ?? course.courseCode ?? 'COURSE');
            const courseName = readString(course.name ?? course.courseName ?? 'Course');
            const isLab = course.isLab ?? /lab/i.test(readString(course.type ?? courseName));
            await tx.course.upsert({
                where: { code },
                update: {
                    name: courseName,
                    departmentId: department.id,
                    year: readString(course.year ?? '1'),
                    semester: readString(course.semester ?? '1'),
                    type: readString(course.type ?? (isLab ? 'LAB' : 'THEORY')).toUpperCase(),
                    requiredPeriodsPerWeek: Number(course.requiredPeriodsPerWeek ?? course.periodsPerWeek ?? 4),
                    isLab,
                },
                create: {
                    code,
                    name: courseName,
                    departmentId: department.id,
                    year: readString(course.year ?? '1'),
                    semester: readString(course.semester ?? '1'),
                    type: readString(course.type ?? (isLab ? 'LAB' : 'THEORY')).toUpperCase(),
                    requiredPeriodsPerWeek: Number(course.requiredPeriodsPerWeek ?? course.periodsPerWeek ?? 4),
                    isLab,
                },
            });
        }

        for (const block of dataset.blocks ?? []) {
            const blockName = readString(block.name ?? block.code ?? 'A Block');
            if (!blockName) continue;
            await tx.block.upsert({
                where: { name: blockName },
                update: {},
                create: { name: blockName },
            });
        }

        for (const blockName of Array.from(new Set([...(dataset.rooms ?? []).map((room) => readString(room.block ?? room.blockName ?? 'A Block')), ...(dataset.laboratories ?? []).map((lab) => readString(lab.block ?? lab.blockName ?? 'A Block'))]))) {
            if (!blockName) continue;
            await tx.block.upsert({
                where: { name: blockName },
                update: {},
                create: { name: blockName },
            });
        }

        for (const room of dataset.rooms ?? []) {
            const blockName = readString(room.block ?? room.blockName ?? 'A Block');
            const block = await tx.block.upsert({
                where: { name: blockName },
                update: {},
                create: { name: blockName },
            });
            const roomName = readString(room.roomName ?? room.roomNumber ?? room.name ?? 'ROOM');
            await tx.room.upsert({
                where: { blockId_roomName: { blockId: block.id, roomName } },
                update: {
                    floor: readString(room.floor ?? 'Ground Floor'),
                    capacity: Number(room.capacity ?? 0) || 60,
                    roomType: readString(room.roomType ?? 'TEACHING_ROOM'),
                    department: normalizeDepartmentCode(readString(room.department ?? 'UNKNOWN')),
                    active: room.active !== false,
                },
                create: {
                    roomName,
                    blockId: block.id,
                    floor: readString(room.floor ?? 'Ground Floor'),
                    capacity: Number(room.capacity ?? 0) || 60,
                    roomType: readString(room.roomType ?? 'TEACHING_ROOM'),
                    department: normalizeDepartmentCode(readString(room.department ?? 'UNKNOWN')),
                    active: room.active !== false,
                },
            });
        }

        for (const lab of dataset.laboratories ?? []) {
            const blockName = readString(lab.block ?? lab.blockName ?? 'A Block');
            const block = await tx.block.upsert({
                where: { name: blockName },
                update: {},
                create: { name: blockName },
            });
            const labName = readString(lab.name ?? 'LAB');
            await tx.laboratory.upsert({
                where: { blockId_name: { blockId: block.id, name: labName } },
                update: {
                    floor: readString(lab.floor ?? 'Ground Floor'),
                    capacity: Number(lab.capacity ?? 0) || 30,
                    labType: readString(lab.labType ?? lab.type ?? 'Computer'),
                    equipment: readString(lab.equipment ?? 'General'),
                    active: lab.active !== false,
                },
                create: {
                    name: labName,
                    blockId: block.id,
                    floor: readString(lab.floor ?? 'Ground Floor'),
                    capacity: Number(lab.capacity ?? 0) || 30,
                    labType: readString(lab.labType ?? lab.type ?? 'Computer'),
                    equipment: readString(lab.equipment ?? 'General'),
                    active: lab.active !== false,
                },
            });
        }

        for (const availability of dataset.availability ?? []) {
            const facultyRecord = await tx.faculty.findFirst({ where: { facultyId: readString(availability.facultyId ?? '') } });
            if (!facultyRecord) continue;
            const day = await ensureDay(tx, readString(availability.day ?? 'Monday'));
            const periodNumber = Number(availability.period ?? 1);
            const period = await ensurePeriod(tx, periodNumber);
            await tx.facultyAvailability.upsert({
                where: { facultyId_dayId_periodId: { facultyId: facultyRecord.id, dayId: day.id, periodId: period.id } },
                update: {
                    available: availability.available !== false,
                    preferred: Boolean(availability.preferred),
                },
                create: {
                    facultyId: facultyRecord.id,
                    dayId: day.id,
                    periodId: period.id,
                    available: availability.available !== false,
                    preferred: Boolean(availability.preferred),
                },
            });
        }

        for (const allocation of dataset.allocations ?? []) {
            const facultyId = readString(allocation.facultyId ?? '');
            const courseCode = readString(allocation.courseCode ?? '');
            const sectionName = readString(allocation.sectionName ?? '');
            if (!facultyId || !courseCode || !sectionName) continue;
            const facultyRecord = await tx.faculty.findFirst({ where: { facultyId } });
            const courseRecord = await tx.course.findUnique({ where: { code: courseCode } });
            if (!facultyRecord || !courseRecord) continue;
            const sectionRecord = await tx.section.findFirst({ where: { name: sectionName } });
            if (!sectionRecord) continue;
            await tx.courseSection.upsert({
                where: { courseId_sectionId: { courseId: courseRecord.id, sectionId: sectionRecord.id } },
                update: {},
                create: { courseId: courseRecord.id, sectionId: sectionRecord.id },
            });
            await tx.facultyCourse.upsert({
                where: { facultyId_courseId: { facultyId: facultyRecord.id, courseId: courseRecord.id } },
                update: {},
                create: { facultyId: facultyRecord.id, courseId: courseRecord.id },
            });
        }

        for (const batch of dataset.batches ?? []) {
            const sectionName = readString(batch.sectionName ?? '');
            const batchName = readString(batch.name ?? 'BATCH');
            const sectionRecord = await tx.section.findFirst({ where: { name: sectionName } });
            if (!sectionRecord || !batchName) continue;
            await tx.labBatch.upsert({
                where: { sectionId_name: { sectionId: sectionRecord.id, name: batchName } },
                update: { studentCount: Number(batch.studentCount ?? 0) || sectionRecord.strength },
                create: { sectionId: sectionRecord.id, name: batchName, studentCount: Number(batch.studentCount ?? 0) || sectionRecord.strength },
            });
        }
    });
};

export const generateTimetable = async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const activeDataset = await prisma.timetableDataset.findFirst({
            where: { status: 'ACTIVE' },
            orderBy: { createdAt: 'desc' },
        });

        if (!activeDataset) {
            throw new AppError('No active imported dataset was found. Import a valid Excel dataset and activate it before generating a timetable.', 409);
        }

        const parsed = parseActiveDatasetPayload(activeDataset.payload);
        if (!parsed) {
            throw new AppError('The active dataset payload could not be parsed. Import a valid college dataset and try again.', 422);
        }

        console.log('[generateTimetable] ACTIVE_DATASET_ID', activeDataset.id);
        console.log('[generateTimetable] ACTIVE_DATASET_NAME', activeDataset.name);
        console.log('[generateTimetable] IMPORTED_COUNTS', {
            departments: parsed.departments?.length ?? 0,
            blocks: parsed.blocks?.length ?? 0,
            sections: parsed.sections?.length ?? 0,
            faculty: parsed.faculty?.length ?? 0,
            courses: parsed.courses?.length ?? 0,
            rooms: parsed.rooms?.length ?? 0,
            laboratories: parsed.laboratories?.length ?? 0,
        });

        await upsertMaterializedDataset(parsed);

        const [sections, days, periods, rooms, laboratories, facultyAssignments, availability] = await Promise.all([
            prisma.section.findMany({ include: { courseSections: { include: { course: true } }, labBatches: true }, orderBy: { name: 'asc' } }),
            prisma.workingDay.findMany({ orderBy: { dayOrder: 'asc' } }),
            prisma.period.findMany({ orderBy: { periodNumber: 'asc' } }),
            prisma.room.findMany({ where: { active: true, roomType: 'TEACHING_ROOM' } }),
            prisma.laboratory.findMany({ where: { active: true } }),
            prisma.facultyCourse.findMany({ include: { faculty: true } }),
            prisma.facultyAvailability.findMany(),
        ]);

        const assignments = new Map<string, typeof facultyAssignments>();
        facultyAssignments.forEach((assignment) => assignments.set(assignment.courseId, [...(assignments.get(assignment.courseId) ?? []), assignment]));
        const available = new Set(availability.filter((slot) => slot.available).map((slot) => `${slot.facultyId}:${slot.dayId}:${slot.periodId}`));

        const usedFaculty = new Set<string>();
        const usedRooms = new Set<string>();
        const usedLabs = new Set<string>();
        const generated: Prisma.TimetableEntryCreateManyInput[] = [];
        const failures: string[] = [];

        for (const section of sections) {
            const sectionRooms = rooms.filter((room) => room.capacity >= section.strength);
            const sectionLabs = laboratories.filter((lab) => lab.capacity >= Math.ceil(section.strength / 2));
            for (const courseSection of section.courseSections) {
                const course = courseSection.course;
                const courseFaculty = assignments.get(course.id) ?? [];
                let scheduled = 0;

                for (let occurrence = 0; occurrence < course.requiredPeriodsPerWeek; occurrence += 1) {
                    let placed = false;
                    for (const day of days) {
                        for (const period of periods) {
                            const sectionKey = `${section.id}:${day.id}:${period.id}`;
                            if (generated.some((entry) => `${entry.sectionId}:${entry.dayId}:${entry.periodId}` === sectionKey)) continue;

                            const facultyAssignment = courseFaculty.find((candidate) => available.has(`${candidate.facultyId}:${day.id}:${period.id}`) && !usedFaculty.has(`${candidate.facultyId}:${day.id}:${period.id}`));
                            if (!facultyAssignment) continue;

                            const slotKey = `${day.id}:${period.id}`;
                            const room = course.isLab ? null : sectionRooms.find((candidate) => !usedRooms.has(`${candidate.id}:${slotKey}`));
                            const lab = course.isLab ? sectionLabs.find((candidate) => !usedLabs.has(`${candidate.id}:${slotKey}`)) : null;
                            if (!room && !lab) continue;

                            const batch = course.isLab ? section.labBatches[occurrence % Math.max(section.labBatches.length, 1)] ?? null : null;
                            if (course.isLab && !batch) continue;

                            generated.push({
                                datasetId: activeDataset.id,
                                sectionId: section.id,
                                courseId: course.id,
                                facultyId: facultyAssignment.facultyId,
                                roomId: room?.id ?? null,
                                laboratoryId: lab?.id ?? null,
                                labBatchId: batch?.id ?? null,
                                dayId: day.id,
                                periodId: period.id,
                                entryType: course.isLab ? 'LAB' : 'THEORY',
                            });

                            usedFaculty.add(`${facultyAssignment.facultyId}:${day.id}:${period.id}`);
                            if (room) usedRooms.add(`${room.id}:${slotKey}`);
                            if (lab) usedLabs.add(`${lab.id}:${slotKey}`);
                            scheduled += 1;
                            placed = true;
                            break;
                        }
                        if (placed) break;
                    }
                }

                if (scheduled !== course.requiredPeriodsPerWeek) {
                    failures.push(`Unable to schedule ${course.code} for ${section.name}: only ${scheduled} of ${course.requiredPeriodsPerWeek} required periods could be placed with available faculty and compatible ${course.isLab ? 'laboratory capacity' : 'rooms'}.`);
                }
            }
        }

        if (failures.length > 0) throw new AppError(failures.slice(0, 10).join(' '), 409);

        const beforeCount = await prisma.timetableEntry.count({ where: { datasetId: activeDataset.id } });
        console.log('[generateTimetable] GENERATED_ENTRY_COUNT', generated.length);

        await prisma.$transaction(async (transaction) => {
            await transaction.timetableEntry.deleteMany({ where: { datasetId: activeDataset.id } });
            await transaction.timetableEntry.createMany({ data: generated });
        });

        const persistedCount = await prisma.timetableEntry.count({ where: { datasetId: activeDataset.id } });
        const databaseEntryCountAfterGeneration = await prisma.timetableEntry.count();

        console.log('[generateTimetable] PERSISTED_ENTRY_COUNT', persistedCount);
        console.log('[generateTimetable] DATABASE_ENTRY_COUNT_AFTER_GENERATION', databaseEntryCountAfterGeneration);

        await prisma.timetableDataset.update({
            where: { id: activeDataset.id },
            data: {
                generated: JSON.stringify(generated),
                status: 'ACTIVE',
                updatedAt: new Date(),
            },
        });

        const cse3Section = await prisma.section.findFirst({ where: { name: 'CSE-03' } });
        const cse3Entries = cse3Section ? await prisma.timetableEntry.count({ where: { datasetId: activeDataset.id, sectionId: cse3Section.id } }) : 0;

        console.log('[generateTimetable] persisted rows', {
            beforeCount,
            persistedCount,
            generatedEntries: generated.length,
            datasetId: activeDataset.id,
            cse3SectionId: cse3Section?.id ?? null,
            cse3Entries,
        });

        res.json(successResponse({
            generatedEntries: generated.length,
            sectionsProcessed: sections.length,
            conflicts: 0,
            datasetId: activeDataset.id,
        }));
    } catch (error) {
        next(error);
    }
};

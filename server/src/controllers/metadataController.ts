import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { successResponse } from '../utils/response.js';
import { requiredRouteParam } from '../utils/routeParam.js';

export const getBlocks = async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const blocks = await prisma.block.findMany({ orderBy: { name: 'asc' } });
        res.json(successResponse(blocks));
    } catch (error) {
        next(error);
    }
};

export const getRooms = async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const rooms = await prisma.room.findMany({
            orderBy: { roomName: 'asc' },
            include: { block: true },
        });
        res.json(successResponse(rooms));
    } catch (error) {
        next(error);
    }
};

export const getLaboratories = async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const labs = await prisma.laboratory.findMany({
            orderBy: { name: 'asc' },
            include: { block: true },
        });
        res.json(successResponse(labs));
    } catch (error) {
        next(error);
    }
};

export const getAvailability = async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const availability = await prisma.facultyAvailability.findMany({
            include: { faculty: true },
            orderBy: { facultyId: 'asc' },
        });
        res.json(successResponse(availability));
    } catch (error) {
        next(error);
    }
};

export const getLabBatches = async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const batches = await prisma.labBatch.findMany({
            include: {
                section: { include: { department: true } },
                timetableEntries: { include: { course: true, faculty: true, laboratory: { include: { block: true } } } },
            },
            orderBy: [{ sectionId: 'asc' }, { name: 'asc' }],
        });
        const days = await prisma.workingDay.findMany();
        const periods = await prisma.period.findMany();
        const dayNames = new Map(days.map((day) => [day.id, day.name]));
        const periodNames = new Map(periods.map((period) => [period.id, `P${period.periodNumber}`]));
        res.json(successResponse(batches.map((batch) => {
            const scheduled = batch.timetableEntries[0];
            return {
                id: batch.id,
                sectionId: batch.sectionId,
                section: batch.section.name,
                department: batch.section.department.code,
                course: scheduled?.course.name ?? 'Not scheduled',
                batch: batch.name,
                studentCount: batch.studentCount,
                laboratory: scheduled?.laboratory?.name ?? 'Not assigned',
                block: scheduled?.laboratory?.block.name ?? null,
                faculty: scheduled?.faculty?.name ?? 'Unassigned',
                day: scheduled ? dayNames.get(scheduled.dayId) ?? scheduled.dayId : null,
                period: scheduled ? periodNames.get(scheduled.periodId) ?? scheduled.periodId : null,
            };
        })));
    } catch (error) {
        next(error);
    }
};

export const createLabBatch = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { sectionId, name, studentCount } = req.body;
        if (!sectionId || !name || !studentCount) {
            throw new AppError('Section ID, batch name, and student count are required.', 400);
        }

        const section = await prisma.section.findFirst({
            where: { OR: [{ id: sectionId }, { name: sectionId }] },
            include: { labBatches: true },
        });
        if (!section) throw new AppError('Section not found', 404);

        const currentTotal = section.labBatches.reduce((sum, b) => sum + b.studentCount, 0);
        if (currentTotal + Number(studentCount) > section.strength * 1.25) {
            throw new AppError(`Total students in batches (${currentTotal + Number(studentCount)}) exceeds section strength (${section.strength}).`, 400);
        }

        const batch = await prisma.labBatch.create({
            data: {
                sectionId: section.id,
                name: String(name).trim(),
                studentCount: Number(studentCount),
            },
            include: { section: { include: { department: true } } },
        });

        res.status(201).json(successResponse({
            id: batch.id,
            sectionId: batch.sectionId,
            section: batch.section.name,
            department: batch.section.department.code,
            course: 'Not scheduled',
            batch: batch.name,
            studentCount: batch.studentCount,
            laboratory: 'Not assigned',
            block: null,
            faculty: 'Unassigned',
            day: null,
            period: null,
        }));
    } catch (error) {
        next(error);
    }
};

export const updateLabBatch = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = requiredRouteParam(req, 'id');
        const { name, studentCount } = req.body;
        const batch = await prisma.labBatch.update({
            where: { id },
            data: {
                ...(name ? { name: String(name).trim() } : {}),
                ...(studentCount !== undefined ? { studentCount: Number(studentCount) } : {}),
            },
            include: { section: { include: { department: true } } },
        });
        res.json(successResponse({
            id: batch.id,
            sectionId: batch.sectionId,
            section: batch.section.name,
            department: batch.section.department.code,
            batch: batch.name,
            studentCount: batch.studentCount,
        }));
    } catch (error) {
        next(error);
    }
};

export const deleteLabBatch = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = requiredRouteParam(req, 'id');
        await prisma.$transaction(async (tx) => {
            await tx.timetableEntry.updateMany({
                where: { labBatchId: id },
                data: { labBatchId: null },
            });
            await tx.labBatch.delete({ where: { id } });
        });
        res.json(successResponse({ id, deleted: true }));
    } catch (error) {
        next(error);
    }
};

export const getTimetable = async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const activeDataset = await prisma.timetableDataset.findFirst({
            where: { status: 'ACTIVE' },
            orderBy: { createdAt: 'desc' },
        });

        if (!activeDataset) {
            res.json(successResponse([]));
            return;
        }

        const timetableEntries = await prisma.timetableEntry.findMany({
            where: { datasetId: activeDataset.id },
            include: {
                section: { include: { department: true } },
                course: { include: { department: true } },
                faculty: true,
                room: { include: { block: true } },
                laboratory: { include: { block: true } },
                labBatch: true,
            },
            orderBy: [{ sectionId: 'asc' }, { periodId: 'asc' }],
        });

        const days = await prisma.workingDay.findMany({ orderBy: { dayOrder: 'asc' } });
        const periods = await prisma.period.findMany({ orderBy: { periodNumber: 'asc' } });
        const dayNames = new Map(days.map((day) => [day.id, day.name]));
        const periodNames = new Map(periods.map((period) => [period.id, `P${period.periodNumber}`]));

        const mappedTimetable = timetableEntries.map((entry) => ({
            id: entry.id,
            section: entry.section.name,
            sectionId: entry.section.name,
            department: entry.section.department.code,
            year: entry.section.year,
            course: entry.course.name,
            courseCode: entry.course.code,
            faculty: entry.faculty?.name ?? 'Unassigned',
            room: entry.room?.roomName ?? null,
            block: entry.room?.block.name ?? entry.laboratory?.block.name ?? null,
            laboratory: entry.laboratory?.name ?? null,
            labBatch: entry.labBatch?.name ?? null,
            day: dayNames.get(entry.dayId) ?? entry.dayId,
            period: periodNames.get(entry.periodId) ?? entry.periodId,
            type: entry.entryType === 'LAB' ? 'Laboratory' : 'Theory',
            entryType: entry.entryType,
            datasetId: entry.datasetId ?? activeDataset?.id ?? null,
        }));

        console.log('[getTimetable] active dataset and entries', {
            activeDatasetId: activeDataset?.id ?? null,
            activeDatasetName: activeDataset?.name ?? null,
            returnedRows: mappedTimetable.length,
            cse3Rows: mappedTimetable.filter((row) => row.section === 'CSE-03').length,
        });

        res.json(successResponse(mappedTimetable));
    } catch (error) {
        next(error);
    }
};

export const getConflicts = async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const [entries, days, periods, availability] = await Promise.all([
            prisma.timetableEntry.findMany({ include: { section: true, course: true, faculty: true, room: true, laboratory: true, labBatch: true } }),
            prisma.workingDay.findMany(),
            prisma.period.findMany(),
            prisma.facultyAvailability.findMany(),
        ]);
        const dayMap = new Map(days.map((day) => [day.id, day.name]));
        const periodMap = new Map(periods.map((period) => [period.id, `P${period.periodNumber}`]));
        const conflicts: Array<Record<string, unknown>> = [];
        const groups = new Map<string, typeof entries>();

        for (const entry of entries) {
            const key = `${entry.dayId}|${entry.periodId}`;
            groups.set(key, [...(groups.get(key) ?? []), entry]);
        }

        for (const group of groups.values()) {
            const day = dayMap.get(group[0].dayId) ?? group[0].dayId;
            const period = periodMap.get(group[0].periodId) ?? group[0].periodId;

            const checkDuplicate = (type: string, values: Array<string | null | undefined>) => {
                const seen = new Map<string, typeof group>();
                values.forEach((value, index) => {
                    if (value) seen.set(value, [...(seen.get(value) ?? []), group[index]]);
                });
                for (const [, matches] of seen) {
                    if (matches.length > 1) {
                        const resourceLabel = type.includes('Faculty')
                            ? (matches[0].faculty?.name ?? 'Unknown Faculty')
                            : type.includes('Room')
                                ? (matches[0].room?.roomName ?? 'Unknown Room')
                                : type.includes('Laboratory')
                                    ? (matches[0].laboratory?.name ?? 'Unknown Laboratory')
                                    : (matches[0].section?.name ?? 'Unknown Section');

                        conflicts.push({
                            type,
                            day,
                            period,
                            resource: resourceLabel,
                            detail: `${resourceLabel} is double-booked across ${matches.map((m) => `${m.section.name} (${m.course.name})`).join(' and ')} on ${day} ${period}.`,
                            entries: matches.map((entry) => ({
                                section: entry.section.name,
                                course: entry.course.name,
                                faculty: entry.faculty?.name ?? 'Unassigned',
                                room: entry.room?.roomName ?? entry.laboratory?.name ?? null,
                            })),
                        });
                    }
                }
            };

            checkDuplicate('Faculty Conflict', group.map((entry) => entry.facultyId));
            checkDuplicate('Room Conflict', group.map((entry) => entry.roomId));
            checkDuplicate('Laboratory Conflict', group.map((entry) => entry.laboratoryId));
            checkDuplicate('Section Conflict', group.map((entry) => entry.sectionId));

            for (const entry of group) {
                const capacity = entry.room?.capacity ?? entry.laboratory?.capacity;
                const assignedStudents = entry.room ? entry.section.strength : entry.labBatch?.studentCount ?? entry.section.strength;
                const resourceName = entry.room?.roomName ?? entry.laboratory?.name ?? 'Resource';

                if (capacity && assignedStudents > capacity) {
                    conflicts.push({
                        type: 'Capacity Conflict',
                        day,
                        period,
                        resource: resourceName,
                        entries: [{ section: entry.section.name, course: entry.course.name, faculty: entry.faculty?.name ?? 'Unassigned', room: resourceName }],
                        detail: `${assignedStudents} students in ${entry.section.name} exceed capacity of ${resourceName} (${capacity} seats).`,
                    });
                }

                if (entry.facultyId && !availability.some((slot) => slot.facultyId === entry.facultyId && slot.dayId === entry.dayId && slot.periodId === entry.periodId && slot.available)) {
                    conflicts.push({
                        type: 'Faculty Availability Conflict',
                        day,
                        period,
                        resource: entry.faculty?.name ?? 'Faculty',
                        entries: [{ section: entry.section.name, course: entry.course.name, faculty: entry.faculty?.name ?? 'Unassigned', room: resourceName }],
                        detail: `${entry.faculty?.name ?? 'Faculty'} is marked unavailable on ${day} ${period} for ${entry.course.name} (${entry.section.name}).`,
                    });
                }
            }
        }
        res.json(successResponse(conflicts));
    } catch (error) {
        next(error);
    }
};

export const getAnalytics = async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const [entries, sections, faculty, rooms, laboratories, days, periods] = await Promise.all([
            prisma.timetableEntry.findMany({ include: { section: { include: { department: true } }, course: true, faculty: true, room: true, laboratory: true } }),
            prisma.section.findMany(),
            prisma.faculty.findMany(),
            prisma.room.findMany({ include: { block: true } }),
            prisma.laboratory.findMany({ include: { block: true } }),
            prisma.workingDay.findMany({ orderBy: { dayOrder: 'asc' } }),
            prisma.period.findMany({ orderBy: { periodNumber: 'asc' } }),
        ]);
        const slotCount = days.length * periods.length;
        const countBy = (items: string[]) => items.reduce<Record<string, number>>((result, item) => { result[item] = (result[item] ?? 0) + 1; return result; }, {});
        const facultyCounts = countBy(entries.map((entry) => entry.faculty?.name ?? 'Unassigned'));
        const roomCounts = countBy(entries.map((entry) => entry.room?.roomName ?? 'Laboratory session'));
        const labCounts = countBy(entries.filter((entry) => entry.laboratory).map((entry) => entry.laboratory!.name));
        const departmentCounts = countBy(entries.map((entry) => entry.section.department.code));
        const dayCounts = countBy(entries.map((entry) => days.find((day) => day.id === entry.dayId)?.name ?? entry.dayId));
        res.json(successResponse({
            scheduledSessions: entries.length,
            freePeriods: Math.max(sections.length * slotCount - entries.length, 0),
            facultyUtilisation: faculty.map((member) => ({ name: member.name, value: facultyCounts[member.name] ?? 0 })),
            roomUtilisation: rooms.map((room) => ({ name: room.roomName, block: room.block.name, value: roomCounts[room.roomName] ?? 0, percentage: slotCount ? Math.round(((roomCounts[room.roomName] ?? 0) / slotCount) * 100) : 0 })),
            laboratoryUtilisation: laboratories.map((lab) => ({ name: lab.name, block: lab.block.name, value: labCounts[lab.name] ?? 0, percentage: slotCount ? Math.round(((labCounts[lab.name] ?? 0) / slotCount) * 100) : 0 })),
            sessionsByDepartment: Object.entries(departmentCounts).map(([name, value]) => ({ name, value })),
            sessionsByDay: days.map((day) => ({ name: day.name, value: dayCounts[day.name] ?? 0 })),
            theorySessions: entries.filter((entry) => entry.entryType !== 'LAB').length,
            laboratorySessions: entries.filter((entry) => entry.entryType === 'LAB').length,
            facultyWorkload: faculty.map((member) => ({ name: member.name, value: facultyCounts[member.name] ?? 0 })),
            roomOccupancy: roomCounts,
        }));
    } catch (error) {
        next(error);
    }
};

const parseChangeRequestDescription = (description: string | null | undefined) => {
    if (!description) return null;
    try {
        return JSON.parse(description);
    } catch {
        return description;
    }
};

const formatChangeRequest = (request: Record<string, unknown>) => {
    const parsed = parseChangeRequestDescription(typeof request.description === 'string' ? request.description : null);
    return {
        ...request,
        description: parsed && typeof parsed === 'object' ? parsed : request.description,
        details: parsed && typeof parsed === 'object' ? parsed : null,
    };
};

const buildConflictReport = (conflicts: Array<Record<string, unknown>>, suggestions: string[] = []) => ({
    success: false,
    message: 'Unable to apply timetable change',
    data: {
        conflicts,
        suggestions,
    },
});

export const getChangeRequests = async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const requests = await prisma.changeRequest.findMany({ orderBy: { createdAt: 'desc' } });
        res.json(successResponse(requests.map((request) => formatChangeRequest(request as Record<string, unknown>))));
    } catch (error) {
        next(error);
    }
};

export const getChangeRequestById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = requiredRouteParam(req, 'id');
        const request = await prisma.changeRequest.findUnique({ where: { id } });
        if (!request) throw new AppError('Change request not found.', 404);
        res.json(successResponse(formatChangeRequest(request as Record<string, unknown>)));
    } catch (error) {
        next(error);
    }
};

export const createChangeRequest = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const payload = req.body ?? {};
        const requestedBy = String(payload.requestedBy || payload.requester || 'academic@vignan.edu');
        const status = String(payload.status || 'PENDING');
        const description = payload.description ?? payload.details ?? payload;

        if (!description) throw new AppError('Description is required.', 400);

        const request = await prisma.changeRequest.create({
            data: {
                requestedBy,
                description: typeof description === 'string' ? description.trim() : JSON.stringify(description),
                status: ['PENDING', 'APPROVED', 'REJECTED', 'APPLIED'].includes(status) ? status : 'PENDING',
            },
        });
        res.status(201).json(successResponse(formatChangeRequest(request as Record<string, unknown>)));
    } catch (error) {
        next(error);
    }
};

export const updateChangeRequest = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = requiredRouteParam(req, 'id');
        const { status, description } = req.body;
        const request = await prisma.changeRequest.update({
            where: { id },
            data: {
                ...(status ? { status: ['PENDING', 'APPROVED', 'REJECTED', 'APPLIED'].includes(String(status)) ? String(status) : 'PENDING' } : {}),
                ...(description ? { description: String(description) } : {}),
                reviewedAt: new Date(),
            },
        });
        res.json(successResponse(formatChangeRequest(request as Record<string, unknown>)));
    } catch (error) {
        next(error);
    }
};

export const approveChangeRequest = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = requiredRouteParam(req, 'id');
        const request = await prisma.changeRequest.update({
            where: { id },
            data: { status: 'APPROVED', reviewedAt: new Date() },
        });
        res.json(successResponse(formatChangeRequest(request as Record<string, unknown>)));
    } catch (error) {
        next(error);
    }
};

export const rejectChangeRequest = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = requiredRouteParam(req, 'id');
        const request = await prisma.changeRequest.update({
            where: { id },
            data: { status: 'REJECTED', reviewedAt: new Date() },
        });
        res.json(successResponse(formatChangeRequest(request as Record<string, unknown>)));
    } catch (error) {
        next(error);
    }
};

const getFacultyReplacement = async (facultyId: string, dayId: string, periodId: string) => {
    const currentEntries = await prisma.timetableEntry.findMany({
        where: { facultyId, dayId, periodId },
        include: { course: true, section: true },
    });

    if (!currentEntries.length) {
        return { replacements: [], conflicts: [] as Array<Record<string, unknown>> };
    }

    const day = await prisma.workingDay.findUnique({ where: { id: dayId } });
    const period = await prisma.period.findUnique({ where: { id: periodId } });
    const conflicts: Array<Record<string, unknown>> = [];
    const replacements: Array<Record<string, unknown>> = [];

    for (const entry of currentEntries) {
        const facultyAssignments = await prisma.facultyCourse.findMany({
            where: { courseId: entry.courseId },
            include: { faculty: true },
        });

        for (const assignment of facultyAssignments) {
            if (assignment.facultyId === facultyId) continue;
            const facultyRecord = assignment.faculty;
            if (!facultyRecord.active) continue;

            const availability = await prisma.facultyAvailability.findFirst({
                where: {
                    facultyId: assignment.facultyId,
                    dayId,
                    periodId,
                    available: true,
                },
            });
            if (!availability) continue;

            const sectionConflict = await prisma.timetableEntry.findFirst({
                where: {
                    sectionId: entry.sectionId,
                    dayId,
                    periodId,
                    id: { not: entry.id },
                },
            });
            if (sectionConflict) {
                conflicts.push({
                    type: 'SECTION_CONFLICT',
                    severity: 'HARD',
                    day: day?.name ?? dayId,
                    period: Number(period?.periodNumber ?? 0),
                    facultyId: assignment.facultyId,
                    message: `Section ${entry.section.name} already has a class assigned during the target slot.`,
                });
                continue;
            }

            const facultyConflict = await prisma.timetableEntry.findFirst({
                where: {
                    facultyId: assignment.facultyId,
                    dayId,
                    periodId,
                    id: { not: entry.id },
                },
            });
            if (facultyConflict) continue;

            replacements.push({
                facultyId: assignment.facultyId,
                facultyName: facultyRecord.name,
                courseId: entry.courseId,
                courseCode: entry.course.code,
                day: day?.name ?? dayId,
                period: Number(period?.periodNumber ?? 0),
            });
        }
    }

    return { replacements, conflicts };
};

const getRoomReplacement = async (roomId: string, dayId: string, periodId: string) => {
    const room = await prisma.room.findUnique({ where: { id: roomId }, include: { block: true } });
    if (!room) return { replacements: [], conflicts: [] as Array<Record<string, unknown>> };

    const affectedEntries = await prisma.timetableEntry.findMany({
        where: { roomId, dayId, periodId },
        include: { section: true, course: true, labBatch: true },
    });

    if (!affectedEntries.length) {
        return { replacements: [], conflicts: [] as Array<Record<string, unknown>> };
    }

    const day = await prisma.workingDay.findUnique({ where: { id: dayId } });
    const period = await prisma.period.findUnique({ where: { id: periodId } });
    const replacements: Array<Record<string, unknown>> = [];
    const conflicts: Array<Record<string, unknown>> = [];

    const alternatives = await prisma.room.findMany({
        where: { active: true, roomType: 'TEACHING_ROOM' },
        include: { block: true },
    });

    for (const entry of affectedEntries) {
        const candidatePool = alternatives.filter((candidate) => candidate.capacity >= entry.section.strength && candidate.id !== roomId);
        const candidateIds = candidatePool.map((candidate) => candidate.id);
        const occupiedEntries = await Promise.all(candidateIds.map(async (candidateId) => prisma.timetableEntry.findFirst({
            where: { roomId: candidateId, dayId, periodId },
        })));
        const match = candidatePool.filter((candidate, index) => !occupiedEntries[index]);
        if (!match.length) {
            conflicts.push({
                type: 'ROOM_CONFLICT',
                severity: 'HARD',
                day: day?.name ?? dayId,
                period: Number(period?.periodNumber ?? 0),
                roomId,
                message: `No compatible room is available for ${entry.section.name} (${entry.course.code}).`,
            });
            continue;
        }
        replacements.push({ entryId: entry.id, section: entry.section.name, candidates: match.map((candidate) => ({ roomId: candidate.id, roomName: candidate.roomName, capacity: candidate.capacity, block: candidate.block.name })) });
    }

    return { replacements, conflicts };
};

const getLabReplacement = async (laboratoryId: string, dayId: string, periodId: string) => {
    const lab = await prisma.laboratory.findUnique({ where: { id: laboratoryId }, include: { block: true } });
    if (!lab) return { replacements: [], conflicts: [] as Array<Record<string, unknown>> };

    const affectedEntries = await prisma.timetableEntry.findMany({
        where: { laboratoryId, dayId, periodId },
        include: { section: true, course: true, labBatch: true, faculty: true },
    });

    if (!affectedEntries.length) {
        return { replacements: [], conflicts: [] as Array<Record<string, unknown>> };
    }

    const day = await prisma.workingDay.findUnique({ where: { id: dayId } });
    const period = await prisma.period.findUnique({ where: { id: periodId } });
    const replacements: Array<Record<string, unknown>> = [];
    const conflicts: Array<Record<string, unknown>> = [];

    const alternatives = await prisma.laboratory.findMany({
        where: { active: true },
        include: { block: true },
    });

    for (const entry of affectedEntries) {
        const requiredBatchSize = entry.labBatch?.studentCount ?? Math.ceil(entry.section.strength / 2);
        const candidatePool = alternatives.filter((candidate) => candidate.capacity >= requiredBatchSize && candidate.id !== laboratoryId && candidate.labType === lab.labType);
        const candidateIds = candidatePool.map((candidate) => candidate.id);
        const occupiedEntries = await Promise.all(candidateIds.map(async (candidateId) => prisma.timetableEntry.findFirst({
            where: { laboratoryId: candidateId, dayId, periodId },
        })));
        const match = candidatePool.filter((candidate, index) => !occupiedEntries[index]);
        if (!match.length) {
            conflicts.push({
                type: 'LABORATORY_CONFLICT',
                severity: 'HARD',
                day: day?.name ?? dayId,
                period: Number(period?.periodNumber ?? 0),
                laboratoryId,
                message: `No compatible laboratory is available for ${entry.section.name} (${entry.course.code}).`,
            });
            continue;
        }

        replacements.push({ entryId: entry.id, section: entry.section.name, candidates: match.map((candidate) => ({ laboratoryId: candidate.id, laboratoryName: candidate.name, capacity: candidate.capacity, block: candidate.block.name, type: candidate.labType })) });
    }

    return { replacements, conflicts };
};

export const handleFacultyAbsence = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { facultyId, day, period, reason } = req.body ?? {};
        if (!facultyId || !day || !period) throw new AppError('Faculty ID, day, and period are required.', 400);

        const dayRecord = await prisma.workingDay.findFirst({ where: { name: String(day) } });
        const periodRecord = await prisma.period.findFirst({ where: { periodNumber: Number(period) } });
        if (!dayRecord || !periodRecord) throw new AppError('The selected day or period was not found.', 404);

        const affectedEntries = await prisma.timetableEntry.findMany({
            where: { facultyId: String(facultyId), dayId: dayRecord.id, periodId: periodRecord.id },
            include: { section: true, course: true, faculty: true, room: true, laboratory: true, labBatch: true },
        });

        if (!affectedEntries.length) {
            return res.json(successResponse({
                applied: false,
                message: 'No timetable entry was assigned to the faculty during that slot.',
                conflicts: [],
                suggestions: ['No disruption is needed for the selected faculty/slot.'],
            }));
        }

        const { replacements, conflicts } = await getFacultyReplacement(String(facultyId), dayRecord.id, periodRecord.id);
        if (!replacements.length) {
            return res.status(409).json(buildConflictReport([
                {
                    type: 'FACULTY_ABSENCE',
                    severity: 'HARD',
                    day: dayRecord.name,
                    period: Number(periodRecord.periodNumber),
                    facultyId: String(facultyId),
                    message: `No qualified replacement is available for ${reason || 'faculty absence'} during ${dayRecord.name} P${periodRecord.periodNumber}.`,
                },
                ...conflicts,
            ], [
                'Assign a different faculty member who teaches the same course.',
                'Reschedule the affected class to a different day or period with available faculty.',
                'Review the faculty availability and section conflicts before applying a replacement.',
            ]));
        }

        const replacement = replacements[0];
        const affectedEntry = affectedEntries[0];
        await prisma.$transaction(async (tx) => {
            await tx.timetableEntry.update({
                where: { id: affectedEntry.id },
                data: { facultyId: String(replacement.facultyId) },
            });
            await tx.changeRequest.create({
                data: {
                    requestedBy: 'system@vignan.edu',
                    description: JSON.stringify({
                        requestType: 'FACULTY_ABSENCE',
                        facultyId: String(facultyId),
                        replacementFacultyId: String(replacement.facultyId),
                        day: dayRecord.name,
                        period: Number(periodRecord.periodNumber),
                        reason: String(reason || 'Faculty unavailable'),
                        entryId: affectedEntry.id,
                    }),
                    status: 'APPLIED',
                },
            });
        });

        res.json(successResponse({
            applied: true,
            entryId: affectedEntry.id,
            facultyId: String(facultyId),
            replacementFacultyId: String(replacement.facultyId),
            message: `Faculty replacement applied for ${affectedEntry.course.code} in ${affectedEntry.section.name}.`,
            suggestions: ['Replacement applied after faculty availability and section conflict checks.'],
        }));
    } catch (error) {
        next(error);
    }
};

export const handleRoomUnavailable = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { roomId, roomName, day, period, reason } = req.body ?? {};
        if ((!roomId && !roomName) || !day || !period) throw new AppError('Room, day, and period are required.', 400);

        const roomRecord = await prisma.room.findFirst({
            where: roomId ? { id: String(roomId) } : { roomName: String(roomName) },
            include: { block: true },
        });
        if (!roomRecord) throw new AppError('The selected room was not found.', 404);

        const dayRecord = await prisma.workingDay.findFirst({ where: { name: String(day) } });
        const periodRecord = await prisma.period.findFirst({ where: { periodNumber: Number(period) } });
        if (!dayRecord || !periodRecord) throw new AppError('The selected day or period was not found.', 404);

        const affectedEntries = await prisma.timetableEntry.findMany({
            where: { roomId: roomRecord.id, dayId: dayRecord.id, periodId: periodRecord.id },
            include: { section: true, course: true, faculty: true },
        });

        if (!affectedEntries.length) {
            return res.json(successResponse({
                applied: false,
                message: 'No timetable entry is assigned to that room during the selected slot.',
                conflicts: [],
                suggestions: ['No room move is required.'],
            }));
        }

        const { replacements, conflicts } = await getRoomReplacement(roomRecord.id, dayRecord.id, periodRecord.id);
        if (!replacements.length) {
            return res.status(409).json(buildConflictReport([
                { type: 'ROOM_UNAVAILABLE', severity: 'HARD', day: dayRecord.name, period: Number(periodRecord.periodNumber), roomId: roomRecord.id, message: `No compatible replacement room is available for ${reason || 'room unavailability'}.` },
                ...conflicts,
            ], ['Move the affected class to another teaching room with sufficient capacity.', 'Shift the class to a compatible alternative slot with room availability.', 'Review the room schedule and capacity before applying the change.']));
        }

        const replacement = replacements[0] as { candidates?: Array<{ roomId: string }> } | undefined;
        const targetEntry = affectedEntries[0];
        const candidate = replacement?.candidates?.[0] as { roomId: string } | undefined;
        if (!candidate) {
            return res.status(409).json(buildConflictReport([
                { type: 'ROOM_UNAVAILABLE', severity: 'HARD', day: dayRecord.name, period: Number(periodRecord.periodNumber), roomId: roomRecord.id, message: 'No valid room replacement candidate was available to apply the change.' },
            ], ['Select a different room assignment or reschedule the affected class.']));
        }

        await prisma.$transaction(async (tx) => {
            await tx.timetableEntry.update({
                where: { id: targetEntry.id },
                data: { roomId: String(candidate.roomId) },
            });
            await tx.changeRequest.create({
                data: {
                    requestedBy: 'system@vignan.edu',
                    description: JSON.stringify({
                        requestType: 'ROOM_UNAVAILABLE',
                        roomId: roomRecord.id,
                        replacementRoomId: String(candidate.roomId),
                        day: dayRecord.name,
                        period: Number(periodRecord.periodNumber),
                        reason: String(reason || 'Room unavailable'),
                        entryId: targetEntry.id,
                    }),
                    status: 'APPLIED',
                },
            });
        });

        res.json(successResponse({ applied: true, entryId: targetEntry.id, roomId: roomRecord.id, replacementRoomId: String(candidate.roomId), message: `Room replacement applied for ${targetEntry.course.code} in ${targetEntry.section.name}.` }));
    } catch (error) {
        next(error);
    }
};

export const handleLaboratoryUnavailable = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { laboratoryId, laboratoryName, day, period, reason } = req.body ?? {};
        if ((!laboratoryId && !laboratoryName) || !day || !period) throw new AppError('Laboratory, day, and period are required.', 400);

        const labRecord = await prisma.laboratory.findFirst({
            where: laboratoryId ? { id: String(laboratoryId) } : { name: String(laboratoryName) },
            include: { block: true },
        });
        if (!labRecord) throw new AppError('The selected laboratory was not found.', 404);

        const dayRecord = await prisma.workingDay.findFirst({ where: { name: String(day) } });
        const periodRecord = await prisma.period.findFirst({ where: { periodNumber: Number(period) } });
        if (!dayRecord || !periodRecord) throw new AppError('The selected day or period was not found.', 404);

        const affectedEntries = await prisma.timetableEntry.findMany({
            where: { laboratoryId: labRecord.id, dayId: dayRecord.id, periodId: periodRecord.id },
            include: { section: true, course: true, faculty: true, labBatch: true },
        });

        if (!affectedEntries.length) {
            return res.json(successResponse({
                applied: false,
                message: 'No timetable entry is assigned to that laboratory during the selected slot.',
                conflicts: [],
                suggestions: ['No laboratory move is required.'],
            }));
        }

        const { replacements, conflicts } = await getLabReplacement(labRecord.id, dayRecord.id, periodRecord.id);
        if (!replacements.length) {
            return res.status(409).json(buildConflictReport([
                { type: 'LABORATORY_UNAVAILABLE', severity: 'HARD', day: dayRecord.name, period: Number(periodRecord.periodNumber), laboratoryId: labRecord.id, message: `No compatible replacement laboratory is available for ${reason || 'laboratory unavailability'}.` },
                ...conflicts,
            ], ['Move the affected lab session to another compatible laboratory with sufficient capacity.', 'Use a laboratory with matching equipment and batch capacity.', 'Reschedule the affected lab session if no compatible room is available.']));
        }

        const replacement = replacements[0] as { candidates?: Array<{ laboratoryId: string }> } | undefined;
        const targetEntry = affectedEntries[0];
        const candidate = replacement?.candidates?.[0] as { laboratoryId: string } | undefined;
        if (!candidate) {
            return res.status(409).json(buildConflictReport([
                { type: 'LABORATORY_UNAVAILABLE', severity: 'HARD', day: dayRecord.name, period: Number(periodRecord.periodNumber), laboratoryId: labRecord.id, message: 'No valid laboratory replacement candidate was available to apply the change.' },
            ], ['Select a different compatible laboratory or reschedule the lab session.']));
        }

        await prisma.$transaction(async (tx) => {
            await tx.timetableEntry.update({
                where: { id: targetEntry.id },
                data: { laboratoryId: String(candidate.laboratoryId) },
            });
            await tx.changeRequest.create({
                data: {
                    requestedBy: 'system@vignan.edu',
                    description: JSON.stringify({
                        requestType: 'LABORATORY_UNAVAILABLE',
                        laboratoryId: labRecord.id,
                        replacementLaboratoryId: String(candidate.laboratoryId),
                        day: dayRecord.name,
                        period: Number(periodRecord.periodNumber),
                        reason: String(reason || 'Laboratory unavailable'),
                        entryId: targetEntry.id,
                    }),
                    status: 'APPLIED',
                },
            });
        });

        res.json(successResponse({ applied: true, entryId: targetEntry.id, laboratoryId: labRecord.id, replacementLaboratoryId: String(candidate.laboratoryId), message: `Laboratory replacement applied for ${targetEntry.course.code} in ${targetEntry.section.name}.` }));
    } catch (error) {
        next(error);
    }
};

export const applyChangeRequest = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = requiredRouteParam(req, 'id');
        const request = await prisma.changeRequest.findUnique({ where: { id } });
        if (!request) throw new AppError('Change request not found.', 404);

        const payload = parseChangeRequestDescription(request.description);
        const details = typeof payload === 'object' && payload ? payload : req.body ?? {};

        if (details.requestType === 'FACULTY_ABSENCE') {
            return handleFacultyAbsence({ body: details } as Request, res, next);
        }
        if (details.requestType === 'ROOM_UNAVAILABLE') {
            return handleRoomUnavailable({ body: details } as Request, res, next);
        }
        if (details.requestType === 'LABORATORY_UNAVAILABLE') {
            return handleLaboratoryUnavailable({ body: details } as Request, res, next);
        }

        await prisma.changeRequest.update({
            where: { id },
            data: { status: 'REJECTED', reviewedAt: new Date() },
        });
        return res.status(400).json({ success: false, message: 'Unsupported change request type.', data: { conflicts: [], suggestions: ['Use FACULTY_ABSENCE, ROOM_UNAVAILABLE, or LABORATORY_UNAVAILABLE.'] } });
    } catch (error) {
        next(error);
    }
};

export const getHealth = async (_req: Request, res: Response) => {
    res.json({ success: true, data: { status: 'ok' } });
};

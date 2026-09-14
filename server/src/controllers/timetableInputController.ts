import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { successResponse } from '../utils/response.js';
import { requiredRouteParam } from '../utils/routeParam.js';
import { reviewGeneratedTimetable } from '../services/timetableReasoningService.js';

const daySchema = z.object({ name: z.string().min(2), periods: z.number().int().positive().max(12), startTime: z.string().min(1), endTime: z.string().min(1) });
const datasetSchema = z.object({
    name: z.string().min(2), academicYear: z.string().min(2), semester: z.string().min(2),
    workingDays: z.array(daySchema).min(1),
    departments: z.array(z.object({ code: z.string().min(2), name: z.string().min(2) })).min(1),
    sections: z.array(z.object({ department: z.string().min(2), year: z.string().min(2), semester: z.string().min(2), name: z.string().min(1), strength: z.number().int().positive(), block: z.string().min(2), advisor: z.string().min(2) })).min(1),
    courses: z.array(z.object({ code: z.string().min(2), name: z.string().min(2), department: z.string().min(2), year: z.string().min(2), semester: z.string().min(2), type: z.preprocess((value) => typeof value === 'string' ? value.trim().toUpperCase() : value, z.enum(['THEORY', 'LAB'])), periodsPerWeek: z.number().int().positive() })).min(1),
    faculty: z.array(z.object({ id: z.string().min(2), name: z.string().min(2), department: z.string().min(2), designation: z.string().min(2), weeklyWorkload: z.number().int().nonnegative() })).min(1),
    allocations: z.array(z.object({ facultyId: z.string().min(2), courseCode: z.string().min(2), sectionName: z.string().min(1) })),
    rooms: z.array(z.object({ block: z.string().min(2), name: z.string().min(2), floor: z.string().min(2), capacity: z.number().int().positive(), department: z.string().min(2), active: z.boolean() })).min(1),
    laboratories: z.array(z.object({ name: z.string().min(2), block: z.string().min(2), floor: z.string().min(2), capacity: z.number().int().positive(), type: z.string().min(2), equipment: z.string().min(2) })).min(1),
    batches: z.array(z.object({ sectionName: z.string().min(1), name: z.string().min(1), studentCount: z.number().int().positive() })),
    availability: z.array(z.object({ facultyId: z.string().min(2), day: z.string().min(2), period: z.number().int().positive(), available: z.boolean(), preferred: z.boolean() })),
    constraints: z.array(z.object({ name: z.string().min(2), enabled: z.boolean(), value: z.string().optional() })),
});
type Dataset = z.infer<typeof datasetSchema>;

type GeneratedEntry = { section: string; course: string; faculty: string; day: string; period: number; room?: string; laboratory?: string; batch?: string };

const normalizeDay = (value: string) => value.trim().toLowerCase();

const validateReferences = (dataset: Dataset) => {
    const errors: string[] = [];
    const departments = new Set(dataset.departments.map((item) => item.code));
    const sections = new Set(dataset.sections.map((item) => item.name));
    const courses = new Set(dataset.courses.map((item) => item.code));
    const faculty = new Set(dataset.faculty.map((item) => item.id));
    dataset.sections.forEach((section) => { if (!departments.has(section.department)) errors.push(`Section ${section.name} references unknown department ${section.department}.`); });
    dataset.courses.forEach((course) => { if (!departments.has(course.department)) errors.push(`Course ${course.code} references unknown department ${course.department}.`); });
    dataset.allocations.forEach((allocation) => { if (!faculty.has(allocation.facultyId)) errors.push(`Allocation references unknown faculty ${allocation.facultyId}.`); if (!courses.has(allocation.courseCode)) errors.push(`Allocation references unknown course ${allocation.courseCode}.`); if (!sections.has(allocation.sectionName)) errors.push(`Allocation references unknown section ${allocation.sectionName}.`); });
    dataset.batches.forEach((batch) => { const section = dataset.sections.find((item) => item.name === batch.sectionName); if (!section) errors.push(`Batch ${batch.name} references unknown section ${batch.sectionName}.`); else if (batch.studentCount > section.strength) errors.push(`Batch ${batch.name} exceeds ${batch.sectionName} strength.`); });
    return errors;
};

export const saveTimetableDataset = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const dataset = datasetSchema.parse(req.body);
        const errors = validateReferences(dataset);
        if (errors.length) throw new AppError(errors.slice(0, 20).join(' '), 422);
        const saved = await prisma.timetableDataset.create({ data: { name: dataset.name, academicYear: dataset.academicYear, semester: dataset.semester, payload: JSON.stringify(dataset) } });
        res.status(201).json(successResponse({ id: saved.id, name: saved.name, status: saved.status }));
    } catch (error) {
        if (error instanceof z.ZodError) return next(new AppError(error.issues.map((issue) => issue.message).join(', '), 422));
        next(error);
    }
};

export const generateTimetableDataset = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = requiredRouteParam(req, 'id');
        const datasetRecord = await prisma.timetableDataset.findUnique({ where: { id } });
        if (!datasetRecord) throw new AppError('Timetable input dataset was not found.', 404);
        const dataset = datasetSchema.parse(JSON.parse(datasetRecord.payload));
        const errors = validateReferences(dataset);
        if (errors.length) throw new AppError(errors.slice(0, 20).join(' '), 422);
        const generated: GeneratedEntry[] = [];
        const occupied = new Set<string>();
        const facultySlots = new Set<string>();
        const roomSlots = new Set<string>();
        const labSlots = new Set<string>();
        const unavailable = new Set(dataset.availability.filter((item) => !item.available).map((item) => `${item.facultyId}:${normalizeDay(item.day)}:${item.period}`));
        const failures: string[] = [];
        for (const section of dataset.sections) {
            const sectionCourses = dataset.courses.filter((course) => dataset.allocations.some((allocation) => allocation.sectionName === section.name && allocation.courseCode === course.code));
            for (const course of sectionCourses) {
                const allocation = dataset.allocations.find((item) => item.sectionName === section.name && item.courseCode === course.code);
                if (!allocation) continue;
                let scheduled = 0;
                for (let occurrence = 0; occurrence < course.periodsPerWeek; occurrence += 1) {
                    let placed = false;
                    for (const day of dataset.workingDays) for (let period = 1; period <= day.periods; period += 1) {
                        const slot = `${day.name}:${period}`;
                        if (occupied.has(`${section.name}:${slot}`) || facultySlots.has(`${allocation.facultyId}:${slot}`)) continue;
                        if (unavailable.has(`${allocation.facultyId}:${normalizeDay(day.name)}:${period}`)) continue;
                        if (course.type === 'LAB') {
                            const batch = dataset.batches.find((item) => item.sectionName === section.name && item.studentCount <= dataset.laboratories[0].capacity);
                            const laboratory = dataset.laboratories.find((item) => !labSlots.has(`${item.name}:${slot}`) && item.capacity >= (batch?.studentCount ?? section.strength / 2));
                            if (!laboratory) continue;
                            generated.push({ section: section.name, course: course.code, faculty: allocation.facultyId, day: day.name, period, laboratory: laboratory.name, batch: batch?.name });
                            labSlots.add(`${laboratory.name}:${slot}`);
                        } else {
                            const room = dataset.rooms.find((item) => item.active && item.capacity >= section.strength && !roomSlots.has(`${item.name}:${slot}`));
                            if (!room) continue;
                            generated.push({ section: section.name, course: course.code, faculty: allocation.facultyId, day: day.name, period, room: room.name });
                            roomSlots.add(`${room.name}:${slot}`);
                        }
                        occupied.add(`${section.name}:${slot}`);
                        facultySlots.add(`${allocation.facultyId}:${slot}`);
                        scheduled += 1;
                        placed = true;
                        break;
                    }
                    if (!placed) break;
                }
                if (scheduled !== course.periodsPerWeek) failures.push(`Unable to schedule ${course.code} for ${section.name}; required ${course.periodsPerWeek}, placed ${scheduled}.`);
            }
        }
        if (failures.length) throw new AppError(failures.slice(0, 10).join(' '), 409);
        const reasoning = await reviewGeneratedTimetable(dataset, generated, failures);
        await prisma.timetableDataset.update({ where: { id: datasetRecord.id }, data: { generated: JSON.stringify(generated), status: 'GENERATED' } });
        res.json(successResponse({ datasetId: datasetRecord.id, generatedEntries: generated.length, sections: [...new Set(generated.map((entry) => entry.section))].length, timetable: generated, reasoning }));
    } catch (error) {
        next(error);
    }
};

import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { successResponse } from '../utils/response.js';
import { requiredRouteParam } from '../utils/routeParam.js';

const facultySchema = z.object({
    facultyId: z.string().min(2),
    name: z.string().min(2),
    designation: z.string().min(2),
    departmentId: z.string().min(1),
    email: z.string().email(),
    weeklyLoad: z.number().int().nonnegative().optional().default(14),
    active: z.boolean().optional().default(true),
});

const resolveDepartmentId = async (idOrCode: string) => {
    const byId = await prisma.department.findUnique({ where: { id: idOrCode } });
    if (byId) return byId.id;
    const byCode = await prisma.department.findUnique({ where: { code: idOrCode.toUpperCase() } });
    if (byCode) return byCode.id;
    return idOrCode;
};

export const getFaculty = async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const faculty = await prisma.faculty.findMany({
            orderBy: { name: 'asc' },
            include: {
                department: true,
                courses: { include: { course: true } },
                availability: true,
            },
        });
        res.json(successResponse(faculty));
    } catch (error) {
        next(error);
    }
};

export const createFaculty = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const payload = facultySchema.parse(req.body);
        const departmentId = await resolveDepartmentId(payload.departmentId);

        const existingId = await prisma.faculty.findUnique({ where: { facultyId: payload.facultyId } });
        if (existingId) throw new AppError(`Faculty ID ${payload.facultyId} already exists.`, 409);

        const existingEmail = await prisma.faculty.findUnique({ where: { email: payload.email.toLowerCase() } });
        if (existingEmail) throw new AppError(`Faculty email ${payload.email} already exists.`, 409);

        const faculty = await prisma.$transaction(async (tx) => {
            const created = await tx.faculty.create({
                data: {
                    ...payload,
                    email: payload.email.toLowerCase(),
                    departmentId,
                },
                include: { department: true },
            });

            // Initialize default availability slots for all working days & periods
            const days = await tx.workingDay.findMany();
            const periods = await tx.period.findMany();
            if (days.length > 0 && periods.length > 0) {
                const slots = [];
                for (const day of days) {
                    for (const period of periods) {
                        slots.push({
                            facultyId: created.id,
                            dayId: day.id,
                            periodId: period.id,
                            available: true,
                            preferred: false,
                        });
                    }
                }
                await tx.facultyAvailability.createMany({ data: slots });
            }

            return created;
        });

        res.status(201).json(successResponse(faculty));
    } catch (error) {
        if (error instanceof z.ZodError) {
            next(new AppError(error.issues.map((issue) => issue.message).join(', '), 400));
            return;
        }
        next(error);
    }
};

export const updateFaculty = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = requiredRouteParam(req, 'id');
        const payload = facultySchema.partial().parse(req.body);
        let departmentId = payload.departmentId;
        if (departmentId) {
            departmentId = await resolveDepartmentId(departmentId);
        }

        const faculty = await prisma.faculty.update({
            where: { id },
            data: {
                ...payload,
                ...(payload.email ? { email: payload.email.toLowerCase() } : {}),
                ...(departmentId ? { departmentId } : {}),
            },
            include: { department: true, courses: { include: { course: true } } },
        });
        res.json(successResponse(faculty));
    } catch (error) {
        if (error instanceof z.ZodError) {
            next(new AppError(error.issues.map((issue) => issue.message).join(', '), 400));
            return;
        }
        next(error);
    }
};

export const deleteFaculty = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = requiredRouteParam(req, 'id');
        await prisma.$transaction(async (tx) => {
            await tx.timetableEntry.deleteMany({ where: { facultyId: id } });
            await tx.facultyAvailability.deleteMany({ where: { facultyId: id } });
            await tx.facultyCourse.deleteMany({ where: { facultyId: id } });
            await tx.faculty.delete({ where: { id } });
        });
        res.json(successResponse({ id, deleted: true }));
    } catch (error) {
        next(error);
    }
};

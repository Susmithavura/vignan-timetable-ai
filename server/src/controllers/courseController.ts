import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { successResponse } from '../utils/response.js';
import { requiredRouteParam } from '../utils/routeParam.js';

const courseSchema = z.object({
    code: z.string().min(2),
    name: z.string().min(2),
    departmentId: z.string().min(1),
    year: z.string().min(1),
    semester: z.string().min(1),
    type: z.string().min(1),
    requiredPeriodsPerWeek: z.number().int().positive(),
    isLab: z.boolean().optional().default(false),
});

const resolveDepartmentId = async (idOrCode: string) => {
    const byId = await prisma.department.findUnique({ where: { id: idOrCode } });
    if (byId) return byId.id;
    const byCode = await prisma.department.findUnique({ where: { code: idOrCode.toUpperCase() } });
    if (byCode) return byCode.id;
    return idOrCode;
};

export const getCourses = async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const courses = await prisma.course.findMany({
            orderBy: { code: 'asc' },
            include: {
                department: true,
                facultyAssignments: { include: { faculty: true } },
                courseSections: { include: { section: true } },
            },
        });
        res.json(successResponse(courses));
    } catch (error) {
        next(error);
    }
};

export const createCourse = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const payload = courseSchema.parse(req.body);
        const departmentId = await resolveDepartmentId(payload.departmentId);

        const existing = await prisma.course.findUnique({ where: { code: payload.code.toUpperCase() } });
        if (existing) {
            throw new AppError(`Course code ${payload.code} already exists.`, 409);
        }

        const isLab = payload.isLab || payload.type.toUpperCase() === 'LAB' || payload.type.toUpperCase() === 'LABORATORY' || /lab/i.test(payload.name);

        const course = await prisma.course.create({
            data: {
                ...payload,
                code: payload.code.toUpperCase(),
                departmentId,
                isLab,
            },
            include: { department: true },
        });
        res.status(201).json(successResponse(course));
    } catch (error) {
        if (error instanceof z.ZodError) {
            next(new AppError(error.issues.map((issue) => issue.message).join(', '), 400));
            return;
        }
        next(error);
    }
};

export const updateCourse = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = requiredRouteParam(req, 'id');
        const payload = courseSchema.partial().parse(req.body);
        let departmentId = payload.departmentId;
        if (departmentId) {
            departmentId = await resolveDepartmentId(departmentId);
        }

        const isLab = payload.isLab !== undefined
            ? payload.isLab
            : payload.type
                ? payload.type.toUpperCase() === 'LAB' || payload.type.toUpperCase() === 'LABORATORY'
                : undefined;

        const course = await prisma.course.update({
            where: { id },
            data: {
                ...payload,
                ...(payload.code ? { code: payload.code.toUpperCase() } : {}),
                ...(departmentId ? { departmentId } : {}),
                ...(isLab !== undefined ? { isLab } : {}),
            },
            include: { department: true, facultyAssignments: { include: { faculty: true } }, courseSections: { include: { section: true } } },
        });
        res.json(successResponse(course));
    } catch (error) {
        if (error instanceof z.ZodError) {
            next(new AppError(error.issues.map((issue) => issue.message).join(', '), 400));
            return;
        }
        next(error);
    }
};

export const deleteCourse = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = requiredRouteParam(req, 'id');
        await prisma.$transaction(async (tx) => {
            await tx.timetableEntry.deleteMany({ where: { courseId: id } });
            await tx.courseSection.deleteMany({ where: { courseId: id } });
            await tx.facultyCourse.deleteMany({ where: { courseId: id } });
            await tx.course.delete({ where: { id } });
        });
        res.json(successResponse({ id, deleted: true }));
    } catch (error) {
        next(error);
    }
};

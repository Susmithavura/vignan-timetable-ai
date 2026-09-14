import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { successResponse } from '../utils/response.js';
import { requiredRouteParam } from '../utils/routeParam.js';

const sectionSchema = z.object({
    name: z.string().min(2),
    year: z.string().min(1),
    semester: z.string().min(1),
    departmentId: z.string().min(1),
    strength: z.number().int().positive(),
    assignedBlock: z.string().optional().default('A Block'),
    advisor: z.string().optional().default('Academic Office'),
});

const resolveDepartmentId = async (idOrCode: string) => {
    const byId = await prisma.department.findUnique({ where: { id: idOrCode } });
    if (byId) return byId.id;
    const byCode = await prisma.department.findUnique({ where: { code: idOrCode.toUpperCase() } });
    if (byCode) return byCode.id;
    return idOrCode;
};

export const getSections = async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const sections = await prisma.section.findMany({
            orderBy: [{ year: 'asc' }, { name: 'asc' }],
            include: { department: true, labBatches: true, courseSections: { include: { course: true } } },
        });
        res.json(successResponse(sections));
    } catch (error) {
        next(error);
    }
};

export const createSection = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const payload = sectionSchema.parse(req.body);
        const departmentId = await resolveDepartmentId(payload.departmentId);

        const existing = await prisma.section.findFirst({
            where: { departmentId, name: payload.name },
        });
        if (existing) {
            throw new AppError(`Section ${payload.name} already exists in this department.`, 409);
        }

        const section = await prisma.section.create({
            data: {
                ...payload,
                departmentId,
            },
            include: { department: true },
        });
        res.status(201).json(successResponse(section));
    } catch (error) {
        if (error instanceof z.ZodError) {
            next(new AppError(error.issues.map((issue) => issue.message).join(', '), 400));
            return;
        }
        next(error);
    }
};

export const updateSection = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = requiredRouteParam(req, 'id');
        const payload = sectionSchema.partial().parse(req.body);
        let departmentId = payload.departmentId;
        if (departmentId) {
            departmentId = await resolveDepartmentId(departmentId);
        }

        const section = await prisma.section.update({
            where: { id },
            data: {
                ...payload,
                ...(departmentId ? { departmentId } : {}),
            },
            include: { department: true },
        });
        res.json(successResponse(section));
    } catch (error) {
        if (error instanceof z.ZodError) {
            next(new AppError(error.issues.map((issue) => issue.message).join(', '), 400));
            return;
        }
        next(error);
    }
};

export const deleteSection = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = requiredRouteParam(req, 'id');
        await prisma.$transaction(async (tx) => {
            await tx.timetableEntry.deleteMany({ where: { sectionId: id } });
            await tx.labBatch.deleteMany({ where: { sectionId: id } });
            await tx.courseSection.deleteMany({ where: { sectionId: id } });
            await tx.section.delete({ where: { id } });
        });
        res.json(successResponse({ id, deleted: true }));
    } catch (error) {
        next(error);
    }
};

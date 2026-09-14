import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { successResponse } from '../utils/response.js';

const departmentSchema = z.object({
    code: z.string().min(2).max(20),
    name: z.string().min(2).max(100),
});

export const getDepartments = async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const departments = await prisma.department.findMany({
            orderBy: { code: 'asc' },
        });

        res.json(successResponse(departments));
    } catch (error) {
        next(error);
    }
};

export const createDepartment = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const payload = departmentSchema.parse(req.body);
        const department = await prisma.department.create({ data: payload });
        res.status(201).json(successResponse(department));
    } catch (error) {
        if (error instanceof z.ZodError) {
            next(new AppError(error.issues.map((issue) => issue.message).join(', '), 400));
            return;
        }
        next(error);
    }
};

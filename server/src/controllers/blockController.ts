import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { successResponse } from '../utils/response.js';

const blockSchema = z.object({
    name: z.string().min(2),
});

export const createBlock = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const payload = blockSchema.parse(req.body);
        const block = await prisma.block.create({ data: payload });
        res.status(201).json(successResponse(block));
    } catch (error) {
        if (error instanceof z.ZodError) {
            next(new AppError(error.issues.map((issue) => issue.message).join(', '), 400));
            return;
        }
        next(error);
    }
};

import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { successResponse } from '../utils/response.js';
import { requiredRouteParam } from '../utils/routeParam.js';

const laboratorySchema = z.object({
    name: z.string().min(2),
    blockId: z.string().min(1),
    floor: z.string().min(1),
    capacity: z.number().int().positive(),
    labType: z.string().min(1),
    equipment: z.string().min(1),
    active: z.boolean().optional().default(true),
});

const resolveBlockId = async (idOrName: string) => {
    const byId = await prisma.block.findUnique({ where: { id: idOrName } });
    if (byId) return byId.id;
    const byName = await prisma.block.findUnique({ where: { name: idOrName } });
    if (byName) return byName.id;
    const created = await prisma.block.create({ data: { name: idOrName } });
    return created.id;
};

export const createLaboratory = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const payload = laboratorySchema.parse(req.body);
        const blockId = await resolveBlockId(payload.blockId);

        const existing = await prisma.laboratory.findUnique({
            where: { blockId_name: { blockId, name: payload.name } },
        });
        if (existing) throw new AppError(`Laboratory ${payload.name} already exists in this block.`, 409);

        const laboratory = await prisma.laboratory.create({
            data: { ...payload, blockId },
            include: { block: true },
        });
        res.status(201).json(successResponse(laboratory));
    } catch (error) {
        if (error instanceof z.ZodError) {
            next(new AppError(error.issues.map((issue) => issue.message).join(', '), 400));
            return;
        }
        next(error);
    }
};

export const updateLaboratory = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = requiredRouteParam(req, 'id');
        const payload = laboratorySchema.partial().parse(req.body);
        let blockId = payload.blockId;
        if (blockId) {
            blockId = await resolveBlockId(blockId);
        }

        const laboratory = await prisma.laboratory.update({
            where: { id },
            data: {
                ...payload,
                ...(blockId ? { blockId } : {}),
            },
            include: { block: true },
        });
        res.json(successResponse(laboratory));
    } catch (error) {
        if (error instanceof z.ZodError) {
            next(new AppError(error.issues.map((issue) => issue.message).join(', '), 400));
            return;
        }
        next(error);
    }
};

export const deleteLaboratory = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = requiredRouteParam(req, 'id');
        await prisma.$transaction(async (tx) => {
            await tx.timetableEntry.updateMany({
                where: { laboratoryId: id },
                data: { laboratoryId: null },
            });
            await tx.laboratory.delete({ where: { id } });
        });
        res.json(successResponse({ id, deleted: true }));
    } catch (error) {
        next(error);
    }
};

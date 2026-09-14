import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { successResponse } from '../utils/response.js';
import { requiredRouteParam } from '../utils/routeParam.js';

const roomSchema = z.object({
    roomName: z.string().min(1),
    blockId: z.string().min(1),
    floor: z.string().min(1),
    capacity: z.number().int().positive(),
    roomType: z.string().optional().default('TEACHING_ROOM'),
    department: z.string().min(1),
    active: z.boolean().optional().default(true),
});

const resolveBlockId = async (idOrName: string) => {
    const byId = await prisma.block.findUnique({ where: { id: idOrName } });
    if (byId) return byId.id;
    const byName = await prisma.block.findUnique({ where: { name: idOrName } });
    if (byName) return byName.id;
    // Auto-create block if it doesn't exist
    const created = await prisma.block.create({ data: { name: idOrName } });
    return created.id;
};

export const createRoom = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const payload = roomSchema.parse(req.body);
        const blockId = await resolveBlockId(payload.blockId);

        const existing = await prisma.room.findUnique({
            where: { blockId_roomName: { blockId, roomName: payload.roomName } },
        });
        if (existing) throw new AppError(`Room ${payload.roomName} already exists in this block.`, 409);

        const room = await prisma.room.create({
            data: { ...payload, blockId },
            include: { block: true },
        });
        res.status(201).json(successResponse(room));
    } catch (error) {
        if (error instanceof z.ZodError) {
            next(new AppError(error.issues.map((issue) => issue.message).join(', '), 400));
            return;
        }
        next(error);
    }
};

export const updateRoom = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = requiredRouteParam(req, 'id');
        const payload = roomSchema.partial().parse(req.body);
        let blockId = payload.blockId;
        if (blockId) {
            blockId = await resolveBlockId(blockId);
        }

        const room = await prisma.room.update({
            where: { id },
            data: {
                ...payload,
                ...(blockId ? { blockId } : {}),
            },
            include: { block: true },
        });
        res.json(successResponse(room));
    } catch (error) {
        if (error instanceof z.ZodError) {
            next(new AppError(error.issues.map((issue) => issue.message).join(', '), 400));
            return;
        }
        next(error);
    }
};

export const deleteRoom = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = requiredRouteParam(req, 'id');
        await prisma.$transaction(async (tx) => {
            await tx.timetableEntry.updateMany({
                where: { roomId: id },
                data: { roomId: null },
            });
            await tx.room.delete({ where: { id } });
        });
        res.json(successResponse({ id, deleted: true }));
    } catch (error) {
        next(error);
    }
};

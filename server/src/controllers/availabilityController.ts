import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { successResponse } from '../utils/response.js';

const slotSchema = z.object({
    facultyId: z.string().min(1),
    day: z.string().min(1),
    period: z.string().min(1),
    available: z.boolean(),
    preferred: z.boolean().optional().default(false),
});

const resolveIds = async (facultyInput: string, dayInput: string, periodInput: string) => {
    const faculty = await prisma.faculty.findFirst({
        where: { OR: [{ id: facultyInput }, { facultyId: facultyInput }, { name: facultyInput }] },
    });
    if (!faculty) throw new AppError('Faculty not found', 404);

    const day = await prisma.workingDay.findFirst({
        where: { OR: [{ id: dayInput }, { name: dayInput }] },
    });
    if (!day) throw new AppError('Working day not found', 404);

    const periodNumber = Number(String(periodInput).replace(/\D/g, '')) || 1;
    const period = await prisma.period.findFirst({
        where: { OR: [{ id: periodInput }, { periodNumber }] },
    });
    if (!period) throw new AppError('Period not found', 404);

    return { facultyId: faculty.id, dayId: day.id, periodId: period.id };
};

export const setFacultySlotAvailability = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const payload = slotSchema.parse(req.body);
        const { facultyId, dayId, periodId } = await resolveIds(payload.facultyId, payload.day, payload.period);

        const slot = await prisma.facultyAvailability.upsert({
            where: { facultyId_dayId_periodId: { facultyId, dayId, periodId } },
            update: {
                available: payload.available,
                preferred: payload.preferred ?? false,
            },
            create: {
                facultyId,
                dayId,
                periodId,
                available: payload.available,
                preferred: payload.preferred ?? false,
            },
            include: { faculty: true },
        });

        res.json(successResponse(slot));
    } catch (error) {
        if (error instanceof z.ZodError) {
            next(new AppError(error.issues.map((i) => i.message).join(', '), 400));
            return;
        }
        next(error);
    }
};

export const bulkUpdateAvailability = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { facultyId: facultyInput, slots } = req.body;
        if (!facultyInput || !Array.isArray(slots)) {
            throw new AppError('facultyId and slots array are required', 400);
        }

        const faculty = await prisma.faculty.findFirst({
            where: { OR: [{ id: facultyInput }, { facultyId: facultyInput }, { name: facultyInput }] },
        });
        if (!faculty) throw new AppError('Faculty not found', 404);

        const days = await prisma.workingDay.findMany();
        const periods = await prisma.period.findMany();
        const dayMap = new Map(days.map((d) => [d.name.toLowerCase(), d.id]));
        const periodMap = new Map(periods.map((p) => [`p${p.periodNumber}`.toLowerCase(), p.id]));
        periods.forEach((p) => periodMap.set(String(p.periodNumber), p.id));

        const updates = [];
        for (const slot of slots) {
            const dayId = dayMap.get(String(slot.day).toLowerCase());
            const periodId = periodMap.get(String(slot.period).toLowerCase().replace(/\s+/g, ''));
            if (dayId && periodId) {
                updates.push(
                    prisma.facultyAvailability.upsert({
                        where: { facultyId_dayId_periodId: { facultyId: faculty.id, dayId, periodId } },
                        update: { available: slot.available !== false, preferred: Boolean(slot.preferred) },
                        create: { facultyId: faculty.id, dayId, periodId, available: slot.available !== false, preferred: Boolean(slot.preferred) },
                    }),
                );
            }
        }

        await prisma.$transaction(updates);
        res.json(successResponse({ updatedCount: updates.length }));
    } catch (error) {
        next(error);
    }
};

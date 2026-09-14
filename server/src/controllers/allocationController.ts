import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { successResponse } from '../utils/response.js';
import { requiredRouteParam } from '../utils/routeParam.js';

const facultyCourseSchema = z.object({
    facultyId: z.string().min(1),
    courseId: z.string().min(1),
});

const courseSectionSchema = z.object({
    courseId: z.string().min(1),
    sectionId: z.string().min(1),
});

export const getAllocations = async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const [facultyCourses, courseSections] = await Promise.all([
            prisma.facultyCourse.findMany({
                include: { faculty: { include: { department: true } }, course: { include: { department: true } } },
                orderBy: { courseId: 'asc' },
            }),
            prisma.courseSection.findMany({
                include: { course: { include: { department: true } }, section: { include: { department: true } } },
                orderBy: { sectionId: 'asc' },
            }),
        ]);
        res.json(successResponse({ facultyCourses, courseSections }));
    } catch (error) {
        next(error);
    }
};

export const assignFacultyCourse = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { facultyId, courseId } = facultyCourseSchema.parse(req.body);

        // Resolve IDs if code / facultyId passed
        const facultyRecord = await prisma.faculty.findFirst({
            where: { OR: [{ id: facultyId }, { facultyId }, { name: facultyId }] },
        });
        if (!facultyRecord) throw new AppError('Faculty record not found.', 404);

        const courseRecord = await prisma.course.findFirst({
            where: { OR: [{ id: courseId }, { code: courseId.toUpperCase() }] },
        });
        if (!courseRecord) throw new AppError('Course record not found.', 404);

        const existing = await prisma.facultyCourse.findUnique({
            where: { facultyId_courseId: { facultyId: facultyRecord.id, courseId: courseRecord.id } },
        });
        if (existing) throw new AppError('This faculty member is already allocated to this course.', 409);

        const allocation = await prisma.facultyCourse.create({
            data: { facultyId: facultyRecord.id, courseId: courseRecord.id },
            include: { faculty: true, course: true },
        });
        res.status(201).json(successResponse(allocation));
    } catch (error) {
        if (error instanceof z.ZodError) {
            next(new AppError(error.issues.map((i) => i.message).join(', '), 400));
            return;
        }
        next(error);
    }
};

export const removeFacultyCourse = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = requiredRouteParam(req, 'id');
        const allocation = await prisma.facultyCourse.delete({
            where: { id },
        });
        res.json(successResponse({ id: allocation.id, deleted: true }));
    } catch (error) {
        next(error);
    }
};

export const assignCourseSection = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { courseId, sectionId } = courseSectionSchema.parse(req.body);

        const courseRecord = await prisma.course.findFirst({
            where: { OR: [{ id: courseId }, { code: courseId.toUpperCase() }] },
        });
        if (!courseRecord) throw new AppError('Course record not found.', 404);

        const sectionRecord = await prisma.section.findFirst({
            where: { OR: [{ id: sectionId }, { name: sectionId }] },
        });
        if (!sectionRecord) throw new AppError('Section record not found.', 404);

        const existing = await prisma.courseSection.findUnique({
            where: { courseId_sectionId: { courseId: courseRecord.id, sectionId: sectionRecord.id } },
        });
        if (existing) throw new AppError('This course is already assigned to this section.', 409);

        const allocation = await prisma.courseSection.create({
            data: { courseId: courseRecord.id, sectionId: sectionRecord.id },
            include: { course: true, section: true },
        });
        res.status(201).json(successResponse(allocation));
    } catch (error) {
        if (error instanceof z.ZodError) {
            next(new AppError(error.issues.map((i) => i.message).join(', '), 400));
            return;
        }
        next(error);
    }
};

export const removeCourseSection = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = requiredRouteParam(req, 'id');
        const allocation = await prisma.courseSection.delete({
            where: { id },
        });
        res.json(successResponse({ id: allocation.id, deleted: true }));
    } catch (error) {
        next(error);
    }
};

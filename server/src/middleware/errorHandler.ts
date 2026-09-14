import type { NextFunction, Request, Response } from 'express';

export class AppError extends Error {
    statusCode: number;

    constructor(message: string, statusCode = 500) {
        super(message);
        this.name = 'AppError';
        this.statusCode = statusCode;
    }
}

export const notFoundHandler = (req: Request, res: Response) => {
    res.status(404).json({
        success: false,
        message: `Route not found: ${req.method} ${req.originalUrl}`,
    });
};

export const errorHandler = (error: Error, _req: Request, res: Response, _next: NextFunction) => {
    const statusCode = error instanceof AppError ? error.statusCode : 500;
    const message = error.message || 'Internal server error';

    res.status(statusCode).json({
        success: false,
        message,
    });
};

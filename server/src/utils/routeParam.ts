import type { Request } from 'express';
import { AppError } from '../middleware/errorHandler.js';

export const requiredRouteParam = (req: Request, name: string): string => {
    const rawValue = req.params[name];
    const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
    if (!value) throw new AppError(`Invalid or missing ${name}.`, 400);
    return value;
};

import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

dotenv.config({ path: path.resolve(process.cwd(), 'server/.env') });

export const env = {
    port: Number(process.env.PORT ?? 5000),
    frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    databaseUrl: process.env.DATABASE_URL ?? 'file:./dev.db',
    geminiApiKey: process.env.GEMINI_API_KEY ?? '',
    geminiModel: process.env.GEMINI_MODEL ?? 'gemini-3.6-flash',
};

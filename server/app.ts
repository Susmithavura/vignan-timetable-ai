import cors from 'cors';
import express from 'express';
import { env } from './src/config/env.js';
import { errorHandler, notFoundHandler } from './src/middleware/errorHandler.js';
import router from './src/routes/index.js';

export const app = express();

app.use(cors({
    origin: env.frontendUrl,
    credentials: true,
}));

app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/', router);

app.use(notFoundHandler);
app.use(errorHandler);

import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { AppError } from '../middleware/errorHandler.js';

const assistantRequestSchema = z.object({
    prompt: z.string().min(3).max(2000),
    conversationId: z.string().optional(),
});

const conversationStore = new Map<string, {
    history: string[];
}>();

const DAY_ALIASES: Record<string, string> = {
    monday: 'Monday',
    tuesday: 'Tuesday',
    wednesday: 'Wednesday',
    thursday: 'Thursday',
    friday: 'Friday',
    saturday: 'Saturday',
    sunday: 'Sunday',
};

const normalizeText = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();

const normalizeSectionToken = (value: string) => normalizeText(value)
    .replace(/\s+/g, '-')
    .replace(/-(\d+)$/, (_match, number) => `-${Number(number)}`);

const sanitizeForGemini = (value: unknown): unknown => {
    if (Array.isArray(value)) {
        return value.map((item) => sanitizeForGemini(item));
    }

    if (typeof value === 'string') {
        return value.replace(/\b[c][a-z0-9]{12,}\b/gi, '[REDACTED]').replace(/\b[a-z]+Id\b/gi, 'id').replace(/\b[a-z]+ID\b/gi, 'id');
    }

    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>)
                .filter(([key]) => !/^(id|[A-Za-z]+Id|[A-Za-z]+ID)$/.test(key))
                .map(([key, item]) => [key, sanitizeForGemini(item)]),
        );
    }

    return value;
};

const extractDayName = (prompt: string) => {
    const normalized = normalizeText(prompt);
    for (const [key, label] of Object.entries(DAY_ALIASES)) {
        if (normalized.includes(key)) return label;
    }
    return null;
};

const extractPeriodNumber = (prompt: string) => {
    const matches = prompt.match(/\b(?:period|p)\s*0?(\d)\b/i);
    if (!matches) return null;
    const value = Number(matches[1]);
    return Number.isInteger(value) && value >= 1 && value <= 6 ? value : null;
};

const extractSectionName = (prompt: string, sections: Array<{ name: string }>) => {
    const normalizedPrompt = normalizeText(prompt);

    const exact = sections.find((section) => normalizedPrompt.includes(normalizeText(section.name)));
    if (exact) return exact.name;

    const regexMatch = prompt.match(/\b[A-Z]{2,5}[-\s]?0?(\d{1,2})\b/);
    if (regexMatch) {
        const [match] = regexMatch;
        const sectionName = match.replace(/\s+/g, '-').toUpperCase();
        const resolved = sections.find((section) => normalizeSectionToken(section.name) === normalizeSectionToken(sectionName));
        return resolved?.name ?? sectionName;
    }

    return null;
};

const extractFacultyName = (prompt: string, faculty: Array<{ name: string }>) => {
    const normalizedPrompt = normalizeText(prompt);
    const match = faculty.find((member) => normalizedPrompt.includes(normalizeText(member.name)));
    return match?.name ?? null;
};

const extractCourseName = (prompt: string, courses: Array<{ name: string; code: string }>) => {
    const normalizedPrompt = normalizeText(prompt);
    const directMatch = courses.find((course) => normalizedPrompt.includes(normalizeText(course.name)) || normalizedPrompt.includes(normalizeText(course.code)));
    if (directMatch) return directMatch.name;
    return null;
};

const extractRoomName = (prompt: string, rooms: Array<{ roomName: string }>) => {
    const normalizedPrompt = normalizeText(prompt);
    const match = rooms.find((room) => normalizedPrompt.includes(normalizeText(room.roomName)));
    return match?.roomName ?? null;
};

const resolveDayId = async (targetDay?: string | null) => {
    if (!targetDay) return null;
    const dayRecord = await prisma.workingDay.findFirst({ where: { name: targetDay } });
    return dayRecord?.id ?? null;
};

const resolvePeriodId = async (targetPeriod?: number | null) => {
    if (!targetPeriod) return null;
    const periodRecord = await prisma.period.findFirst({ where: { periodNumber: targetPeriod } });
    return periodRecord?.id ?? null;
};

const getConversationState = (conversationId?: string) => {
    if (!conversationId) return null;
    if (!conversationStore.has(conversationId)) {
        conversationStore.set(conversationId, { history: [] });
    }
    return conversationStore.get(conversationId);
};

const buildResolvedTimetableEntries = async () => {
    const [allEntries, days, periods, sections, faculty, courses, rooms, laboratories] = await Promise.all([
        prisma.timetableEntry.findMany({
            include: {
                section: true,
                course: true,
                faculty: true,
                room: true,
                laboratory: true,
                labBatch: true,
            },
        }),
        prisma.workingDay.findMany(),
        prisma.period.findMany({ orderBy: { periodNumber: 'asc' } }),
        prisma.section.findMany({ include: { department: true } }),
        prisma.faculty.findMany({ include: { department: true } }),
        prisma.course.findMany({ include: { department: true } }),
        prisma.room.findMany({ include: { block: true } }),
        prisma.laboratory.findMany({ include: { block: true } }),
    ]);

    const dayMap = new Map(days.map((day) => [day.id, day.name]));
    const periodMap = new Map(periods.map((period) => [period.id, `Period ${period.periodNumber}`]));
    const sectionMap = new Map(sections.map((section) => [section.id, section.name]));
    const facultyMap = new Map(faculty.map((member) => [member.id, member.name]));
    const courseMap = new Map(courses.map((course) => [course.id, course.name]));
    const roomMap = new Map(rooms.map((room) => [room.id, room.roomName]));
    const labMap = new Map(laboratories.map((lab) => [lab.id, lab.name]));

    return {
        entries: allEntries.map((entry) => ({
            section: sectionMap.get(entry.sectionId) ?? 'Unknown section',
            day: dayMap.get(entry.dayId) ?? 'Unknown day',
            period: periodMap.get(entry.periodId) ?? 'Unknown period',
            course: courseMap.get(entry.courseId) ?? 'Unknown course',
            faculty: entry.facultyId ? facultyMap.get(entry.facultyId) ?? 'Unassigned faculty' : 'Unassigned faculty',
            room: entry.roomId ? roomMap.get(entry.roomId) ?? 'Unassigned room' : entry.laboratoryId ? labMap.get(entry.laboratoryId) ?? 'Unassigned laboratory' : 'No room assigned',
            type: entry.entryType,
            laboratory: entry.laboratoryId ? labMap.get(entry.laboratoryId) ?? 'Unassigned laboratory' : null,
            labBatch: entry.labBatchId ? entry.labBatch?.name ?? 'Unassigned batch' : null,
        })),
        roomLookup: rooms,
        laboratoryLookup: laboratories,
        facultyLookup: faculty,
        sectionLookup: sections,
        courseLookup: courses,
        dayLookup: days,
        periodLookup: periods,
    };
};

const buildDataSummary = (entries: Array<{ day: string; period: string; section: string; course: string; faculty: string; room: string | null; laboratory: string | null; type: string | null; }>, laboratories: Array<{ name: string; block?: { name?: string | null } | null; floor?: string | null; capacity?: number | null }>) => {
    const labsSummary = laboratories.map((lab) => {
        const scheduledSessions = entries.filter((entry) => entry.laboratory === lab.name).length;
        return {
            laboratory: lab.name,
            block: lab.block?.name ?? 'Unknown block',
            floor: lab.floor ?? 'Unknown floor',
            capacity: lab.capacity ?? 'Unknown capacity',
            scheduledSessions,
            utilisation: scheduledSessions > 0 ? 'in use' : 'unused',
        };
    });

    const busiestLab = [...labsSummary].sort((a, b) => b.scheduledSessions - a.scheduledSessions)[0];
    const leastUsedLab = [...labsSummary].sort((a, b) => a.scheduledSessions - b.scheduledSessions)[0];
    const totalLabSessions = labsSummary.reduce((sum, lab) => sum + lab.scheduledSessions, 0);

    const clashes = new Map<string, { day: string; period: string; items: string[] }>();
    for (const entry of entries) {
        const key = `${entry.day}|${entry.period}`;
        const target = clashes.get(key) ?? { day: entry.day, period: entry.period, items: [] };
        const label = entry.room ? `${entry.section} - ${entry.course} - ${entry.room}` : `${entry.section} - ${entry.course}`;
        target.items.push(label);
        clashes.set(key, target);
    }

    const clashSummary = [...clashes.values()]
        .filter((slot) => slot.items.length > 1)
        .map((slot) => ({
            day: slot.day,
            period: slot.period,
            conflictCount: slot.items.length,
            details: slot.items,
        }));

    return {
        totalLaboratories: labsSummary.length,
        totalLabSessions,
        busiestLab,
        leastUsedLab,
        labUtilization: labsSummary,
        clashSummary,
    };
};

const buildAssistantContext = async (prompt: string, conversationId?: string) => {
    const state = getConversationState(conversationId);

    const [
        { entries, roomLookup, laboratoryLookup, facultyLookup, sectionLookup, courseLookup, dayLookup, periodLookup },
        rooms,
        labs,
    ] = await Promise.all([
        buildResolvedTimetableEntries(),
        prisma.room.findMany({ include: { block: true } }),
        prisma.laboratory.findMany({ include: { block: true } }),
    ]);

    const timetablePrompt = /(timetable|class|schedule|room|faculty|lab|period|day|unavailable|clash)/i.test(prompt);

    const dayName = extractDayName(prompt);
    const periodNumber = extractPeriodNumber(prompt) ?? null;
    const sectionName = extractSectionName(prompt, sectionLookup);
    const facultyName = extractFacultyName(prompt, facultyLookup);
    const courseName = extractCourseName(prompt, courseLookup);
    const roomName = extractRoomName(prompt, roomLookup);

    const relevantEntries = entries.filter((entry) => {
        if (sectionName && entry.section !== sectionName) return false;
        if (dayName && entry.day !== dayName) return false;
        if (periodNumber && !entry.period.includes(String(periodNumber))) return false;
        if (facultyName && entry.faculty !== facultyName) return false;
        if (courseName && entry.course !== courseName) return false;
        if (roomName && entry.room !== roomName) return false;
        return true;
    });

    const dayId = await resolveDayId(dayName);
    const periodId = await resolvePeriodId(periodNumber);

    const freeRooms = dayId && periodId
        ? rooms
            .filter((room) => room.active)
            .filter((room) => !entries.some((entry) => {
                const targetRoom = entry.room;
                return targetRoom && room.roomName === targetRoom && (dayLookup.find((day) => day.name === dayName)?.id === dayId) && periodLookup.find((period) => period.periodNumber === periodNumber)?.id === periodId;
            }))
            .map((room) => ({
                room: room.roomName,
                block: room.block?.name ?? 'Unknown block',
                floor: room.floor,
                capacity: room.capacity,
                department: room.department,
            }))
        : rooms.filter((room) => room.active).map((room) => ({
            room: room.roomName,
            block: room.block?.name ?? 'Unknown block',
            floor: room.floor,
            capacity: room.capacity,
            department: room.department,
        }));

    const laboratoryUtilisation = labs.map((lab) => {
        const scheduled = entries.filter((entry) => entry.laboratory === lab.name).length;
        return {
            laboratory: lab.name,
            block: lab.block?.name ?? 'Unknown block',
            floor: lab.floor,
            capacity: lab.capacity,
            scheduledSessions: scheduled,
        };
    });

    const facultyAvailability = facultyLookup.map((member) => ({
        faculty: member.name,
        department: member.department?.name ?? 'Unknown department',
        active: member.active,
    }));

    const requestContext = {
        section: sectionName,
        day: dayName,
        period: periodNumber ? `Period ${periodNumber}` : null,
        course: courseName,
        faculty: facultyName,
        room: roomName,
        question: prompt,
    };

    if (state) {
        state.history.push(prompt);
    }

    const structuredInsights = buildDataSummary(entries, labs);

    return {
        requestContext,
        timetableEntries: relevantEntries,
        freeRooms,
        laboratoryUtilisation,
        facultyAvailability,
        totalTimetableEntries: entries.length,
        totalRooms: rooms.length,
        totalTeachingRooms: rooms.filter((room) => room.active && room.roomType === 'TEACHING_ROOM').length,
        totalLabs: labs.length,
        totalSections: sectionLookup.length,
        totalFaculty: facultyLookup.length,
        totalCourses: courseLookup.length,
        periods: periodLookup.map((period) => `Period ${period.periodNumber}`),
        dataInsights: structuredInsights,
        note: relevantEntries.length > 0 ? 'Database-grounded timetable data for the requested query.' : 'No direct timetable match found in the current database for the requested query.',
        timetableQuestion: timetablePrompt,
    };
};

const generateGroundedAssistantReply = (prompt: string, context: any) => {
    const normalizedPrompt = prompt.toLowerCase();
    const entries = context.timetableEntries ?? [];
    const labs = context.dataInsights?.labUtilization ?? [];
    const day = context.requestContext?.day ?? extractDayName(prompt);
    const periodNumber = extractPeriodNumber(prompt) ?? (context.requestContext?.period ? Number(String(context.requestContext.period).replace(/\D/g, '')) : null);
    const section = context.requestContext?.section ?? null;
    const course = context.requestContext?.course ?? null;
    const faculty = context.requestContext?.faculty ?? null;
    const clashes = context.dataInsights?.clashSummary ?? [];

    if (/how many sections?/i.test(normalizedPrompt)) {
        return `There are ${context.totalSections} sections in the college.`;
    }

    if (/how many faculty members?|how many faculty/i.test(normalizedPrompt)) {
        return `There are ${context.totalFaculty} faculty members in the college.`;
    }

    if (/how many teaching rooms?|how many classrooms?/i.test(normalizedPrompt)) {
        return `There are ${context.totalTeachingRooms} active teaching rooms in the college.`;
    }

    if (/(free|available).*(period|slot)|periods?.*(free|available)/i.test(normalizedPrompt)) {
        const targetDay = day ?? 'Tuesday';
        const periods = Array.isArray(context.periods) && context.periods.length > 0 ? context.periods : ['Period 1', 'Period 2', 'Period 3', 'Period 4', 'Period 5', 'Period 6'];
        const totalSections = Number(context.totalSections ?? 0);
        const freeByPeriod = periods.map((period: string) => {
            const occupiedSections = new Set(
                (context.timetableEntries ?? [])
                    .filter((entry: { day: string; period: string }) => entry.day === targetDay && entry.period === period)
                    .map((entry: { section: string }) => entry.section),
            );
            return { period, free: Math.max(totalSections - occupiedSections.size, 0) };
        });
        const freePeriods = freeByPeriod.filter((item: { free: number }) => item.free > 0);
        if (!freePeriods.length) return `There are no free section periods on ${targetDay} in the current timetable data.`;
        return `On ${targetDay}, free periods are: ${freePeriods.map((item: { period: string; free: number }) => `${item.period} (${item.free} section${item.free === 1 ? '' : 's'} free)`).join(', ')}.`;
    }

    if (/(lab|laboratory).*(util|use|occup|session)/i.test(normalizedPrompt) || normalizedPrompt.includes('show laboratory utilisation')) {
        const total = labs.length;
        const active = labs.filter((lab: { scheduledSessions: number }) => lab.scheduledSessions > 0);
        const inactive = labs.filter((lab: { scheduledSessions: number }) => lab.scheduledSessions === 0);
        const busiest = [...labs].sort((a: { scheduledSessions: number }, b: { scheduledSessions: number }) => b.scheduledSessions - a.scheduledSessions)[0];
        const totalSessions = labs.reduce((sum: number, lab: { scheduledSessions: number }) => sum + lab.scheduledSessions, 0);

        const activeText = active.length > 0
            ? `${active.map((lab: { laboratory: string; scheduledSessions: number }) => `${lab.laboratory} has ${lab.scheduledSessions} scheduled session${lab.scheduledSessions === 1 ? '' : 's'}`).join('; ')}.`
            : 'No laboratories currently have scheduled sessions.';

        return `Here’s the current laboratory utilisation:\n\nThere are ${total} laboratories in the timetable data, and ${totalSessions} lab sessions are currently scheduled across them. ${active.length > 0 ? `${busiest.laboratory} is the busiest laboratory with ${busiest.scheduledSessions} scheduled session${busiest.scheduledSessions === 1 ? '' : 's'}.` : 'No laboratory is currently in use.'}\n\n${activeText}\n\nThe remaining ${inactive.length} laboratory${inactive.length === 1 ? '' : 'ies'} are currently unused based on the available timetable data. Overall, laboratory utilisation is low at the moment.`;
    }

    if (/(free|available).*lab|lab.*(free|available)/i.test(normalizedPrompt)) {
        const targetDay = day ?? 'Tuesday';
        const targetPeriod = periodNumber ?? 4;
        const occupiedLabs = new Set(
            entries
                .filter((entry: { day: string; period: string; laboratory: string | null }) => entry.day === targetDay && entry.period === `Period ${targetPeriod}` && entry.laboratory)
                .map((entry: { laboratory: string | null }) => entry.laboratory),
        );
        const freeLabs = labs.filter((lab: { laboratory: string }) => !occupiedLabs.has(lab.laboratory));

        if (!freeLabs.length) {
            return `There are no laboratories free on ${targetDay} during Period ${targetPeriod} based on the current timetable data.`;
        }

        return `The laboratories free on ${targetDay} during Period ${targetPeriod} are: ${freeLabs.map((lab: { laboratory: string; block: string; floor: string | number; capacity: number }) => `${lab.laboratory} (${lab.block}, ${lab.floor}, capacity ${lab.capacity})`).join('; ')}.`;
    }

    if (/(show me|timetable|schedule)/i.test(normalizedPrompt) && section) {
        const sectionEntries = entries.filter((entry: { section: string }) => entry.section === section);
        const grouped = sectionEntries.reduce((acc: Record<string, Array<any>>, entry: any) => {
            const key = entry.day;
            acc[key] = acc[key] ?? [];
            acc[key].push(entry);
            return acc;
        }, {});
        const dayList = Object.entries(grouped).map(([dayName, dayEntries]) => `${dayName}: ${((dayEntries as any[])).map((entry) => `${entry.period} - ${entry.course}${entry.room ? ` in ${entry.room}` : ''}`).join('; ')}`).join('\n');
        return `Here is the current timetable for ${section}:\n\n${dayList || 'No timetable entries were found for this section in the current database data.'}`;
    }

    if (/who teaches|teaches/i.test(normalizedPrompt) && course) {
        const teachers = [...new Set(entries.filter((entry: { course: string }) => entry.course === course).map((entry: { faculty: string }) => entry.faculty))];
        return `${course} is taught by ${teachers.join(', ')}.`;
    }

    if (/(what classes does|classes does|class.*tuesday)/i.test(normalizedPrompt) && day) {
        const dayClasses = entries.filter((entry: { section: string; day: string }) => entry.day === day);
        if (!dayClasses.length) {
            return `There are no scheduled classes on ${day} in the current timetable data.`;
        }
        const list = dayClasses.slice(0, 30).map((entry: { section: string; period: string; course: string; room: string | null; faculty: string; type: string | null }) => `${entry.section} ${entry.period} - ${entry.course} (${entry.type ?? 'Class'}) with ${entry.faculty}${entry.room ? ` in ${entry.room}` : ''}`).join('; ');
        return `There are ${dayClasses.length} scheduled classes on ${day}. Here are the current entries: ${list}${dayClasses.length > 30 ? ' …' : ''}`;
    }

    if (/(clash|conflict)/i.test(normalizedPrompt)) {
        if (!clashes.length) {
            return 'There are no timetable clashes in the current database data.';
        }
        const clashText = clashes.map((slot: { day: string; period: string; conflictCount: number; details: string[] }) => `${slot.day} ${slot.period} has ${slot.conflictCount} overlapping entries: ${slot.details.join('; ')}`).join('\n');
        return `I found timetable clashes in the current data:\n\n${clashText}`;
    }

    if (faculty) {
        const facultyEntries = entries.filter((entry: { faculty: string }) => entry.faculty === faculty);
        const courses = [...new Set(facultyEntries.map((entry: { course: string }) => entry.course))];
        return `${faculty} is assigned to ${courses.join(', ')} in the current timetable data.`;
    }

    if (section) {
        const totalClasses = entries.filter((entry: { section: string }) => entry.section === section).length;
        return `${section} currently has ${totalClasses} scheduled entries in the timetable data. The main classes and sessions are distributed across the timetable according to the current schedule.`;
    }

    return `Based on the current timetable data, I can see ${entries.length} scheduled entries, ${labs.length} laboratories, and ${clashes.length} conflict slot${clashes.length === 1 ? '' : 's'} in the database. The most useful summary is the one above for the requested analysis.`;
};

async function callGemini(prompt: string, contextSummary: string) {
    const apiKey = env.geminiApiKey;
    if (!apiKey) {
        throw new AppError('Gemini API key is missing. Set GEMINI_API_KEY in the server environment.', 500);
    }

    const modelsToTry = Array.from(new Set([
        env.geminiModel,
        'gemini-3.6-flash',
        'gemini-2.5-flash',
        'gemini-2.5-pro',
    ].filter(Boolean)));

    let lastError: string | null = null;

    for (const model of modelsToTry) {
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    generationConfig: {
                        temperature: 0.2,
                        topP: 0.9,
                    },
                    systemInstruction: {
                        role: 'system',
                        parts: [
                            {
                                text: 'You are Vignan Timetable AI, an intelligent college timetable assistant. Your job is to understand the user\'s question, analyze the supplied timetable data, and give a clear, natural, useful answer. Do not merely repeat database records. Summarize, reason about, and explain the information while staying strictly grounded in the supplied data. Use the supplied database summary and derived insights to interpret patterns, utilization, availability, conflicts, and important findings. Answer in a conversational, helpful tone. Start with the most useful answer first. Use concise direct answers for simple questions, and richer explanatory answers for analytical questions. Use tables only when they genuinely help. Never expose database IDs, raw JSON, internal query details, Prisma details, implementation details, or API internals. If the requested information is not present in the supplied data, say clearly: "I couldn\'t find that information in the current timetable data." Never invent information that is not in the provided context.',
                            },
                        ],
                    },
                    contents: [
                        {
                            role: 'user',
                            parts: [
                                {
                                    text: `Database-grounded context:\n${contextSummary}\n\nImportant instructions for this answer:\n- Use the summary and insights to reason about trends and availability, not just raw rows.\n- Prefer natural conversational explanations over raw tables.\n- If the user asks for a timetable, organize it by day and period in a clear way.\n- If the user asks for utilisation, explain the numbers and highlight the busiest or least-used resources.\n- If the user asks about availability, list the currently free resources and their locations.\n- If the user asks about clashes, clearly state whether a clash exists and which entries conflict.\n- Keep the answer grounded in the provided data only.\n\nQuestion:\n${prompt}`,
                                },
                            ],
                        },
                    ],
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                lastError = `Gemini request failed for model ${model} (${response.status}): ${errorText || 'Unknown error'}`;
                if (response.status !== 400 && response.status !== 404) {
                    throw new AppError(lastError, 502);
                }
                continue;
            }

            const data = await response.json() as {
                candidates?: Array<{
                    content?: {
                        parts?: Array<{ text?: string }>;
                    };
                }>;
            };

            const answer = data.candidates
                ?.flatMap((candidate) => candidate.content?.parts ?? [])
                .map((part) => part.text ?? '')
                .join('')
                .trim();

            if (!answer) {
                throw new AppError('Gemini returned an empty response.', 502);
            }

            return answer;
        } catch (error) {
            if (error instanceof AppError) {
                throw error;
            }
            lastError = error instanceof Error ? error.message : 'Unknown Gemini error';
        }
    }

    throw new AppError(lastError ?? 'Gemini request failed with unsupported model configuration.', 502);
}

export const askAssistant = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const payload = assistantRequestSchema.parse(req.body);
        const context = await buildAssistantContext(payload.prompt, payload.conversationId);
        const safeContext = sanitizeForGemini(context);

        if (context.timetableQuestion && context.timetableEntries.length === 0) {
            const answer = "I couldn't find that information in the current timetable data.";
            res.json({
                success: true,
                data: {
                    answer,
                    model: env.geminiModel,
                    context: safeContext,
                },
            });
            return;
        }

        const contextSummary = JSON.stringify(safeContext, null, 2);

        let answer: string;
        try {
            answer = await callGemini(payload.prompt, contextSummary);
        } catch (geminiError) {
            const message = geminiError instanceof Error ? geminiError.message : String(geminiError);
            if (/429|quota|RATE_LIMIT|RESOURCE_EXHAUSTED|429/.test(message)) {
                answer = generateGroundedAssistantReply(payload.prompt, safeContext);
            } else {
                throw geminiError;
            }
        }

        res.json({
            success: true,
            data: {
                answer,
                model: env.geminiModel,
                context: safeContext,
            },
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            next(new AppError('Prompt is required and must be between 3 and 2000 characters.', 400));
            return;
        }

        next(error);
    }
};

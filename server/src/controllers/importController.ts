import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../config/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { successResponse } from '../utils/response.js';

type Row = Record<string, unknown>;
type EntityType = 'faculty' | 'course' | 'section' | 'room' | 'laboratory' | 'department' | 'block' | 'facultyAvailability' | 'courseAllocation' | 'labBatch' | 'constraint';
type DatasetPayload = {
    name: string;
    academicYear: string;
    semester: string;
    departments: Array<{ code: string; name: string }>;
    blocks: Array<{ code: string; name: string }>;
    faculty: Array<Record<string, unknown>>;
    sections: Array<Record<string, unknown>>;
    courses: Array<Record<string, unknown>>;
    rooms: Array<Record<string, unknown>>;
    laboratories: Array<Record<string, unknown>>;
    availability: Array<Record<string, unknown>>;
    allocations: Array<Record<string, unknown>>;
    batches: Array<Record<string, unknown>>;
    constraints: Array<Record<string, unknown>>;
};

type SpreadsheetModule = {
    read(data: Buffer, options: { type: 'buffer' | 'array' }): { SheetNames: string[]; Sheets: Record<string, unknown> };
    utils: { sheet_to_json(sheet: unknown, options: { defval: string }): Row[] };
};

const normalizeIdentifier = (value: string) => value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

const normalizeValue = (value: unknown): string => {
    if (value === undefined || value === null) return '';
    return String(value).trim();
};

const toNumber = (value: unknown): number => {
    if (value === undefined || value === null || value === '') return 0;
    const numeric = Number(String(value).replace(/,/g, '').trim());
    return Number.isFinite(numeric) ? numeric : 0;
};

const toBoolean = (value: unknown): boolean => {
    if (typeof value === 'boolean') return value;
    const text = String(value ?? '').trim().toLowerCase();
    if (!text) return false;
    return ['true', 'yes', 'y', '1', 'active', 'available', 'assigned'].includes(text);
};

const pickValue = (row: Row, aliases: string[]) => {
    for (const alias of aliases) {
        const candidate = row[alias] ?? row[alias.toLowerCase()] ?? row[alias.replace(/\s+/g, '_').toLowerCase()];
        if (candidate !== undefined && candidate !== null && normalizeValue(candidate) !== '') {
            return candidate;
        }
    }
    return '';
};

const normalizedRows = (rows: Row[]) => rows.map((row) => Object.fromEntries(
    Object.entries(row).map(([key, value]) => [normalizeIdentifier(key), value]),
));

const classifySheet = (sheetName: string, rows: Row[]): EntityType | null => {
    const normalizedName = normalizeIdentifier(sheetName);
    const sample = rows[0] ?? {};
    const keys = new Set(Object.keys(sample).map((key) => normalizeIdentifier(key)));

    if (normalizedName.includes('department')) return 'department';
    if (normalizedName.includes('block')) return 'block';

    const matches = {
        facultyAvailability: normalizedName.includes('facultyavailability') || normalizedName.includes('availability') || (keys.has('facultyid') && keys.has('day')) || (keys.has('facultyid') && keys.has('period') && keys.has('available')),
        courseAllocation: normalizedName.includes('courseallocation') || normalizedName.includes('allocation') || (keys.has('coursecode') && keys.has('facultyid')) || (keys.has('facultyid') && keys.has('subjectcode') && keys.has('section')),
        labBatch: normalizedName.includes('labbatch') || normalizedName.includes('batch') || (keys.has('sectionname') && (keys.has('studentcount') || keys.has('batchname') || keys.has('batch'))),
        constraint: normalizedName.includes('constraint') || keys.has('constraintname') || keys.has('rule') || keys.has('constrainttype'),
        faculty: normalizedName.includes('faculty') || keys.has('facultyid') || keys.has('registrationno') || keys.has('employeeid') || (keys.has('designation') && keys.has('email')) || (keys.has('name') && keys.has('department') && keys.has('designation')),
        course: normalizedName.includes('course') || keys.has('coursecode') || keys.has('subjectcode') || keys.has('requiredperiodsperweek') || keys.has('periodsweek') || keys.has('coursename'),
        section: normalizedName.includes('section') || keys.has('strength') || keys.has('studentstrength') || keys.has('sectionname') || (keys.has('section') && (keys.has('year') || keys.has('semester'))),
        room: normalizedName.includes('room') || keys.has('roomnumber') || keys.has('roomname') || keys.has('classroom') || (keys.has('capacity') && keys.has('roomtype')) || (keys.has('roomno') && keys.has('block')),
        laboratory: normalizedName.includes('labor') || normalizedName.includes('lab') || keys.has('labtype') || keys.has('labname') || keys.has('laboratoryname') || keys.has('equipment'),
    };

    if (matches.facultyAvailability) return 'facultyAvailability';
    if (matches.courseAllocation) return 'courseAllocation';
    if (matches.labBatch) return 'labBatch';
    if (matches.constraint) return 'constraint';
    if (matches.faculty) return 'faculty';
    if (matches.course) return 'course';
    if (matches.section) return 'section';
    if (matches.room) return 'room';
    if (matches.laboratory) return 'laboratory';
    return null;
};

const fileTypeLabels: Record<EntityType, string> = {
    faculty: 'Faculty',
    course: 'Course',
    section: 'Section',
    room: 'Room',
    laboratory: 'Laboratory',
    department: 'Department',
    block: 'Block',
    facultyAvailability: 'Faculty Availability',
    courseAllocation: 'Course Allocation',
    labBatch: 'Lab Batch',
    constraint: 'Constraint',
};

const loadSpreadsheet = async (): Promise<SpreadsheetModule> => {
    try {
        const loader = new Function('modulePath', 'return import(modulePath)') as (modulePath: string) => Promise<SpreadsheetModule>;
        return await loader('xlsx');
    } catch {
        throw new AppError('Excel import is unavailable because the xlsx parser dependency is not installed. Run npm install and retry.', 503);
    }
};

const asBase64Buffer = (data: string) => {
    if (!data) return Buffer.alloc(0);
    const cleaned = data.startsWith('data:') ? data.split(',')[1] ?? data : data;
    return Buffer.from(cleaned, 'base64');
};

const inferDatasetName = (fileNames: string[]) => {
    const first = fileNames.find((fileName) => fileName && fileName.trim());
    if (!first) return 'My College Timetable';
    return first.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').trim() || 'My College Timetable';
};

const mapFacultyRecord = (row: Row, index: number, warnings: string[]) => {
    const facultyId = normalizeValue(pickValue(row, ['facultyid', 'facultyidnumber', 'employeeid', 'registrationno', 'registrationnumber', 'regno', 'staffid', 'teacherid', 'id', 'faculty number']));
    const name = normalizeValue(pickValue(row, ['facultyname', 'faculty name', 'name', 'teacher', 'teachername', 'faculty']));
    const department = normalizeValue(pickValue(row, ['department', 'dept', 'branch', 'departmentname']));
    const designation = normalizeValue(pickValue(row, ['designation', 'role', 'position', 'jobtitle']));
    const email = normalizeValue(pickValue(row, ['email', 'emailaddress', 'facultyemail']));
    const weeklyLoad = toNumber(pickValue(row, ['weeklyload', 'weekly load', 'workload', 'teachingload', 'classesperweek']));

    if (!name) warnings.push(`Faculty row ${index + 2} is missing Faculty Name.`);
    if (!department) warnings.push(`Faculty row ${index + 2} is missing Department.`);
    if (!facultyId && !email) warnings.push(`Faculty row ${index + 2} is missing Faculty ID. A fallback ID will be generated.`);

    return {
        facultyId: facultyId || email || `FAC-${index + 1}`,
        name,
        department,
        designation: designation || 'Assistant Professor',
        email: email || `${(facultyId || name || `faculty-${index + 1}`).replace(/\s+/g, '.').toLowerCase()}@college.edu`,
        weeklyLoad,
        active: toBoolean(pickValue(row, ['active', 'isactive', 'status'])) || true,
    };
};

const mapCourseRecord = (row: Row, index: number, warnings: string[]) => {
    const code = normalizeValue(pickValue(row, ['coursecode', 'subjectcode', 'subject', 'code', 'course code', 'courseid']));
    const name = normalizeValue(pickValue(row, ['coursename', 'course name', 'subjectname', 'name', 'title']));
    const department = normalizeValue(pickValue(row, ['department', 'dept', 'branch', 'departmentname']));
    const year = normalizeValue(pickValue(row, ['year', 'academicyear', 'classyear', 'yearofstudy']));
    const semester = normalizeValue(pickValue(row, ['semester', 'sem', 'term']));
    const type = normalizeValue(pickValue(row, ['type', 'coursetype', 'category', 'coursecategory']));
    const requiredPeriods = toNumber(pickValue(row, ['requiredperiodsperweek', 'periodsperweek', 'periods/week', 'required periods', 'requiredperiods', 'hoursperweek']));
    const isLab = /lab/i.test(type) || toBoolean(pickValue(row, ['lab', 'islab', 'islabcourse']));

    if (!code) warnings.push(`Course row ${index + 2} is missing Course Code.`);
    if (!name) warnings.push(`Course row ${index + 2} is missing Course Name.`);
    if (!department) warnings.push(`Course row ${index + 2} is missing Department.`);
    if (requiredPeriods <= 0) warnings.push(`Course row ${index + 2} has an invalid period count. Capacity cannot be zero.`);

    return {
        code: code || `COURSE-${index + 1}`,
        name,
        department,
        year: year || '1',
        semester: semester || '1',
        type: type || 'THEORY',
        requiredPeriodsPerWeek: requiredPeriods > 0 ? requiredPeriods : 4,
        isLab,
    };
};

const mapSectionRecord = (row: Row, index: number, warnings: string[]) => {
    const name = normalizeValue(pickValue(row, ['section', 'sectionname', 'section name', 'name', 'classname', 'class']));
    const department = normalizeValue(pickValue(row, ['department', 'dept', 'branch', 'departmentname']));
    const year = normalizeValue(pickValue(row, ['year', 'academicyear', 'classyear', 'yearofstudy']));
    const semester = normalizeValue(pickValue(row, ['semester', 'sem', 'term']));
    const strength = toNumber(pickValue(row, ['strength', 'studentstrength', 'capacity', 'students']));
    const advisor = normalizeValue(pickValue(row, ['advisor', 'facultyadvisor', 'mentor']));
    const block = normalizeValue(pickValue(row, ['block', 'assignedblock', 'blockname']));

    if (!name) warnings.push(`Section row ${index + 2} is missing Section Name.`);
    if (!department) warnings.push(`Section row ${index + 2} is missing Department.`);
    if (!year) warnings.push(`Section row ${index + 2} is missing Year.`);
    if (strength <= 0) warnings.push(`Section row ${index + 2} has an invalid Strength. Capacity must be a positive number.`);

    return {
        name: name || `SECTION-${index + 1}`,
        department,
        year: year || '1',
        semester: semester || '1',
        strength: strength > 0 ? strength : 60,
        advisor: advisor || 'Academic Office',
        block: block || 'A Block',
    };
};

const mapRoomRecord = (row: Row, index: number, warnings: string[]) => {
    const roomName = normalizeValue(pickValue(row, ['room', 'roomnumber', 'roomno', 'room name', 'roomname', 'classroom', 'classname']));
    const block = normalizeValue(pickValue(row, ['block', 'blockname']));
    const floor = normalizeValue(pickValue(row, ['floor', 'level']));
    const capacity = toNumber(pickValue(row, ['capacity', 'strength', 'seats', 'capacityseats']));
    const department = normalizeValue(pickValue(row, ['department', 'dept', 'branch', 'departmentname']));
    const roomType = normalizeValue(pickValue(row, ['roomtype', 'type', 'classroomtype']));
    const active = toBoolean(pickValue(row, ['active', 'isactive', 'status']));

    if (!roomName) warnings.push(`Room row ${index + 2} is missing Room Number.`);
    if (capacity <= 0) warnings.push(`Room row ${index + 2} has invalid Capacity. Capacity must be a positive number.`);

    return {
        roomName: roomName || `ROOM-${index + 1}`,
        block: block || 'A Block',
        floor: floor || 'Ground Floor',
        capacity: capacity > 0 ? capacity : 60,
        department: department || 'Shared',
        roomType: roomType || 'TEACHING_ROOM',
        active,
    };
};

const mapDepartmentRecord = (row: Row, index: number, warnings: string[]) => {
    const code = normalizeValue(pickValue(row, ['code', 'departmentcode', 'deptcode']));
    const name = normalizeValue(pickValue(row, ['name', 'departmentname', 'deptname', 'department']));

    if (!code) warnings.push(`Department row ${index + 2} is missing Department Code.`);
    if (!name) warnings.push(`Department row ${index + 2} is missing Department Name.`);

    return {
        code: code || `DEPT-${index + 1}`,
        name: name || `Department ${index + 1}`,
    };
};

const mapBlockRecord = (row: Row, index: number, warnings: string[]) => {
    const code = normalizeValue(pickValue(row, ['code', 'blockcode']));
    const name = normalizeValue(pickValue(row, ['name', 'blockname', 'block']));

    if (!code) warnings.push(`Block row ${index + 2} is missing Block Code.`);
    if (!name) warnings.push(`Block row ${index + 2} is missing Block Name.`);

    return {
        code: code || `BLOCK-${index + 1}`,
        name: name || `Block ${index + 1}`,
    };
};

const mapLaboratoryRecord = (row: Row, index: number, warnings: string[]) => {
    const labName = normalizeValue(pickValue(row, ['laboratory', 'lab', 'labname', 'laboratoryname', 'name']));
    const block = normalizeValue(pickValue(row, ['block', 'blockname']));
    const floor = normalizeValue(pickValue(row, ['floor', 'level']));
    const capacity = toNumber(pickValue(row, ['capacity', 'strength', 'seats', 'labcapacity']));
    const labType = normalizeValue(pickValue(row, ['labtype', 'type', 'laboratorytype']));
    const equipment = normalizeValue(pickValue(row, ['equipment', 'resources', 'labresources']));
    const active = toBoolean(pickValue(row, ['active', 'isactive', 'status']));

    if (!labName) warnings.push(`Laboratory row ${index + 2} is missing Laboratory Name.`);
    if (capacity <= 0) warnings.push(`Laboratory row ${index + 2} has invalid Capacity. Capacity must be a positive number.`);

    return {
        name: labName || `LAB-${index + 1}`,
        block: block || 'A Block',
        floor: floor || 'Ground Floor',
        capacity: capacity > 0 ? capacity : 30,
        labType: labType || 'Computer',
        equipment: equipment || 'General',
        active,
    };
};

const mapAvailabilityRecord = (row: Row, index: number, warnings: string[]) => {
    const facultyId = normalizeValue(pickValue(row, ['facultyid', 'facultyidnumber', 'registrationno', 'employeeid', 'staffid', 'teacherid']));
    const day = normalizeValue(pickValue(row, ['day', 'weekday', 'dayofweek']));
    const period = normalizeValue(pickValue(row, ['period', 'periodnumber', 'periodno', 'slot']));
    const available = toBoolean(pickValue(row, ['available', 'status', 'isavailable', 'free']));
    const preferred = toBoolean(pickValue(row, ['preferred', 'preferredslot']));

    if (!facultyId) warnings.push(`Availability row ${index + 2} is missing Faculty ID.`);
    if (!day) warnings.push(`Availability row ${index + 2} is missing Day.`);
    if (!period) warnings.push(`Availability row ${index + 2} is missing Period.`);

    return {
        facultyId: facultyId || `FAC-${index + 1}`,
        day: day || 'Monday',
        period: period || '1',
        available,
        preferred,
    };
};

const mapAllocationRecord = (row: Row, index: number, warnings: string[]) => {
    const facultyId = normalizeValue(pickValue(row, ['facultyid', 'facultyidnumber', 'registrationno', 'employeeid', 'staffid', 'teacherid']));
    const courseCode = normalizeValue(pickValue(row, ['coursecode', 'subjectcode', 'code', 'course']));
    const sectionName = normalizeValue(pickValue(row, ['section', 'sectionname', 'sectionname', 'class']));
    const department = normalizeValue(pickValue(row, ['department', 'dept', 'branch']));

    if (!facultyId) warnings.push(`Allocation row ${index + 2} is missing Faculty ID.`);
    if (!courseCode) warnings.push(`Allocation row ${index + 2} is missing Course Code.`);
    if (!sectionName) warnings.push(`Allocation row ${index + 2} is missing Section.`);

    return {
        facultyId: facultyId || `FAC-${index + 1}`,
        courseCode: courseCode || `COURSE-${index + 1}`,
        sectionName: sectionName || `SECTION-${index + 1}`,
        department,
    };
};

const mapBatchRecord = (row: Row, index: number, warnings: string[]) => {
    const sectionName = normalizeValue(pickValue(row, ['section', 'sectionname', 'classname', 'class']));
    const name = normalizeValue(pickValue(row, ['batchname', 'batch', 'name', 'labbatch']));
    const studentCount = toNumber(pickValue(row, ['studentcount', 'students', 'count', 'strength']));

    if (!sectionName) warnings.push(`Lab Batch row ${index + 2} is missing Section.`);
    if (studentCount <= 0) warnings.push(`Lab Batch row ${index + 2} has invalid Student Count. Capacity must be a positive number.`);

    return {
        sectionName: sectionName || `SECTION-${index + 1}`,
        name: name || `BATCH-${index + 1}`,
        studentCount: studentCount > 0 ? studentCount : 30,
    };
};

const mapConstraintRecord = (row: Row, index: number, warnings: string[]) => {
    const name = normalizeValue(pickValue(row, ['name', 'constraintname', 'rule', 'constraint']));
    const description = normalizeValue(pickValue(row, ['description', 'notes', 'details']));
    const value = normalizeValue(pickValue(row, ['value', 'rulevalue', 'setting']));
    const enabled = toBoolean(pickValue(row, ['enabled', 'isactive', 'status']));

    if (!name) warnings.push(`Constraint row ${index + 2} is missing Constraint Name.`);

    return {
        name: name || `CONSTRAINT-${index + 1}`,
        description: description || value || 'Imported constraint',
        type: normalizeValue(pickValue(row, ['type', 'constrainttype'])) || 'HARD',
        enabled,
        value,
    };
};

const parseDatasetMetadata = (metadata: string | null | undefined) => {
    if (!metadata) return null;
    try {
        return JSON.parse(metadata);
    } catch {
        return null;
    }
};

const buildDatasetPayload = (input: {
    name: string;
    academicYear: string;
    semester: string;
    rowsByType: Partial<Record<EntityType, Row[]>>;
    source: string;
}): { payload: DatasetPayload; warnings: string[]; errors: string[]; counts: Record<string, number> } => {
    const warnings: string[] = [];
    const errors: string[] = [];
    const rowsByType = input.rowsByType;

    const departmentsFromSheet = (rowsByType.department ?? []).map((row, index) => mapDepartmentRecord(row, index, warnings));
    const blocksFromSheet = (rowsByType.block ?? []).map((row, index) => mapBlockRecord(row, index, warnings));
    const faculty = (rowsByType.faculty ?? []).map((row, index) => mapFacultyRecord(row, index, warnings));
    const sections = (rowsByType.section ?? []).map((row, index) => mapSectionRecord(row, index, warnings));
    const courses = (rowsByType.course ?? []).map((row, index) => mapCourseRecord(row, index, warnings));
    const rooms = (rowsByType.room ?? []).map((row, index) => mapRoomRecord(row, index, warnings));
    const laboratories = (rowsByType.laboratory ?? []).map((row, index) => mapLaboratoryRecord(row, index, warnings));
    const availability = (rowsByType.facultyAvailability ?? []).map((row, index) => mapAvailabilityRecord(row, index, warnings));
    const allocations = (rowsByType.courseAllocation ?? []).map((row, index) => mapAllocationRecord(row, index, warnings));
    const batches = (rowsByType.labBatch ?? []).map((row, index) => mapBatchRecord(row, index, warnings));
    const constraints = (rowsByType.constraint ?? []).map((row, index) => mapConstraintRecord(row, index, warnings));

    faculty.forEach((record) => {
        if (!record.name) errors.push('Faculty Name is required.');
        if (!record.department) errors.push('Department is required.');
    });
    sections.forEach((record) => {
        if (!record.name) errors.push('Section Name is required.');
        if (!record.department) errors.push('Department is required.');
    });
    courses.forEach((record) => {
        if (!record.code) errors.push('Course Code is required.');
        if (!record.name) errors.push('Course Name is required.');
        if (!record.department) errors.push('Department is required.');
    });
    rooms.forEach((record) => {
        if (!record.roomName) errors.push('Room Number is required.');
        if (record.capacity <= 0) errors.push('Capacity must be a positive number.');
    });
    laboratories.forEach((record) => {
        if (!record.name) errors.push('Laboratory Name is required.');
        if (record.capacity <= 0) errors.push('Capacity must be a positive number.');
    });

    const derivedDepartments = Array.from(new Set([...faculty.map((item) => item.department), ...sections.map((item) => item.department), ...courses.map((item) => item.department)].filter(Boolean))).map((department) => ({
        code: department.toUpperCase().replace(/\s+/g, '_'),
        name: department,
    }));
    const departments = departmentsFromSheet.length > 0 ? departmentsFromSheet : derivedDepartments;

    const derivedBlocks = Array.from(new Set([...rooms.map((room) => room.block), ...laboratories.map((lab) => lab.block)].filter(Boolean))).map((block) => ({
        code: block.toUpperCase().replace(/\s+/g, '_'),
        name: block,
    }));
    const blocks = blocksFromSheet.length > 0 ? blocksFromSheet : derivedBlocks;

    const payload: DatasetPayload = {
        name: input.name,
        academicYear: input.academicYear,
        semester: input.semester,
        departments,
        blocks,
        faculty,
        sections,
        courses,
        rooms,
        laboratories,
        availability,
        allocations,
        batches,
        constraints,
    };

    return {
        payload,
        warnings: [...new Set(warnings)],
        errors: [...new Set(errors)],
        counts: {
            faculty: faculty.length,
            section: sections.length,
            course: courses.length,
            room: rooms.length,
            laboratory: laboratories.length,
            department: departments.length,
            block: blocks.length,
            facultyAvailability: availability.length,
            courseAllocation: allocations.length,
            labBatch: batches.length,
            constraint: constraints.length,
        },
    };
};

export const importCollegeData = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const mode = req.body?.mode === 'import' ? 'import' : 'preview';
        const datasetName = String(req.body?.datasetName || req.body?.name || 'My College Timetable');
        const academicYear = String(req.body?.academicYear || '2026-2027');
        const semester = String(req.body?.semester || '1');
        const incomingFiles = Array.isArray(req.body?.files) ? req.body.files : [];

        if (!incomingFiles.length) {
            const legacyFileName = String(req.body?.fileName ?? 'upload.xlsx');
            const legacyEncoded = String(req.body?.data ?? '');
            if (!legacyEncoded) throw new AppError('No spreadsheet data was provided.', 400);
            incomingFiles.push({ name: legacyFileName, content: legacyEncoded });
        }

        const spreadsheet = await loadSpreadsheet();
        const rowsByType: Partial<Record<EntityType, Row[]>> = {};
        const collectedWarnings: string[] = [];
        const fileSummaries: Array<{ name: string; sheets: string[]; type: string; records: number }> = [];

        for (const file of incomingFiles) {
            const fileName = String(file?.name ?? 'upload.xlsx');
            const content = String(file?.content ?? file?.data ?? '');
            if (!content) continue;

            const buffer = asBase64Buffer(content);
            const workbook = spreadsheet.read(buffer, { type: 'buffer' });
            const sheets: string[] = [];
            const fileRowsByType: Partial<Record<EntityType, Row[]>> = {};

            for (const sheetName of workbook.SheetNames) {
                const sheet = workbook.Sheets[sheetName];
                if (!sheet) continue;
                const rawRows = spreadsheet.utils.sheet_to_json(sheet, { defval: '' }) as Row[];
                const normalized = normalizedRows(rawRows);
                const type = classifySheet(sheetName, normalized);
                if (!type) {
                    collectedWarnings.push(`Sheet "${sheetName}" in ${fileName} was skipped because its headers do not match a supported college data type.`);
                    continue;
                }
                sheets.push(sheetName);
                fileRowsByType[type] = [...(fileRowsByType[type] ?? []), ...normalized];
            }

            for (const [type, rows] of Object.entries(fileRowsByType) as [EntityType, Row[]][]) {
                rowsByType[type] = [...(rowsByType[type] ?? []), ...rows];
            }

            fileSummaries.push({
                name: fileName,
                sheets,
                type: sheets.length === 1 ? fileTypeLabels[(Object.keys(fileRowsByType)[0] as EntityType) ?? 'faculty'] ?? 'Spreadsheet' : 'Multi-sheet workbook',
                records: Object.values(fileRowsByType).reduce((total, rows) => total + rows.length, 0),
            });
        }

        if (!Object.values(rowsByType).some((rows) => Array.isArray(rows) && rows.length > 0)) {
            throw new AppError('No supported Faculty, Course, Section, Room, Laboratory, Availability, Allocation, Lab Batch, or Constraint sheet was found.', 422);
        }

        const datasetInfo = buildDatasetPayload({
            name: datasetName || inferDatasetName(fileSummaries.map((item) => item.name)),
            academicYear,
            semester,
            rowsByType,
            source: fileSummaries.length ? fileSummaries.map((item) => item.name).join(', ') : 'manual-entry',
        });

        const errors = [...datasetInfo.errors, ...(datasetInfo.payload.faculty.length === 0 && datasetInfo.payload.sections.length === 0 ? ['No valid faculty or section records were found in the uploaded files.'] : [])];

        if (errors.length && mode === 'preview') {
            return res.json(successResponse({
                fileName: fileSummaries.map((item) => item.name).join(', '),
                mode,
                dataset: datasetInfo.payload,
                counts: datasetInfo.counts,
                warnings: [...new Set([...collectedWarnings, ...datasetInfo.warnings])],
                errors: [...new Set(errors)],
                imported: false,
                summary: fileSummaries,
            }));
        }

        if (errors.length && mode === 'import') {
            throw new AppError([...new Set(errors)].slice(0, 10).join(' '), 422);
        }

        if (mode === 'import') {
            const saved = await prisma.$transaction(async (transaction) => {
                await transaction.timetableDataset.updateMany({ where: { status: 'ACTIVE' }, data: { status: 'DRAFT' } });
                return transaction.timetableDataset.create({
                    data: {
                        name: datasetInfo.payload.name,
                        academicYear: datasetInfo.payload.academicYear,
                        semester: datasetInfo.payload.semester,
                        datasetType: 'COLLEGE',
                        isActive: true,
                        source: fileSummaries.length ? fileSummaries.map((item) => item.name).join(', ') : 'manual-entry',
                        metadata: JSON.stringify({
                            files: fileSummaries,
                            importedAt: new Date().toISOString(),
                            totalRecords: datasetInfo.payload.faculty.length + datasetInfo.payload.sections.length + datasetInfo.payload.courses.length + datasetInfo.payload.rooms.length + datasetInfo.payload.laboratories.length + datasetInfo.payload.availability.length + datasetInfo.payload.allocations.length + datasetInfo.payload.batches.length + datasetInfo.payload.constraints.length,
                            sourceType: 'excel-import',
                        }),
                        payload: JSON.stringify(datasetInfo.payload),
                        status: 'ACTIVE',
                    },
                });
            });

            return res.json(successResponse({
                fileName: fileSummaries.map((item) => item.name).join(', '),
                mode,
                dataset: datasetInfo.payload,
                datasetId: saved.id,
                counts: datasetInfo.counts,
                warnings: [...new Set([...collectedWarnings, ...datasetInfo.warnings])],
                errors: [],
                imported: true,
                summary: fileSummaries,
            }));
        }

        return res.json(successResponse({
            fileName: fileSummaries.map((item) => item.name).join(', '),
            mode,
            dataset: datasetInfo.payload,
            counts: datasetInfo.counts,
            warnings: [...new Set([...collectedWarnings, ...datasetInfo.warnings])],
            errors: [],
            imported: false,
            summary: fileSummaries,
        }));
    } catch (error) {
        next(error);
    }
};

export const getCollegeDatasets = async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const datasets = await prisma.timetableDataset.findMany({
            orderBy: { createdAt: 'desc' },
        });

        const normalized = datasets.map((dataset) => ({
            ...dataset,
            metadata: parseDatasetMetadata(dataset.metadata),
            payload: dataset.payload ? JSON.parse(dataset.payload) : null,
        }));

        res.json(successResponse(normalized));
    } catch (error) {
        next(error);
    }
};

export const getActiveCollegeDataset = async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const dataset = await prisma.timetableDataset.findFirst({
            where: { status: 'ACTIVE' },
            orderBy: { createdAt: 'desc' },
        });

        res.json(successResponse(dataset ? { ...dataset, metadata: parseDatasetMetadata(dataset.metadata), payload: dataset.payload ? JSON.parse(dataset.payload) : null } : null));
    } catch (error) {
        next(error);
    }
};

export const saveCollegeDataset = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const body = req.body ?? {};
        const payload = body.dataset ?? body;
        if (!payload || typeof payload !== 'object') {
            throw new AppError('A valid dataset payload is required.', 400);
        }

        const name = String(payload.name || body.name || 'My College Timetable');
        const academicYear = String(payload.academicYear || body.academicYear || '2026-2027');
        const semester = String(payload.semester || body.semester || '1');

        const datasetRecord = await prisma.$transaction(async (transaction) => {
            await transaction.timetableDataset.updateMany({ where: { status: 'ACTIVE' }, data: { status: 'DRAFT' } });
            return transaction.timetableDataset.create({
                data: {
                    name,
                    academicYear,
                    semester,
                    datasetType: 'COLLEGE',
                    isActive: true,
                    source: payload.source || body.source || 'manual-entry',
                    metadata: JSON.stringify({
                        importedAt: new Date().toISOString(),
                        sourceType: payload.source || body.source || 'manual-entry',
                    }),
                    payload: JSON.stringify(payload),
                    status: 'ACTIVE',
                },
            });
        });

        res.json(successResponse({
            id: datasetRecord.id,
            name: datasetRecord.name,
            academicYear: datasetRecord.academicYear,
            semester: datasetRecord.semester,
            datasetType: datasetRecord.datasetType,
            isActive: datasetRecord.isActive,
            source: datasetRecord.source,
            metadata: parseDatasetMetadata(datasetRecord.metadata),
            status: datasetRecord.status,
            payload: JSON.parse(datasetRecord.payload),
        }));
    } catch (error) {
        next(error);
    }
};

export const activateCollegeDataset = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = String(req.params.id ?? '');
        const dataset = await prisma.timetableDataset.findUnique({ where: { id } });
        if (!dataset) throw new AppError('Dataset not found.', 404);

        const updated = await prisma.$transaction(async (transaction) => {
            await transaction.timetableDataset.updateMany({ where: { status: 'ACTIVE' }, data: { status: 'DRAFT' } });
            return transaction.timetableDataset.update({
                where: { id },
                data: { status: 'ACTIVE' },
            });
        });

        res.json(successResponse({
            id: updated.id,
            name: updated.name,
            academicYear: updated.academicYear,
            semester: updated.semester,
            datasetType: updated.datasetType,
            isActive: updated.isActive,
            source: updated.source,
            metadata: parseDatasetMetadata(updated.metadata),
            status: updated.status,
            payload: JSON.parse(updated.payload),
        }));
    } catch (error) {
        next(error);
    }
};

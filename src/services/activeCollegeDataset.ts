import { api } from './api';

export type ActiveDatasetPayload = {
    name?: string;
    academicYear?: string;
    semester?: string;
    departments?: Array<Record<string, unknown>>;
    faculty?: Array<Record<string, unknown>>;
    sections?: Array<Record<string, unknown>>;
    courses?: Array<Record<string, unknown>>;
    rooms?: Array<Record<string, unknown>>;
    laboratories?: Array<Record<string, unknown>>;
    availability?: Array<Record<string, unknown>>;
    allocations?: Array<Record<string, unknown>>;
    batches?: Array<Record<string, unknown>>;
    constraints?: Array<Record<string, unknown>>;
    [key: string]: unknown;
};

export type ActiveDatasetLoadResult = {
    source: 'active' | 'sample' | 'error';
    dataset: ActiveDatasetPayload | null;
    message: string | null;
};

const readString = (value: unknown) => {
    if (value === undefined || value === null) return '';
    return String(value).trim();
};

export const normalizeDatasetValue = <T>(value: T | undefined, fallback: T): T => {
    if (value === undefined || value === null) return fallback;
    return value;
};

export const getDatasetDepartments = (dataset: ActiveDatasetPayload | null) => {
    const departments = Array.isArray(dataset?.departments) ? dataset.departments : [];
    if (departments.length > 0) {
        return departments.map((department) => ({
            code: readString(department.code ?? department.name ?? department.id ?? 'UNKNOWN'),
            name: readString(department.name ?? department.code ?? department.id ?? 'Unknown department'),
        }));
    }

    const derived = new Map<string, string>();
    const sources = [
        ...(Array.isArray(dataset?.faculty) ? dataset.faculty : []),
        ...(Array.isArray(dataset?.sections) ? dataset.sections : []),
        ...(Array.isArray(dataset?.courses) ? dataset.courses : []),
    ];

    sources.forEach((entry) => {
        const code = readString(entry.department ?? entry.dept ?? entry.departmentCode);
        if (code) {
            derived.set(code.toUpperCase(), code);
        }
    });

    return Array.from(derived.entries()).map(([code, name]) => ({ code, name }));
};

export const getDatasetSections = (dataset: ActiveDatasetPayload | null) => {
    if (!dataset || !Array.isArray(dataset.sections)) return [];

    return dataset.sections.map((section, index) => ({
        id: readString(section.section ?? section.sectionName ?? section.name ?? section.id ?? `SECTION-${index + 1}`),
        name: readString(section.section ?? section.sectionName ?? section.name ?? section.id ?? `SECTION-${index + 1}`),
        department: readString(section.department ?? section.dept ?? section.departmentCode ?? 'UNKNOWN'),
        year: readString(section.year ?? section.academicYear ?? '1'),
        semester: readString(section.semester ?? '1'),
        strength: Number(section.strength ?? section.studentStrength ?? 0),
        block: readString(section.block ?? section.assignedBlock ?? 'A Block'),
        advisor: readString(section.advisor ?? 'Academic Office'),
    }));
};

export const getDatasetFaculty = (dataset: ActiveDatasetPayload | null) => {
    if (!dataset || !Array.isArray(dataset.faculty)) return [];

    return dataset.faculty.map((person) => ({
        id: readString(person.id ?? person.facultyId ?? person.email ?? person.name ?? 'FACULTY'),
        facultyId: readString(person.facultyId ?? person.id ?? person.email ?? person.name ?? 'FACULTY'),
        name: readString(person.name ?? 'Unknown Faculty'),
        department: readString(person.department ?? person.dept ?? 'UNKNOWN'),
        designation: readString(person.designation ?? 'Assistant Professor'),
        email: readString(person.email ?? ''),
        weeklyLoad: Number(person.weeklyLoad ?? 0),
        active: Boolean(person.active ?? true),
    }));
};

export const getDatasetCourses = (dataset: ActiveDatasetPayload | null) => {
    if (!dataset || !Array.isArray(dataset.courses)) return [];

    return dataset.courses.map((course) => ({
        code: readString(course.code ?? course.courseCode ?? 'COURSE'),
        name: readString(course.name ?? course.courseName ?? 'Course'),
        department: readString(course.department ?? course.dept ?? 'UNKNOWN'),
        year: readString(course.year ?? '1'),
        semester: readString(course.semester ?? '1'),
        type: readString(course.type ?? (course.isLab ? 'LAB' : 'THEORY')).toUpperCase(),
        requiredPeriodsPerWeek: Number(course.requiredPeriodsPerWeek ?? course.periodsPerWeek ?? 0),
        isLab: Boolean(course.isLab ?? /lab/i.test(readString(course.type ?? ''))),
    }));
};

export const getDatasetRooms = (dataset: ActiveDatasetPayload | null) => {
    if (!dataset || !Array.isArray(dataset.rooms)) return [];

    return dataset.rooms.map((room) => ({
        id: readString(room.id ?? room.roomId ?? room.roomName ?? 'ROOM'),
        roomName: readString(room.roomName ?? room.roomNumber ?? room.name ?? 'ROOM'),
        block: readString(room.block ?? room.blockName ?? 'A Block'),
        floor: readString(room.floor ?? 'Ground Floor'),
        capacity: Number(room.capacity ?? 0),
        department: readString(room.department ?? 'Shared'),
        roomType: readString(room.roomType ?? 'TEACHING_ROOM'),
        active: Boolean(room.active ?? true),
    }));
};

export const getDatasetLaboratories = (dataset: ActiveDatasetPayload | null) => {
    if (!dataset || !Array.isArray(dataset.laboratories)) return [];

    return dataset.laboratories.map((lab) => ({
        id: readString(lab.id ?? lab.labId ?? lab.name ?? 'LAB'),
        name: readString(lab.name ?? 'LAB'),
        block: readString(lab.block ?? lab.blockName ?? 'A Block'),
        floor: readString(lab.floor ?? 'Ground Floor'),
        capacity: Number(lab.capacity ?? 0),
        labType: readString(lab.labType ?? lab.type ?? 'Computer'),
        equipment: readString(lab.equipment ?? ''),
        active: Boolean(lab.active ?? true),
    }));
};

export const getDatasetAvailability = (dataset: ActiveDatasetPayload | null) => {
    if (!dataset || !Array.isArray(dataset.availability)) return [];

    return dataset.availability.map((entry) => ({
        facultyId: readString(entry.facultyId ?? entry.faculty ?? ''),
        day: readString(entry.day ?? 'Monday'),
        period: readString(entry.period ?? entry.periodNumber ?? ''),
        available: Boolean(entry.available ?? true),
        preferred: Boolean(entry.preferred ?? false),
    }));
};

export const getDatasetBlocks = (dataset: ActiveDatasetPayload | null) => {
    const blockNames = new Set<string>();
    getDatasetRooms(dataset).forEach((room) => { if (room.block) blockNames.add(room.block); });
    getDatasetLaboratories(dataset).forEach((lab) => { if (lab.block) blockNames.add(lab.block); });
    return Array.from(blockNames).map((name, index) => ({ id: `block-${index + 1}`, name }));
};

export async function loadActiveCollegeDataset(): Promise<ActiveDatasetLoadResult> {
    try {
        const response = await api.getActiveCollegeDataset();
        const payload = response && typeof response === 'object' && 'payload' in response
            ? (response.payload as ActiveDatasetPayload | undefined) ?? null
            : (response as ActiveDatasetPayload | null) ?? null;

        if (payload && typeof payload === 'object' && Object.keys(payload).length > 0) {
            return { source: 'active', dataset: payload, message: null };
        }

        return { source: 'sample', dataset: null, message: null };
    } catch (error) {
        return {
            source: 'error',
            dataset: null,
            message: error instanceof Error ? error.message : 'API unavailable — the active dataset could not be loaded.',
        };
    }
}

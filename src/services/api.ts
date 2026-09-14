const API_BASE_URL = ((import.meta as any).env?.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:5000';

type ApiEnvelope<T> = {
    success: boolean;
    data: T;
    message?: string;
};

async function request<T>(endpoint: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: {
            Accept: 'application/json',
            ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...init,
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Request failed with status ${response.status}`);
    }

    const payload = await response.json() as ApiEnvelope<T> | T;
    if (payload && typeof payload === 'object' && 'success' in payload && 'data' in payload) {
        return (payload as ApiEnvelope<T>).data;
    }

    return payload as T;
}

export const api = {
    health: () => request<{ status: string }>('/api/health'),
    departments: () => request<any[]>('/api/departments'),
    sections: () => request<any[]>('/api/sections'),
    faculty: () => request<any[]>('/api/faculty'),
    courses: () => request<any[]>('/api/courses'),
    blocks: () => request<any[]>('/api/blocks'),
    rooms: () => request<any[]>('/api/rooms'),
    laboratories: () => request<any[]>('/api/laboratories'),
    availability: () => request<any[]>('/api/availability'),
    labBatches: () => request<any[]>('/api/lab-batches'),
    timetable: () => request<any[]>('/api/timetable'),
    conflicts: () => request<any[]>('/api/conflicts'),
    analytics: () => request<any>('/api/analytics'),
    generateTimetable: () => request<{ generatedEntries: number; sectionsProcessed: number; conflicts: number }>('/api/timetable/generate', { method: 'POST' }),
    changeRequests: () => request<any[]>('/api/change-requests'),
    importCollegeData: (payload: { fileName?: string; data?: string; mode?: 'preview' | 'import'; datasetName?: string; academicYear?: string; semester?: string; files?: Array<{ name: string; content: string }> }) => request<{ fileName: string; mode: string; counts: Record<string, number>; imported: boolean; dataset?: Record<string, unknown>; warnings?: string[]; errors?: string[]; summary?: Array<{ name: string; sheets: string[]; type: string; records: number }> }>('/api/college-data/import', { method: 'POST', body: JSON.stringify(payload) }),
    saveCollegeDataset: (payload: unknown) => request<{ id: string; name: string; academicYear: string; semester: string; status: string; payload: Record<string, unknown> }>('/api/college-data/save', { method: 'POST', body: JSON.stringify(payload) }),
    activateCollegeDataset: (id: string) => request<{ id: string; name: string; academicYear: string; semester: string; status: string; payload: Record<string, unknown> }>(`/api/college-data/${id}/activate`, { method: 'POST' }),
    getCollegeDatasets: () => request<Array<Record<string, unknown>>>('/api/college-data'),
    getActiveCollegeDataset: () => request<Record<string, unknown> | null>('/api/college-data/active'),
    saveTimetableInput: (payload: unknown) => request<{ id: string; name: string; status: string }>('/api/timetable-input', { method: 'POST', body: JSON.stringify(payload) }),
    generateTimetableInput: (id: string) => request<{ datasetId: string; generatedEntries: number; sections: number; timetable: unknown[] }>(`/api/timetable-input/${id}/generate`, { method: 'POST' }),
};

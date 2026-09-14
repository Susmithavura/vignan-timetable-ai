import { CloudUpload, Download, ShieldCheck, Sparkles, Wand2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { api } from '../services/api';

const templateItems = ['Faculty Template', 'Course Template', 'Section Template', 'Room Template', 'Laboratory Template', 'Faculty Availability Template', 'Course Allocation Template', 'Lab Batch Template'];

type ImportSummary = {
    name: string;
    sheets: string[];
    type: string;
    records: number;
};

type ParsedResponse = {
    fileName?: string;
    mode?: string;
    counts?: Record<string, number>;
    imported?: boolean;
    dataset?: Record<string, unknown>;
    warnings?: string[];
    errors?: string[];
    summary?: ImportSummary[];
    datasetId?: string;
};

export function CollegeDataPage() {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedFiles, setSelectedFiles] = useState<Array<{ name: string; content: string }>>([]);
    const [datasetName, setDatasetName] = useState('My College Timetable');
    const [academicYear, setAcademicYear] = useState('2026-2027');
    const [semester, setSemester] = useState('1');
    const [counts, setCounts] = useState<Record<string, number>>({ faculty: 0, section: 0, room: 0, laboratory: 0, course: 0, facultyAvailability: 0, courseAllocation: 0, labBatch: 0, constraint: 0 });
    const [validationMessage, setValidationMessage] = useState<string | null>(null);
    const [response, setResponse] = useState<ParsedResponse | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const readFiles = (files: FileList | File[] | null) => {
        const list = Array.from(files ?? []);
        if (!list.length) return;

        Promise.all(list.map((file) => new Promise<{ name: string; content: string }>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve({ name: file.name, content: String(reader.result ?? '') });
            reader.onerror = () => reject(new Error(`Unable to read ${file.name}.`));
            reader.readAsDataURL(file);
        }))).then((values) => {
            setSelectedFiles(values);
            setValidationMessage(`${values.length} file(s) selected. Preview to detect sheets and validate records.`);
            setResponse(null);
        }).catch((error) => {
            setValidationMessage(error instanceof Error ? error.message : 'Unable to read the selected files.');
        });
    };

    const parseUpload = async (mode: 'preview' | 'import') => {
        if (!selectedFiles.length) {
            setValidationMessage('Select a Faculty, Course, Section, Room, Laboratory, or Availability spreadsheet first.');
            return;
        }

        setIsProcessing(true);
        setValidationMessage(null);
        try {
            const payload = {
                mode,
                datasetName,
                academicYear,
                semester,
                files: selectedFiles,
            };
            const result = await api.importCollegeData(payload);
            setResponse(result);
            setCounts({
                ...counts,
                ...(result.counts ?? {}),
            });

            if (result.errors?.length) {
                setValidationMessage(mode === 'import' ? result.errors[0] : 'Preview complete. Review validation issues before importing.');
            } else if (result.imported) {
                setValidationMessage('Real college data was imported and saved as the active dataset.');
            } else {
                setValidationMessage('Records parsed and validated successfully. Review the preview and import when ready.');
            }
        } catch (error) {
            setValidationMessage(error instanceof Error ? error.message : 'Spreadsheet parsing failed.');
        } finally {
            setIsProcessing(false);
        }
    };

    const saveCurrentDataset = async () => {
        if (!response?.dataset) {
            setValidationMessage('Preview or import the dataset first before saving it as the active dataset.');
            return;
        }

        try {
            const payload = {
                ...response.dataset,
                name: response.dataset.name ?? datasetName,
                academicYear: response.dataset.academicYear ?? academicYear,
                semester: response.dataset.semester ?? semester,
            };
            const saved = await api.saveCollegeDataset(payload);
            setValidationMessage(`Dataset "${saved.name}" was saved and activated as the active college dataset.`);
            setResponse((previous) => previous ? { ...previous, datasetId: saved.id, dataset: saved.payload as Record<string, unknown> } : previous);
        } catch (error) {
            setValidationMessage(error instanceof Error ? error.message : 'Unable to save the selected dataset.');
        }
    };

    const totalRecords = Object.values(counts).reduce((sum, value) => sum + value, 0);

    const downloadTemplate = (template: string) => {
        const headers = template.includes('Faculty') ? 'Faculty ID,Name,Department,Designation,Email,Weekly Load' : template.includes('Course') ? 'Course Code,Course Name,Department,Year,Semester,Type,Periods/Week' : template.includes('Section') ? 'Section Name,Department,Year,Semester,Strength,Advisor,Block' : template.includes('Room') ? 'Room Number,Block,Floor,Capacity,Department,Room Type' : template.includes('Laboratory') ? 'Laboratory,Block,Floor,Capacity,Lab Type,Equipment' : 'Faculty ID,Day,Period,Available';
        const blob = new Blob([`${headers}\n`], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${template.replace(/\s+/g, '-')}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-6">
            <div className="card p-5">
                <div className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">College Data</div>
                <div className="mt-1 text-2xl font-bold text-slate-800">Upload and validate academic records</div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                <div className="card p-6">
                    <div className="mb-4 flex items-center gap-2">
                        <CloudUpload className="h-5 w-5 text-sky-700" />
                        <div className="text-lg font-semibold text-slate-800">Upload College Data</div>
                    </div>

                    <div
                        className="rounded-3xl border-2 border-dashed border-sky-200 bg-sky-50 p-8 text-center"
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                            event.preventDefault();
                            readFiles(event.dataTransfer.files);
                        }}
                    >
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white text-sky-700 shadow-sm">
                            <CloudUpload className="h-7 w-7" />
                        </div>
                        <div className="mt-4 text-lg font-semibold text-slate-800">Drag & drop files here</div>
                        <div className="mt-2 text-sm text-slate-500">Faculty.xlsx • Courses.xlsx • Sections.xlsx • Rooms.xlsx • Laboratories.xlsx • Availability.xlsx • Allocations.xlsx • Lab Batches.xlsx</div>
                        <input ref={fileInputRef} type="file" accept=".csv,.tsv,.xlsx,.xls" multiple className="hidden" onChange={(event) => readFiles(event.target.files)} />
                        <button type="button" onClick={() => fileInputRef.current?.click()} className="mt-5 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700">Browse files</button>
                        {selectedFiles.length > 0 && (
                            <div className="mt-3 text-sm text-slate-600">
                                Selected files: {selectedFiles.map((file) => file.name).join(', ')}
                            </div>
                        )}
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <label className="text-sm font-medium text-slate-600">
                            Dataset name
                            <input value={datasetName} onChange={(event) => setDatasetName(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none ring-0 focus:border-sky-400" />
                        </label>
                        <label className="text-sm font-medium text-slate-600">
                            Academic year
                            <input value={academicYear} onChange={(event) => setAcademicYear(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none ring-0 focus:border-sky-400" />
                        </label>
                        <label className="text-sm font-medium text-slate-600 md:col-span-2">
                            Semester
                            <input value={semester} onChange={(event) => setSemester(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none ring-0 focus:border-sky-400" />
                        </label>
                    </div>

                    <div className="mt-6 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-sky-100 bg-sky-50 p-3">
                            <div className="text-xs uppercase tracking-[0.2em] text-sky-700">Detected</div>
                            <div className="mt-2 text-2xl font-bold text-slate-800">{counts.faculty ?? 0}</div>
                            <div className="text-sm text-slate-500">faculty records detected</div>
                        </div>
                        <div className="rounded-2xl border border-sky-100 bg-sky-50 p-3">
                            <div className="text-xs uppercase tracking-[0.2em] text-sky-700">Detected</div>
                            <div className="mt-2 text-2xl font-bold text-slate-800">{counts.section ?? 0}</div>
                            <div className="text-sm text-slate-500">section records detected</div>
                        </div>
                        <div className="rounded-2xl border border-sky-100 bg-sky-50 p-3">
                            <div className="text-xs uppercase tracking-[0.2em] text-sky-700">Detected</div>
                            <div className="mt-2 text-2xl font-bold text-slate-800">{counts.room ?? 0}</div>
                            <div className="text-sm text-slate-500">room records detected</div>
                        </div>
                        <div className="rounded-2xl border border-sky-100 bg-sky-50 p-3">
                            <div className="text-xs uppercase tracking-[0.2em] text-sky-700">Detected</div>
                            <div className="mt-2 text-2xl font-bold text-slate-800">{counts.laboratory ?? 0}</div>
                            <div className="text-sm text-slate-500">laboratory records detected</div>
                        </div>
                    </div>

                    <div className="mt-6 space-y-3">
                        {validationMessage && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{validationMessage}</div>}
                        {response?.summary && (
                            <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-slate-700">
                                <div className="mb-2 flex items-center gap-2 font-semibold text-sky-700"><ShieldCheck className="h-4 w-4" /> Dataset summary</div>
                                <div>Detected files: {response.summary.map((item) => `${item.name} (${item.sheets.join(', ') || 'no sheet names'})`).join(' | ')}</div>
                                <div className="mt-1">Detected records: {totalRecords}</div>
                            </div>
                        )}
                    </div>

                    <div className="mt-6 flex flex-wrap gap-3">
                        <button type="button" disabled={isProcessing || !selectedFiles.length} onClick={() => void parseUpload('preview')} className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-sky-700 ring-1 ring-sky-200 disabled:cursor-not-allowed disabled:opacity-50">Preview Data</button>
                        <button type="button" disabled={isProcessing || !selectedFiles.length} onClick={() => void parseUpload('import')} className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50">Import Data</button>
                        <button type="button" disabled={isProcessing || !response?.dataset} onClick={() => void saveCurrentDataset()} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">Set as Active Dataset</button>
                    </div>

                    {response && (
                        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-slate-700"><Sparkles className="h-4 w-4 text-sky-700" /> Import preview</div>
                            <div className="grid gap-4 md:grid-cols-2">
                                <div>
                                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Dataset</div>
                                    <div className="mt-1 text-lg font-semibold text-slate-800">{String(response.dataset?.name ?? datasetName)}</div>
                                    <div className="text-sm text-slate-600">Academic year: {String(response.dataset?.academicYear ?? academicYear)} • Semester: {String(response.dataset?.semester ?? semester)}</div>
                                </div>
                                <div>
                                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Files detected</div>
                                    <div className="mt-1 text-sm text-slate-700">{response.summary?.map((item) => `${item.name} • ${item.type}`).join(', ') || selectedFiles.map((file) => file.name).join(', ')}</div>
                                </div>
                            </div>

                            {response.warnings?.length ? (
                                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
                                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-700"><Wand2 className="h-4 w-4" /> Warnings</div>
                                    <ul className="list-disc space-y-1 pl-5 text-sm text-amber-800">
                                        {response.warnings.slice(0, 8).map((warning) => <li key={warning}>{warning}</li>)}
                                    </ul>
                                </div>
                            ) : null}

                            {response.errors?.length ? (
                                <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3">
                                    <div className="mb-2 text-sm font-semibold text-rose-700">Validation errors</div>
                                    <ul className="list-disc space-y-1 pl-5 text-sm text-rose-800">
                                        {response.errors.slice(0, 8).map((error) => <li key={error}>{error}</li>)}
                                    </ul>
                                </div>
                            ) : null}

                            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                {['faculty', 'course', 'section', 'room', 'laboratory', 'facultyAvailability', 'courseAllocation', 'labBatch'].map((key) => (
                                    <div key={key} className="rounded-xl border border-slate-200 bg-white p-3">
                                        <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{key}</div>
                                        <div className="mt-2 text-2xl font-bold text-slate-800">{response.counts?.[key] ?? 0}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="card p-5">
                    <div className="mb-4 flex items-center gap-2">
                        <Download className="h-5 w-5 text-sky-700" />
                        <div className="text-lg font-semibold text-slate-800">Download Templates</div>
                    </div>
                    <div className="space-y-3">
                        {templateItems.map((item) => (
                            <button key={item} type="button" onClick={() => downloadTemplate(item)} className="flex w-full items-center justify-between rounded-xl border border-sky-100 bg-sky-50 px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-sky-100">
                                <span>{item}</span>
                                <Download className="h-4 w-4 text-sky-700" />
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

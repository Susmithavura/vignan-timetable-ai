import { AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../services/api';

export function ClashDetectionPage() {
    const [conflicts, setConflicts] = useState<any[]>([]);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        api.conflicts().then(setConflicts).catch((error) => setErrorMessage(error instanceof Error ? error.message : 'Unable to load conflict data.'));
    }, []);

    return <div className="space-y-6">
        <div className="card p-5"><div className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">Clash Detection</div><div className="mt-1 text-2xl font-bold text-slate-800">Conflict dashboard</div></div>
        {errorMessage && <div className="card border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{errorMessage}</div>}
        <div className="card p-5">{conflicts.length === 0 ? <div className="flex items-center gap-3"><CheckCircle2 className="h-6 w-6 text-emerald-600" /><div><div className="text-xl font-bold text-slate-800">No Active Conflicts</div><div className="text-sm text-slate-500">Current schedule is stable and compliant.</div></div></div> : <><div className="mb-4 flex items-center gap-3"><AlertTriangle className="h-6 w-6 text-amber-600" /><div><div className="text-xl font-bold text-slate-800">{conflicts.length} Active Conflicts</div><div className="text-sm text-slate-500">These conflicts were found in the current database timetable.</div></div></div><div className="grid gap-4 xl:grid-cols-2">{conflicts.map((conflict, index) => <div key={`${conflict.type}-${conflict.day}-${conflict.period}-${index}`} className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="flex items-center justify-between"><div className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-700">{conflict.type}</div><span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-amber-700">{conflict.day} {conflict.period}</span></div><div className="mt-3 text-lg font-bold text-slate-800">{conflict.resource ?? 'Schedule resource'}</div>{conflict.detail && <div className="mt-1 text-sm text-slate-600">{conflict.detail}</div>}<div className="mt-3 space-y-2">{conflict.entries?.map((entry: any, entryIndex: number) => <div key={entryIndex} className="rounded-xl bg-white p-3 text-sm text-slate-700">{entry.section} • {entry.course} • {entry.faculty}{entry.room ? ` • ${entry.room}` : ''}</div>)}</div><div className="mt-3 rounded-xl border border-dashed border-amber-300 bg-white p-3"><div className="flex items-center gap-2 text-sm font-medium text-slate-700"><ShieldAlert className="h-4 w-4 text-amber-700" /> Recommended Action</div><div className="mt-1 text-sm text-slate-600">Review the conflicting assignment and regenerate or move one entry to a compatible available slot.</div></div></div>)}</div></>}</div>
    </div>;
}

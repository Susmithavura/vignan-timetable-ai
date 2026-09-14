import { useEffect, useState } from 'react';
import { api } from '../services/api';

export function LabBatchesPage() {
    const [batches, setBatches] = useState<any[]>([]);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        api.labBatches().then(setBatches).catch((error) => setErrorMessage(error instanceof Error ? error.message : 'Unable to load laboratory batches.'));
    }, []);

    return <div className="space-y-6">
        <div className="card p-5"><div className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">Lab Batches</div><div className="mt-1 text-2xl font-bold text-slate-800">Batch-wise laboratory allocation</div></div>
        {errorMessage && <div className="card border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{errorMessage}</div>}
        <div className="card overflow-hidden"><div className="table-scroll"><table className="min-w-[1000px] w-full text-left"><thead className="bg-sky-50"><tr>{['Section', 'Course', 'Batch', 'Students', 'Laboratory', 'Faculty', 'Day', 'Period'].map((heading) => <th key={heading} className="px-4 py-3 font-semibold text-slate-700">{heading}</th>)}</tr></thead><tbody>{batches.map((batch) => <tr key={batch.id} className="border-t border-sky-100"><td className="px-4 py-3 font-medium text-slate-800">{batch.section}</td><td className="px-4 py-3 text-slate-600">{batch.course}</td><td className="px-4 py-3 text-slate-600">{batch.batch}</td><td className="px-4 py-3 text-slate-600">{batch.studentCount}</td><td className="px-4 py-3 text-slate-600">{batch.laboratory}</td><td className="px-4 py-3 text-slate-600">{batch.faculty}</td><td className="px-4 py-3 text-slate-600">{batch.day ?? 'Not scheduled'}</td><td className="px-4 py-3 text-slate-600">{batch.period ?? 'Not scheduled'}</td></tr>)}</tbody></table></div></div>
    </div>;
}

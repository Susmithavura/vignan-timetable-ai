import { CheckCircle2, XCircle } from 'lucide-react';
import { changeRequests } from '../data/constraints';

export function ChangeRequestsPage() {
    return (
        <div className="space-y-6">
            <div className="card p-5">
                <div className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">Change Requests</div>
                <div className="mt-1 text-2xl font-bold text-slate-800">Faculty leave and substitution</div>
            </div>

            <div className="card p-5">
                <div className="space-y-4">
                    {changeRequests.map((request) => (
                        <div key={request.id} className="rounded-2xl border border-sky-100 bg-sky-50 p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <div className="text-lg font-semibold text-slate-800">{request.facultyName} is unavailable on {request.day} {request.period}.</div>
                                    <div className="mt-2 text-sm text-slate-600">Affected Class: {request.course} • {request.section} • {request.day} {request.period}</div>
                                </div>
                                <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-sky-700">{request.status}</span>
                            </div>

                            <div className="mt-4 rounded-xl border border-sky-200 bg-white p-3">
                                <div className="text-sm font-semibold text-slate-800">Suggested Substitute</div>
                                <div className="mt-2 text-sm text-slate-600">{request.suggestedSubstitute}</div>
                                <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600">
                                    <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">✓ Faculty available</span>
                                    <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">✓ Qualified for course</span>
                                    <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">✓ No timetable clash</span>
                                    <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">✓ Room remains valid</span>
                                </div>
                            </div>

                            <div className="mt-4 flex flex-wrap gap-3">
                                <button className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"><CheckCircle2 className="h-4 w-4" /> Approve Substitute</button>
                                <button className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"><XCircle className="h-4 w-4" /> Reject</button>
                                <button className="rounded-xl border border-sky-200 bg-white px-4 py-2 text-sm font-semibold text-sky-700">Recalculate</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

import { CheckCircle2, Circle, ShieldCheck, Sparkles } from 'lucide-react';
import { constraints } from '../data/constraints';

export function ConstraintsPage() {
    const hard = constraints.filter((c) => c.priority === 'Hard');
    const soft = constraints.filter((c) => c.priority === 'Soft');

    return (
        <div className="space-y-6">
            <div className="card p-5">
                <div className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">Constraints & Availability</div>
                <div className="mt-1 text-2xl font-bold text-slate-800">Scheduling safeguards</div>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
                <div className="card p-5">
                    <div className="mb-4 flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5 text-emerald-600" />
                        <div className="text-lg font-semibold text-slate-800">Hard constraints</div>
                    </div>
                    <div className="space-y-3">
                        {hard.map((rule) => (
                            <div key={rule.id} className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <div className="font-semibold text-slate-800">{rule.title}</div>
                                        <div className="mt-1 text-sm text-slate-600">{rule.description}</div>
                                    </div>
                                    <CheckCircle2 className="h-5 w-5 mt-1 text-emerald-600" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="card p-5">
                    <div className="mb-4 flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-violet-600" />
                        <div className="text-lg font-semibold text-slate-800">Soft constraints</div>
                    </div>
                    <div className="space-y-3">
                        {soft.map((rule) => (
                            <div key={rule.id} className="rounded-2xl border border-violet-100 bg-violet-50 p-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <div className="font-semibold text-slate-800">{rule.title}</div>
                                        <div className="mt-1 text-sm text-slate-600">{rule.description}</div>
                                    </div>
                                    <Circle className="h-5 w-5 mt-1 text-violet-500" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

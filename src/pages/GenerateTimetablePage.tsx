import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, LoaderCircle, Sparkles } from 'lucide-react';
import { api } from '../services/api';

const steps = [
    'Loading college data',
    'Checking faculty availability',
    'Checking room capacity',
    'Checking laboratory batches',
    'Applying hard constraints',
    'Optimising soft constraints',
    'Running clash detection',
];

export function GenerateTimetablePage() {
    const navigate = useNavigate();
    const [isGenerating, setIsGenerating] = useState(false);
    const [ready, setReady] = useState(false);
    const [result, setResult] = useState<{ generatedEntries: number; sectionsProcessed: number; conflicts: number } | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const handleGenerate = async () => {
        setIsGenerating(true);
        setReady(false);
        setErrorMessage(null);
        try {
            const response = await api.generateTimetable();
            setResult(response);
            setReady(true);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Timetable generation failed.');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="card p-5">
                <div className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">Generate Timetable</div>
                <div className="mt-1 text-2xl font-bold text-slate-800">AI scheduling workflow</div>
            </div>

            <div className="card p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-xl font-bold text-slate-800">Generate Timetable</div>
                        <div className="mt-1 text-sm text-slate-500">Generate and persist a conflict-checked schedule from database records.</div>
                    </div>
                    <button onClick={handleGenerate} className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700">
                        {isGenerating ? 'Running...' : 'Generate Timetable'}
                    </button>
                </div>

                {errorMessage && <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{errorMessage}</div>}

                <div className="mt-6 space-y-4">
                    {steps.map((step, index) => (
                        <div key={step} className="flex items-center gap-3 rounded-2xl border border-sky-100 bg-sky-50 p-3">
                            <div className={`flex h-8 w-8 items-center justify-center rounded-full ${isGenerating || ready ? 'bg-emerald-100 text-emerald-600' : 'bg-white text-sky-700'}`}>
                                {isGenerating || ready ? <CheckCircle2 className="h-4 w-4" /> : <span className="text-xs font-bold">{index + 1}</span>}
                            </div>
                            <div className="flex items-center gap-3 text-sm text-slate-700">
                                {isGenerating && index === steps.length - 1 ? <LoaderCircle className="h-4 w-4 animate-spin text-sky-700" /> : null}
                                <span>{step}</span>
                            </div>
                        </div>
                    ))}
                </div>

                {ready && (
                    <div className="mt-6 rounded-3xl border border-emerald-200 bg-emerald-50 p-4">
                        <div className="flex items-center gap-3">
                            <Sparkles className="h-6 w-6 text-emerald-600" />
                            <div>
                                <div className="text-xl font-bold text-emerald-700">TIMETABLE READY</div>
                                <div className="text-sm text-emerald-700">{result?.generatedEntries ?? 0} sessions generated across {result?.sectionsProcessed ?? 0} sections; {result?.conflicts ?? 0} conflicts detected.</div>
                            </div>
                        </div>
                        <div className="mt-4 flex gap-3">
                            <button type="button" onClick={() => navigate('/timetable?view=Section-wise')} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-200">View Timetable</button>
                            <button type="button" onClick={() => navigate('/clashes')} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">View Clash Report</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

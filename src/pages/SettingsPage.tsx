export function SettingsPage() {
    return (
        <div className="space-y-6">
            <div className="card p-5">
                <div className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">Settings</div>
                <div className="mt-1 text-2xl font-bold text-slate-800">Application configuration</div>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
                <div className="card p-5">
                    <div className="text-lg font-semibold text-slate-800">Academic settings</div>
                    <div className="mt-4 space-y-3 text-sm text-slate-600">
                        <div className="flex items-center justify-between rounded-xl border border-sky-100 bg-sky-50 p-3"><span>Academic year</span><span className="font-semibold text-slate-800">2026-27</span></div>
                        <div className="flex items-center justify-between rounded-xl border border-sky-100 bg-sky-50 p-3"><span>Term</span><span className="font-semibold text-slate-800">Odd Semester</span></div>
                        <div className="flex items-center justify-between rounded-xl border border-sky-100 bg-sky-50 p-3"><span>Time slots</span><span className="font-semibold text-slate-800">P1-P6</span></div>
                    </div>
                </div>

                <div className="card p-5">
                    <div className="text-lg font-semibold text-slate-800">Preferences</div>
                    <div className="mt-4 space-y-3 text-sm text-slate-600">
                        <div className="flex items-center justify-between rounded-xl border border-sky-100 bg-sky-50 p-3"><span>Auto clash check</span><span className="font-semibold text-emerald-600">Enabled</span></div>
                        <div className="flex items-center justify-between rounded-xl border border-sky-100 bg-sky-50 p-3"><span>AI recommendations</span><span className="font-semibold text-emerald-600">Enabled</span></div>
                        <div className="flex items-center justify-between rounded-xl border border-sky-100 bg-sky-50 p-3"><span>Manual override</span><span className="font-semibold text-slate-800">Allowed</span></div>
                    </div>
                </div>
            </div>
        </div>
    );
}

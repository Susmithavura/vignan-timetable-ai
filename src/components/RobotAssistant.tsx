type RobotAssistantProps = {
    compact?: boolean;
    title?: string;
};

export function RobotAssistant({ compact = false, title = 'Timetable AI Assistant' }: RobotAssistantProps) {
    return (
        <div className={`flex items-center gap-4 ${compact ? 'p-2' : 'rounded-2xl border border-sky-100 bg-gradient-to-r from-sky-50 to-blue-50 p-4'}`}>
            <div className={`relative ${compact ? 'h-12 w-12' : 'h-16 w-16'}`}>
                <div className="absolute inset-0 rounded-full bg-sky-200/50 blur-md" />
                <div className="relative flex h-full w-full items-center justify-center rounded-full border border-sky-200 bg-white shadow-sm">
                    <div className="relative flex h-[62%] w-[62%] flex-col items-center justify-center rounded-[32%] border-2 border-sky-300 bg-sky-50">
                        <div className="mb-1 flex w-8 justify-between">
                            <span className="h-2 w-2 rounded-full bg-sky-500" />
                            <span className="h-2 w-2 rounded-full bg-sky-500" />
                        </div>
                        <div className="h-3 w-8 rounded-full border border-sky-300 bg-white" />
                        <div className="mt-2 flex w-10 justify-between">
                            <span className="h-5 w-1 rounded-full bg-sky-400" />
                            <span className="h-5 w-1 rounded-full bg-sky-400" />
                        </div>
                    </div>
                </div>
            </div>
            <div>
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-600">AI AGENT</div>
                <div className="text-sm font-semibold text-slate-700">{title}</div>
            </div>
        </div>
    );
}

import { ArrowRight, BookOpen, Building2, CheckCircle2, Clock3, Cpu, Sparkles, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RobotAssistant } from '../components/RobotAssistant';
import { sampleApiBlocks, sampleApiCourses, sampleApiFaculty, sampleApiLabs, sampleApiRooms, sampleApiSections, sampleApiTimetable } from '../data/sampleFrontendData';
import { getDatasetBlocks, getDatasetCourses, getDatasetFaculty, getDatasetLaboratories, getDatasetRooms, getDatasetSections, loadActiveCollegeDataset } from '../services/activeCollegeDataset';

const quickActions = [
    { label: 'Generate Timetable', to: '/generate' },
    { label: 'Check Conflicts', to: '/clashes' },
    { label: 'Import College Data', to: '/college-data' },
    { label: 'Handle Faculty Leave', to: '/change-requests' },
];

export function DashboardPage() {
    const navigate = useNavigate();
    const [data, setData] = useState({ departments: 0, sections: 0, faculty: 0, courses: 0, rooms: 0, laboratories: 0, blocks: 0, sessions: 0, conflicts: 0, roomUtilization: 0, laboratorySessions: 0, freePeriods: 0, availability: 0, readyLabs: 0 });
    const [timetable, setTimetable] = useState<any[]>([]);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        let active = true;

        const loadDashboardData = async () => {
            const result = await loadActiveCollegeDataset();
            if (!active) return;

            if (result.source === 'error') {
                setErrorMessage(result.message ?? 'API unavailable — active dataset data cannot be loaded right now.');
                return;
            }

            if (result.source === 'sample' || !result.dataset) {
                const teachingRooms = sampleApiRooms;
                const labSessions = sampleApiTimetable.filter((entry) => entry.type === 'Laboratory');
                setData({ departments: 4, sections: sampleApiSections.length, faculty: sampleApiFaculty.length, courses: sampleApiCourses.length, rooms: teachingRooms.length, laboratories: sampleApiLabs.length, blocks: sampleApiBlocks.length, sessions: sampleApiTimetable.length, conflicts: 0, roomUtilization: Math.round((sampleApiTimetable.filter((entry) => entry.room).length / (teachingRooms.length * 36)) * 100), laboratorySessions: labSessions.length, freePeriods: Math.max((sampleApiSections.length * 36) - sampleApiTimetable.length, 0), availability: 100, readyLabs: sampleApiLabs.length });
                setTimetable(sampleApiTimetable);
                setErrorMessage(null);
                return;
            }

            const dataset = result.dataset;
            const sections = getDatasetSections(dataset);
            const faculty = getDatasetFaculty(dataset);
            const courses = getDatasetCourses(dataset);
            const rooms = getDatasetRooms(dataset);
            const laboratories = getDatasetLaboratories(dataset);
            const blocks = getDatasetBlocks(dataset);
            const teachingRooms = rooms.filter((room) => String(room.roomType ?? '').toUpperCase() === 'TEACHING_ROOM');
            const readyLabs = laboratories.filter((lab) => lab.active !== false).length;
            const roomUtilization = teachingRooms.length ? Math.round((Math.min(rooms.length, teachingRooms.length) / Math.max(teachingRooms.length, 1)) * 100) : 0;

            setData({
                departments: new Set([...rooms.map((room) => room.department), ...courses.map((course) => course.department), ...sections.map((section) => section.department), ...faculty.map((member) => member.department)]).size,
                sections: sections.length,
                faculty: faculty.length,
                courses: courses.length,
                rooms: teachingRooms.length,
                laboratories: laboratories.length,
                blocks: blocks.length,
                sessions: 0,
                conflicts: 0,
                roomUtilization,
                laboratorySessions: 0,
                freePeriods: Math.max((sections.length * 36) - 0, 0),
                availability: 0,
                readyLabs,
            });
            setTimetable([]);
            setErrorMessage(null);
        };

        void loadDashboardData();
        return () => { active = false; };
    }, []);

    const stats = [
        { label: 'Departments', value: data.departments, icon: BookOpen, to: '/sections' },
        { label: 'Sections', value: data.sections, icon: Users, to: '/sections' },
        { label: 'Faculty', value: data.faculty, icon: Users, to: '/faculty' },
        { label: 'Courses', value: data.courses, icon: BookOpen, to: '/courses' },
        { label: 'Teaching Rooms', value: data.rooms, icon: Building2, to: '/infrastructure' },
        { label: 'Laboratories', value: data.laboratories, icon: Cpu, to: '/infrastructure' },
        { label: 'Blocks', value: data.blocks, icon: Clock3, to: '/infrastructure' },
    ];
    const preview = useMemo(() => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((day) => ({ day: day.slice(0, 3), slots: timetable.filter((entry) => entry.day === day).slice(0, 4).map((entry) => entry.course ?? 'Free') })), [timetable]);

    return (
        <div className="space-y-6">
            {errorMessage && <div className="card border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{errorMessage}</div>}
            <div className="rounded-[28px] border border-sky-100 bg-gradient-to-r from-sky-50 via-white to-blue-50 p-6 shadow-soft">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <div className="text-sm font-semibold uppercase tracking-[0.26em] text-sky-700">Good morning, Timetable Coordinator</div>
                        <h1 className="mt-3 text-3xl font-bold text-slate-900">Intelligent scheduling across departments, faculty, rooms and laboratories.</h1>
                        <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-600">
                            <span className="status-pill bg-white text-sky-700">AI-Ready Schedule</span>
                            <span className="status-pill bg-white text-sky-700">Academic Year 2026-2027</span>
                            <span className="status-pill bg-white text-sky-700">Conflict Monitoring</span>
                        </div>
                    </div>
                    <RobotAssistant />
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
                {stats.map(({ label, value, icon: Icon, to }) => (
                    <button
                        key={label}
                        type="button"
                        onClick={() => navigate(to)}
                        className="card p-4 text-left transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-soft"
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-2xl font-bold text-slate-900">{value}</div>
                                <div className="text-sm text-slate-500">{label}</div>
                            </div>
                            <div className="rounded-xl bg-sky-50 p-2 text-sky-700">
                                <Icon className="h-5 w-5" />
                            </div>
                        </div>
                    </button>
                ))}
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
                <div className="card p-5">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <div className="text-sm font-semibold uppercase tracking-[0.22em] text-sky-700">Timetable Health</div>
                            <div className="mt-1 text-xl font-bold text-slate-800">{data.sessions} sessions loaded</div>
                        </div>
                        <div className="rounded-full bg-emerald-100 p-2 text-emerald-600">
                            <CheckCircle2 className="h-5 w-5" />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-3">
                            <div className="rounded-2xl bg-sky-50 p-3">
                                <div className="text-2xl font-bold text-slate-900">{data.sessions}</div>
                                <div className="text-xs text-slate-500">Sessions Scheduled</div>
                            </div>
                            <div className="rounded-2xl bg-sky-50 p-3">
                                <div className="text-2xl font-bold text-slate-900">{data.conflicts}</div>
                                <div className="text-xs text-slate-500">Active Conflicts</div>
                            </div>
                            <div className="rounded-2xl bg-sky-50 p-3">
                                <div className="text-2xl font-bold text-slate-900">{data.freePeriods}</div>
                                <div className="text-xs text-slate-500">Free Section Periods</div>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-sky-100 bg-slate-50 p-4">
                            <div className="mb-2 text-sm font-semibold text-slate-700">Quick Actions</div>
                            <div className="flex flex-wrap gap-2">
                                {quickActions.map((action) => (
                                    <button
                                        key={action.label}
                                        type="button"
                                        onClick={() => navigate(action.to)}
                                        className="rounded-full border border-sky-200 bg-white px-3 py-2 text-xs font-medium text-sky-700 transition hover:bg-sky-50"
                                    >
                                        {action.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="card p-5">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <div className="text-sm font-semibold uppercase tracking-[0.22em] text-sky-700">AI Snapshot</div>
                            <div className="mt-1 text-xl font-bold text-slate-800">This Week</div>
                        </div>
                        <div className="rounded-full bg-sky-100 p-2 text-sky-700">
                            <Sparkles className="h-5 w-5" />
                        </div>
                    </div>
                    <ul className="space-y-3 text-sm text-slate-600">
                        <li className="flex items-center justify-between rounded-xl bg-sky-50 px-3 py-2"><span>Faculty availability</span><span className="font-semibold text-emerald-600">{data.availability}%</span></li>
                        <li className="flex items-center justify-between rounded-xl bg-sky-50 px-3 py-2"><span>Room utilisation</span><span className="font-semibold text-sky-700">{data.roomUtilization}%</span></li>
                        <li className="flex items-center justify-between rounded-xl bg-sky-50 px-3 py-2"><span>Laboratory sessions</span><span className="font-semibold text-emerald-600">{data.laboratorySessions}</span></li>
                        <li className="flex items-center justify-between rounded-xl bg-sky-50 px-3 py-2"><span>Laboratories ready</span><span className="font-semibold text-sky-700">{data.readyLabs}/{data.laboratories}</span></li>
                    </ul>
                </div>
            </div>

            <div className="card p-5">
                <div className="mb-4 flex items-center justify-between">
                    <div>
                        <div className="text-sm font-semibold uppercase tracking-[0.22em] text-sky-700">Weekly timetable preview</div>
                        <div className="mt-1 text-xl font-bold text-slate-800">Live college schedule</div>
                    </div>
                    <button
                        type="button"
                        onClick={() => navigate('/timetable?view=Section-wise')}
                        className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700"
                    >
                        Open timetable <ArrowRight className="h-4 w-4" />
                    </button>
                </div>

                <div className="grid gap-3 md:grid-cols-5">
                    {preview.map((day) => (
                        <div key={day.day} className="rounded-2xl border border-sky-100 bg-slate-50 p-3">
                            <div className="mb-3 text-sm font-semibold text-slate-700">{day.day}</div>
                            <div className="space-y-2">
                                {day.slots.map((slot, index) => (
                                    <div key={`${day.day}-${slot}`} className={`rounded-xl border p-2 text-[11px] ${index % 2 === 0 ? 'border-sky-100 bg-white text-slate-700' : 'border-amber-100 bg-amber-50 text-amber-700'}`}>
                                        {slot}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

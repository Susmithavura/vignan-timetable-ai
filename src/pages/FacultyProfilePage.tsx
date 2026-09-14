import { ArrowLeft, BookOpen, CalendarDays, GraduationCap, UserRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../services/api';

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const periods = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];

export function FacultyProfilePage() {
    const { facultyId } = useParams();
    const navigate = useNavigate();
    const [person, setPerson] = useState<any | null>(null);
    const [entries, setEntries] = useState<any[]>([]);
    const [courses, setCourses] = useState<any[]>([]);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        Promise.all([api.faculty(), api.courses(), api.timetable()]).then(([faculty, courseRecords, timetable]) => {
            const selected = faculty.find((member: any) => member.id === facultyId || member.facultyId === facultyId);
            setPerson(selected ?? null);
            setCourses(courseRecords);
            setEntries(timetable.filter((entry: any) => entry.faculty === selected?.name));
        }).catch((error) => setErrorMessage(error instanceof Error ? error.message : 'Unable to load faculty profile.'));
    }, [facultyId]);

    const sections = useMemo(() => Array.from(new Set(entries.map((entry) => entry.section))), [entries]);
    const taughtCourses = useMemo(() => Array.from(new Set(entries.map((entry) => entry.course))), [entries]);
    const theoryCount = entries.filter((entry) => entry.type !== 'Laboratory').length;
    const labCount = entries.filter((entry) => entry.type === 'Laboratory').length;
    const schedule = (day: string, period: string) => entries.find((entry) => entry.day === day && entry.period === period);

    if (!person && !errorMessage) return <div className="card p-8 text-center text-slate-500">Loading faculty profile...</div>;
    if (!person) return <div className="card border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">{errorMessage ?? 'Faculty record not found.'}</div>;

    return <div className="space-y-6">
        <div className="card p-5"><div className="flex flex-wrap items-center gap-4"><button type="button" onClick={() => navigate('/faculty')} className="inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-700"><ArrowLeft className="h-4 w-4" /> Back to Faculty</button><div><div className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">Faculty profile</div><div className="mt-1 text-2xl font-bold text-slate-800">{person.name}</div><div className="text-sm text-slate-500">{person.facultyId} • {person.department?.code ?? 'Unknown department'} • {person.designation}</div></div></div></div>
        {errorMessage && <div className="card border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{errorMessage}</div>}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{[{ label: 'Weekly Load', value: `${person.weeklyLoad} periods`, icon: CalendarDays }, { label: 'Theory Sessions', value: theoryCount, icon: BookOpen }, { label: 'Laboratory Sessions', value: labCount, icon: GraduationCap }, { label: 'Sections', value: sections.length, icon: UserRound }].map(({ label, value, icon: Icon }) => <div key={label} className="card p-4"><div className="flex items-center justify-between"><div><div className="text-2xl font-bold text-slate-800">{value}</div><div className="text-sm text-slate-500">{label}</div></div><div className="rounded-xl bg-sky-50 p-2 text-sky-700"><Icon className="h-5 w-5" /></div></div></div>)}</div>
        <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
            <div className="card p-5"><div className="text-lg font-bold text-slate-800">Courses and sections</div><div className="mt-4 space-y-3">{taughtCourses.map((courseName) => { const course = courses.find((item) => item.name === courseName); return <div key={courseName} className="rounded-2xl bg-sky-50 p-3"><div className="font-semibold text-slate-800">{courseName}</div><div className="mt-1 text-sm text-slate-600">{course?.code ?? '—'} • {course?.requiredPeriodsPerWeek ?? '—'} periods/week</div></div>; })}</div><div className="mt-5 text-lg font-bold text-slate-800">Sections handled</div><div className="mt-3 flex flex-wrap gap-2">{sections.map((section) => <button key={section} type="button" onClick={() => navigate(`/timetable?section=${section}&view=Section-wise`)} className="rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-sky-700 ring-1 ring-sky-200">{section}</button>)}</div></div>
            <div className="card p-5"><div className="flex items-center gap-2"><UserRound className="h-5 w-5 text-sky-700" /><div className="text-lg font-bold text-slate-800">Faculty timetable</div></div><div className="mt-4 overflow-auto rounded-2xl border border-sky-100"><table className="min-w-[900px] w-full border-collapse text-left"><thead className="bg-sky-50"><tr><th className="px-3 py-3 font-semibold">Period</th>{days.map((day) => <th key={day} className="px-3 py-3 font-semibold">{day}</th>)}</tr></thead><tbody>{periods.map((period) => <tr key={period} className="border-t border-sky-100"><td className="bg-slate-50 px-3 py-3 font-semibold">{period}</td>{days.map((day) => { const entry = schedule(day, period); return <td key={`${day}-${period}`} className="px-2 py-2 align-top">{entry ? <div className="rounded-xl border border-sky-200 bg-sky-50 p-2 text-xs"><div className="font-bold text-slate-800">{entry.course}</div><div className="mt-1 text-slate-600">{entry.section}</div><div className="mt-1 text-slate-600">{entry.room ?? entry.laboratory ?? 'Unassigned'}</div></div> : <div className="p-2 text-xs text-slate-400">Free</div>}</td>; })}</tr>)}</tbody></table></div></div>
        </div>
    </div>;
}

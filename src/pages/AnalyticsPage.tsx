import { BarChart3, BookOpenCheck, Building2, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../services/api';
import { sampleApiCourses, sampleApiFaculty, sampleApiLabs, sampleApiRooms, sampleApiTimetable } from '../data/sampleFrontendData';

export function AnalyticsPage() {
    const [analytics, setAnalytics] = useState<any | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        api.analytics().then(setAnalytics).catch(() => {
            const count = (values: string[]) => values.reduce<Record<string, number>>((result, value) => { result[value] = (result[value] ?? 0) + 1; return result; }, {});
            const facultyCounts = count(sampleApiTimetable.map((entry) => entry.faculty));
            const roomCounts = count(sampleApiTimetable.filter((entry) => entry.room).map((entry) => entry.room!));
            const labCounts = count(sampleApiTimetable.filter((entry) => entry.laboratory).map((entry) => entry.laboratory!));
            setAnalytics({ roomUtilisation: sampleApiRooms.map((room) => ({ name: room.roomName, value: roomCounts[room.roomName] ?? 0 })), facultyWorkload: sampleApiFaculty.map((member) => ({ name: member.name, value: facultyCounts[member.name] ?? 0 })), sessionsByDepartment: sampleApiCourses.map((course) => ({ name: course.department.code, value: sampleApiTimetable.filter((entry) => entry.courseCode === course.code).length })).filter((item, index, items) => items.findIndex((candidate) => candidate.name === item.name) === index), laboratoryUtilisation: sampleApiLabs.map((lab) => ({ name: lab.name, value: labCounts[lab.name] ?? 0 })) });
            setErrorMessage('API unavailable — showing the canonical sample dataset.');
        });
    }, []);

    const charts = [{ title: 'Room utilisation', icon: Building2, data: analytics?.roomUtilisation ?? [], color: '#3b82f6' }, { title: 'Faculty workload distribution', icon: Users, data: analytics?.facultyWorkload ?? [], color: '#60a5fa' }, { title: 'Sessions by department', icon: BookOpenCheck, data: analytics?.sessionsByDepartment ?? [], color: '#93c5fd' }, { title: 'Laboratory utilisation', icon: BarChart3, data: analytics?.laboratoryUtilisation ?? [], color: '#10b981' }];

    return <div className="space-y-6"><div className="card p-5"><div className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">Analytics</div><div className="mt-1 text-2xl font-bold text-slate-800">College scheduling insights</div></div>{errorMessage && <div className="card border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{errorMessage}</div>}<div className="grid gap-6 xl:grid-cols-2">{charts.map(({ title, icon: Icon, data, color }) => <div key={title} className="card p-5"><div className="mb-4 flex items-center gap-2"><Icon className="h-5 w-5 text-sky-700" /><div className="text-lg font-semibold text-slate-800">{title}</div></div><div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="#dbeafe" /><XAxis dataKey="name" stroke="#64748b" /><YAxis stroke="#64748b" /><Tooltip /><Bar dataKey="value" fill={color} radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer></div></div>)}</div></div>;
}

import { Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { sampleApiCourses } from '../data/sampleFrontendData';
import { getDatasetCourses, loadActiveCollegeDataset } from '../services/activeCollegeDataset';

export function CoursesPage() {
    const [courses, setCourses] = useState<any[]>([]);
    const [search, setSearch] = useState('');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        let active = true;

        const loadCourses = async () => {
            const result = await loadActiveCollegeDataset();
            if (!active) return;

            if (result.source === 'error') {
                setCourses([]);
                setErrorMessage(result.message ?? 'API unavailable — active dataset data cannot be loaded right now.');
                return;
            }

            if (result.source === 'sample' || !result.dataset) {
                setCourses(sampleApiCourses);
                setErrorMessage(null);
                return;
            }

            setCourses(getDatasetCourses(result.dataset));
            setErrorMessage(null);
        };

        void loadCourses();
        return () => { active = false; };
    }, []);

    const filteredCourses = useMemo(() => {
        const query = search.trim().toLowerCase();
        return courses.filter((course) => !query || [course.code, course.name, course.department?.code, course.year].some((value) => String(value ?? '').toLowerCase().includes(query)));
    }, [courses, search]);

    return (
        <div className="space-y-6">
            <div className="card p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <div className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">Courses</div>
                        <div className="mt-1 text-2xl font-bold text-slate-800">Academic curriculum</div>
                    </div>
                    <label className="flex items-center gap-2 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-slate-600">
                        <Search className="h-4 w-4" />
                        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search course" className="w-52 bg-transparent outline-none" />
                    </label>
                </div>
            </div>

            {errorMessage && <div className="card border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{errorMessage}</div>}

            <div className="card overflow-hidden">
                <div className="table-scroll">
                    <table className="min-w-[900px] w-full text-left">
                        <thead className="bg-sky-50">
                            <tr>
                                <th className="px-4 py-3 font-semibold text-slate-700">Course Code</th>
                                <th className="px-4 py-3 font-semibold text-slate-700">Course Name</th>
                                <th className="px-4 py-3 font-semibold text-slate-700">Department</th>
                                <th className="px-4 py-3 font-semibold text-slate-700">Year</th>
                                <th className="px-4 py-3 font-semibold text-slate-700">Type</th>
                                <th className="px-4 py-3 font-semibold text-slate-700">Faculty</th>
                                <th className="px-4 py-3 font-semibold text-slate-700">Periods/Week</th>
                                <th className="px-4 py-3 font-semibold text-slate-700">Room/Lab Req.</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredCourses.map((course) => (
                                <tr key={course.code} className="border-t border-sky-100">
                                    <td className="px-4 py-3 text-slate-700">{course.code}</td>
                                    <td className="px-4 py-3 font-medium text-slate-800">{course.name}</td>
                                    <td className="px-4 py-3 text-slate-600">{course.department?.code ?? course.departmentId}</td>
                                    <td className="px-4 py-3 text-slate-600">{course.year}</td>
                                    <td className="px-4 py-3">
                                        <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-700">{course.type}</span>
                                    </td>
                                    <td className="px-4 py-3 text-slate-600">Faculty allocation managed in Faculty Courses</td>
                                    <td className="px-4 py-3 text-slate-600">{course.requiredPeriodsPerWeek}</td>
                                    <td className="px-4 py-3 text-slate-600">{course.isLab ? 'Laboratory' : 'Teaching room'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

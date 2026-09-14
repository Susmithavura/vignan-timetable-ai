import { Search, UserRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sampleApiCourses, sampleApiFaculty } from '../data/sampleFrontendData';
import { getDatasetCourses, getDatasetFaculty, loadActiveCollegeDataset } from '../services/activeCollegeDataset';

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const statusStyles: Record<string, string> = {
    Available: 'bg-emerald-100 text-emerald-700',
    'Partially Available': 'bg-violet-100 text-violet-700',
    'On Leave': 'bg-amber-100 text-amber-700',
};

const normalizeFaculty = (rawFaculty: any[]) => rawFaculty.map((person) => ({
    id: person.id ?? person.facultyId ?? person.email ?? person.name,
    name: person.name,
    registrationNo: person.facultyId ?? person.registrationNo ?? '',
    department: person.department?.code ?? person.department ?? 'Unknown',
    designation: person.designation ?? 'Assistant Professor',
    courses: Array.isArray(person.courses) ? person.courses.map((item: any) => item.course?.name ?? item.name ?? item.code).filter(Boolean) : [],
    weeklyLoad: Number(person.weeklyLoad ?? 0),
    status: person.active === false ? 'On Leave' : 'Available',
    availability: Array.isArray(person.availability)
        ? person.availability.reduce((result: Record<string, { available: string[]; unavailable: string[]; preferred: string[] }>, slot: any) => {
            const day = slot.day?.name ?? slot.day ?? 'Unknown';
            result[day] ??= { available: [], unavailable: [], preferred: [] };
            const period = `P${slot.period?.periodNumber ?? slot.periodNumber ?? ''}`;
            (slot.available === false ? result[day].unavailable : result[day].available).push(period);
            if (slot.preferred) result[day].preferred.push(period);
            return result;
        }, {})
        : person.availability ?? {},
}));

export function FacultyPage() {
    const navigate = useNavigate();
    const [search, setSearch] = useState('');
    const [department, setDepartment] = useState('All');
    const [designation, setDesignation] = useState('All');
    const [year, setYear] = useState('All');
    const [courseFilter, setCourseFilter] = useState('All');
    const [availability, setAvailability] = useState('All');
    const [facultyList, setFacultyList] = useState<any[]>([]);
    const [courseList, setCourseList] = useState<any[]>([]);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        let active = true;

        const loadFaculty = async () => {
            const result = await loadActiveCollegeDataset();
            if (!active) return;

            if (result.source === 'error') {
                setFacultyList([]);
                setCourseList([]);
                setErrorMessage(result.message ?? 'API unavailable — active dataset data cannot be loaded right now.');
                return;
            }

            if (result.source === 'sample' || !result.dataset) {
                setFacultyList(normalizeFaculty(sampleApiFaculty));
                setCourseList(sampleApiCourses);
                setErrorMessage(null);
                return;
            }

            setFacultyList(normalizeFaculty(getDatasetFaculty(result.dataset).map((person) => ({
                id: person.id,
                facultyId: person.facultyId,
                name: person.name,
                department: person.department,
                designation: person.designation,
                email: person.email,
                weeklyLoad: person.weeklyLoad,
                active: person.active,
                availability: [],
                courses: [],
            }))));
            setCourseList(getDatasetCourses(result.dataset));
            setErrorMessage(null);
        };

        void loadFaculty();
        return () => { active = false; };
    }, []);

    const courseOptions = useMemo(() => Array.from(new Set(courseList.map((course) => course.name))), [courseList]);
    const filteredFaculty = useMemo(() => {
        const query = search.trim().toLowerCase();
        return facultyList.filter((person) => {
            const matchesQuery = !query || [person.name, person.registrationNo, ...person.courses].some((value) => String(value).toLowerCase().includes(query));
            const matchesYear = year === 'All' || person.courses.some((name: string) => courseList.some((course) => course.name === name && course.year === year));
            return matchesQuery && (department === 'All' || person.department === department) && (designation === 'All' || person.designation === designation) && (availability === 'All' || person.status === availability) && (courseFilter === 'All' || person.courses.includes(courseFilter)) && matchesYear;
        });
    }, [availability, courseFilter, courseList, department, designation, facultyList, search, year]);

    return <div className="space-y-6">
        <div className="card p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><div className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">Faculty</div><div className="mt-1 text-2xl font-bold text-slate-800">Academic staff overview</div></div><label className="flex items-center gap-2 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-slate-600"><Search className="h-4 w-4" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search faculty" className="w-52 bg-transparent outline-none" /></label></div></div>
        {errorMessage && <div className="card border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{errorMessage}</div>}
        <div className="card p-5"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <label className="flex flex-col gap-1 text-sm text-slate-600"><span>Department</span><select value={department} onChange={(event) => setDepartment(event.target.value)} className="rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 font-medium text-slate-800 outline-none"><option>All</option>{['CSE', 'ECE', 'EEE', 'MECH'].map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="flex flex-col gap-1 text-sm text-slate-600"><span>Designation</span><select value={designation} onChange={(event) => setDesignation(event.target.value)} className="rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 font-medium text-slate-800 outline-none"><option>All</option>{['Professor', 'Associate Professor', 'Assistant Professor'].map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="flex flex-col gap-1 text-sm text-slate-600"><span>Year</span><select value={year} onChange={(event) => setYear(event.target.value)} className="rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 font-medium text-slate-800 outline-none"><option>All</option>{['1st Year', '2nd Year', '3rd Year', '4th Year'].map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="flex flex-col gap-1 text-sm text-slate-600"><span>Course</span><select value={courseFilter} onChange={(event) => setCourseFilter(event.target.value)} className="rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 font-medium text-slate-800 outline-none"><option>All</option>{courseOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="flex flex-col gap-1 text-sm text-slate-600"><span>Availability</span><select value={availability} onChange={(event) => setAvailability(event.target.value)} className="rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 font-medium text-slate-800 outline-none"><option>All</option><option>Available</option><option>On Leave</option></select></label>
        </div></div>
        <div className="grid gap-5 xl:grid-cols-2">{filteredFaculty.map((person) => <button key={person.id} type="button" onClick={() => navigate(`/faculty/${person.id}`)} className="card p-5 text-left transition hover:border-sky-200"><div className="flex items-start justify-between gap-4"><div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-100 text-sky-700"><UserRound className="h-5 w-5" /></div><div><div className="font-semibold text-slate-800">{person.name}</div><div className="text-sm text-slate-500">{person.registrationNo} • {person.department}</div></div></div><span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusStyles[person.status] ?? statusStyles.Available}`}>{person.status}</span></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-sky-50 p-3"><div className="text-xs text-slate-500">Designation</div><div className="mt-1 text-sm font-semibold text-slate-800">{person.designation}</div></div><div className="rounded-xl bg-sky-50 p-3"><div className="text-xs text-slate-500">Weekly Load</div><div className="mt-1 text-sm font-semibold text-slate-800">{person.weeklyLoad} periods</div></div><div className="rounded-xl bg-sky-50 p-3 sm:col-span-2"><div className="text-xs text-slate-500">Courses</div><div className="mt-1 text-sm font-semibold text-slate-800">{person.courses.join(', ') || 'No course allocation'}</div></div><div className="rounded-xl bg-sky-50 p-3 sm:col-span-2"><div className="text-xs text-slate-500">Availability</div><div className="mt-1 text-sm font-semibold text-slate-800">{days.filter((day) => person.availability[day]?.available?.length).length} days configured</div></div></div></button>)}</div>
        {filteredFaculty.length === 0 && <div className="card p-8 text-center text-slate-500">No faculty matched the current filters.</div>}
    </div>;
}

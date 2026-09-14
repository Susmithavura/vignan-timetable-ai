import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    Building2,
    CalendarDays,
    Clock3,
    Layers3,
    MapPin,
    UserRound,
} from 'lucide-react';
import { api } from '../services/api';

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const periods = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];
const yearOptions = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
const viewOptions = ['Section-wise', 'Faculty-wise', 'Room-wise', 'Laboratory-wise'];
const defaultDepartments = [
    { code: 'CSE', name: 'Computer Science and Engineering' },
    { code: 'ECE', name: 'Electronics and Communication Engineering' },
    { code: 'EEE', name: 'Electrical and Electronics Engineering' },
    { code: 'MECH', name: 'Mechanical Engineering' },
];

const getCellStyle = (type: string) => {
    switch (type) {
        case 'Laboratory':
        case 'LAB':
            return 'border-emerald-200 bg-emerald-50 text-emerald-800';
        case 'Elective':
            return 'border-violet-200 bg-violet-50 text-violet-700';
        case 'Library':
            return 'border-amber-200 bg-amber-50 text-amber-700';
        default:
            return 'border-sky-200 bg-sky-50 text-sky-800';
    }
};

const getEmptyCellLabel = () => 'Free Period';

function TimetableSlotModal({
    slot,
    onClose,
}: {
    slot: {
        day: string;
        period: string;
        title: string;
        course: string;
        courseCode: string;
        faculty: string;
        section: string;
        room: string;
        block: string;
        type: string;
        batch?: string;
        electiveGroup?: string;
        isFree?: boolean;
    } | null;
    onClose: () => void;
}) {
    if (!slot) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4" onClick={onClose}>
            <div className="w-full max-w-lg rounded-3xl border border-sky-100 bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">Timetable Slot</div>
                        <div className="mt-1 text-2xl font-bold text-slate-800">{slot.day} • {slot.period}</div>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600 hover:bg-slate-200">Close</button>
                </div>

                <div className="mt-5 space-y-3 text-sm text-slate-600">
                    <div className="flex items-center justify-between rounded-2xl bg-sky-50 p-3">
                        <span className="font-medium text-slate-500">Course</span>
                        <span className="font-semibold text-slate-800">{slot.course}</span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl bg-slate-50 p-3"><div className="text-xs uppercase tracking-[0.2em] text-slate-500">Course code</div><div className="mt-1 font-semibold text-slate-800">{slot.courseCode}</div></div>
                        <div className="rounded-2xl bg-slate-50 p-3"><div className="text-xs uppercase tracking-[0.2em] text-slate-500">Session type</div><div className="mt-1 font-semibold text-slate-800">{slot.type}</div></div>
                        <div className="rounded-2xl bg-slate-50 p-3"><div className="text-xs uppercase tracking-[0.2em] text-slate-500">Faculty</div><div className="mt-1 font-semibold text-slate-800">{slot.faculty}</div></div>
                        <div className="rounded-2xl bg-slate-50 p-3"><div className="text-xs uppercase tracking-[0.2em] text-slate-500">Section</div><div className="mt-1 font-semibold text-slate-800">{slot.section}</div></div>
                        <div className="rounded-2xl bg-slate-50 p-3"><div className="text-xs uppercase tracking-[0.2em] text-slate-500">Room</div><div className="mt-1 font-semibold text-slate-800">{slot.room}</div></div>
                        <div className="rounded-2xl bg-slate-50 p-3"><div className="text-xs uppercase tracking-[0.2em] text-slate-500">Block</div><div className="mt-1 font-semibold text-slate-800">{slot.block}</div></div>
                    </div>
                    {slot.batch && (
                        <div className="rounded-2xl bg-slate-50 p-3"><div className="text-xs uppercase tracking-[0.2em] text-slate-500">Batch</div><div className="mt-1 font-semibold text-slate-800">{slot.batch}</div></div>
                    )}
                    {slot.electiveGroup && (
                        <div className="rounded-2xl bg-violet-50 p-3 text-violet-700"><div className="text-xs uppercase tracking-[0.2em]">Elective group</div><div className="mt-1 font-semibold">{slot.electiveGroup}</div></div>
                    )}
                    {slot.isFree && (
                        <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-3 text-amber-700"><div className="text-xs uppercase tracking-[0.2em]">Status</div><div className="mt-1 font-semibold">Available • {slot.title}</div></div>
                    )}
                </div>
            </div>
        </div>
    );
}

export function TimetablePage() {
    const location = useLocation();
    const navigate = useNavigate();
    const params = new URLSearchParams(location.search);

    const initialDepartment = params.get('department') ?? 'CSE';
    const initialYear = params.get('year') ?? '1st Year';
    const initialSection = params.get('section') ?? 'CSE-01';
    const initialView = params.get('view') ?? 'Section-wise';

    const [department, setDepartment] = useState(initialDepartment);
    const [year, setYear] = useState(initialYear);
    const [section, setSection] = useState(initialSection);
    const [view, setView] = useState(initialView);
    const [selectedFacultyId, setSelectedFacultyId] = useState('');
    const [selectedBlock, setSelectedBlock] = useState('A Block');
    const [selectedRoomId, setSelectedRoomId] = useState(params.get('room') ?? '');
    const [selectedLabId, setSelectedLabId] = useState(params.get('lab') ?? '');
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const [liveEntries, setLiveEntries] = useState<any[]>([]);
    const [liveSections, setLiveSections] = useState<any[]>([]);
    const [liveFaculty, setLiveFaculty] = useState<any[]>([]);
    const [liveCourses, setLiveCourses] = useState<any[]>([]);
    const [liveRooms, setLiveRooms] = useState<any[]>([]);
    const [liveLabs, setLiveLabs] = useState<any[]>([]);
    const [liveBlocks, setLiveBlocks] = useState<any[]>([]);
    const [selectedSlot, setSelectedSlot] = useState<null | {
        day: string;
        period: string;
        title: string;
        course: string;
        courseCode: string;
        faculty: string;
        section: string;
        room: string;
        block: string;
        type: string;
        batch?: string;
        electiveGroup?: string;
        isFree?: boolean;
    }>(null);

    useEffect(() => {
        setIsLoading(true);
        setErrorMessage(null);
        Promise.all([
            api.timetable(),
            api.sections(),
            api.faculty(),
            api.courses(),
            api.rooms(),
            api.laboratories(),
            api.blocks(),
        ]).then(([entries, sectionRecords, facultyRecords, courseRecords, roomRecords, labRecords, blockRecords]) => {
            setLiveFaculty(facultyRecords);
            setLiveCourses(courseRecords);
            setLiveRooms(roomRecords.map((room: any) => ({
                ...room,
                id: room.roomName,
                roomNumber: room.roomName,
                block: room.block?.name ?? room.block,
                type: 'Classroom',
            })));
            setLiveLabs(labRecords.map((lab: any) => ({
                ...lab,
                id: lab.name,
                block: lab.block?.name ?? lab.block,
                type: lab.labType,
                department: lab.department ?? (lab.name?.includes('Electrical') ? 'EEE' : lab.name?.includes('Electronics') || lab.name?.includes('Communication') ? 'ECE' : lab.name?.includes('Mechanical') || lab.name?.includes('Workshop') || lab.name?.includes('CAD') ? 'MECH' : 'CSE'),
            })));
            setLiveBlocks(blockRecords);
            setLiveEntries(entries.map((entry: any) => ({
                ...entry,
                sectionId: entry.section,
                courseCode: entry.courseCode,
                facultyId: entry.faculty,
                roomId: entry.room ?? undefined,
                labId: entry.laboratory ?? undefined,
                details: entry.course,
            })));
            setLiveSections(sectionRecords.map((item: any) => ({
                id: item.name,
                department: item.department?.code ?? item.departmentId,
                year: item.year,
                studentStrength: item.strength,
                block: item.assignedBlock,
                advisor: item.advisor,
            })));
            setIsLoading(false);
        }).catch((err) => {
            console.error('Failed to load timetable data:', err);
            setLiveFaculty([]);
            setLiveCourses([]);
            setLiveRooms([]);
            setLiveLabs([]);
            setLiveBlocks([]);
            setLiveEntries([]);
            setLiveSections([]);
            setErrorMessage('The active timetable could not be loaded from the backend. No sample timetable data will be shown.');
            setIsLoading(false);
        });
    }, []);

    const entries = liveEntries;
    const sectionSource = liveSections;
    const facultySource = liveFaculty.map((member) => ({ ...member, id: member.name, department: member.department?.code ?? member.departmentId }));
    const roomSource = liveRooms;
    const labSource = liveLabs;
    const blockSource = liveBlocks.length > 0 ? liveBlocks : [{ id: 'b1', name: 'A Block' }, { id: 'b2', name: 'H Block' }, { id: 'b3', name: 'N Block' }, { id: 'b4', name: 'U Block' }];
    const courseSource = liveCourses;

    const courseName = (code?: string) => courseSource.find((course) => course.code === code)?.name ?? code ?? 'Course';
    const facultyName = (id?: string) => facultySource.find((member) => member.id === id || member.name === id)?.name ?? id ?? 'Faculty';
    const roomInfo = (id?: string) => roomSource.find((room) => room.id === id || room.roomNumber === id || room.roomName === id);
    const labInfo = (id?: string) => labSource.find((lab) => lab.id === id || lab.name === id);

    const departmentOptions = useMemo(() => {
        if (liveSections.length > 0) {
            const seen = new Set<string>();
            const opts: Array<{ code: string; name: string }> = [];
            liveSections.forEach((sec) => {
                if (sec.department && !seen.has(sec.department)) {
                    seen.add(sec.department);
                    opts.push({ code: sec.department, name: sec.department });
                }
            });
            return opts.length > 0 ? opts : defaultDepartments;
        }
        return defaultDepartments;
    }, [liveSections]);

    const sectionRecords = useMemo(
        () => sectionSource.filter((item) => item.department === department && item.year === year),
        [department, sectionSource, year],
    );

    useEffect(() => {
        if (sectionRecords.length > 0 && !sectionRecords.some((item) => item.id === section)) {
            setSection(sectionRecords[0].id);
        }
    }, [section, sectionRecords]);

    const selectedSectionInfo = sectionRecords.find((item) => item.id === section) ?? sectionRecords[0] ?? null;

    const selectedFacultyOptions = useMemo(
        () => facultySource.filter((member) => member.department === department || member.department === 'All'),
        [facultySource, department],
    );

    useEffect(() => {
        if (selectedFacultyOptions.length > 0 && !selectedFacultyOptions.some((member) => member.id === selectedFacultyId)) {
            setSelectedFacultyId(selectedFacultyOptions[0].id);
        }
    }, [selectedFacultyId, selectedFacultyOptions]);

    const roomOptions = useMemo(
        () => roomSource.filter((room) => room.block === selectedBlock),
        [roomSource, selectedBlock],
    );

    useEffect(() => {
        if (roomOptions.length > 0 && !roomOptions.some((room) => room.id === selectedRoomId)) {
            setSelectedRoomId(roomOptions[0].id);
        }
    }, [roomOptions, selectedRoomId]);

    const labOptions = useMemo(
        () => labSource.filter((lab) => lab.department === department || !lab.department),
        [labSource, department],
    );

    useEffect(() => {
        if (labOptions.length > 0 && !labOptions.some((lab) => lab.id === selectedLabId)) {
            setSelectedLabId(labOptions[0].id);
        }
    }, [labOptions, selectedLabId]);

    const selectedSectionSchedule = useMemo(
        () => entries.filter((entry) => entry.sectionId === selectedSectionInfo?.id),
        [entries, selectedSectionInfo],
    );

    const facultySchedule = useMemo(
        () => entries.filter((entry) => entry.facultyId === selectedFacultyId),
        [entries, selectedFacultyId],
    );

    const roomSchedule = useMemo(
        () => entries.filter((entry) => entry.roomId === selectedRoomId),
        [entries, selectedRoomId],
    );

    const labSchedule = useMemo(
        () => entries.filter((entry) => entry.labId === selectedLabId),
        [entries, selectedLabId],
    );

    useEffect(() => {
        const next = new URLSearchParams();
        next.set('department', department);
        next.set('year', year);
        if (selectedSectionInfo?.id) next.set('section', selectedSectionInfo.id);
        next.set('view', view);
        if (view === 'Room-wise' && selectedRoomId) next.set('room', selectedRoomId);
        if (view === 'Laboratory-wise' && selectedLabId) next.set('lab', selectedLabId);
        const nextString = next.toString();
        const target = `?${nextString}`;
        if (location.search !== target) {
            navigate({ pathname: location.pathname, search: target }, { replace: true });
        }
    }, [department, year, view, section, selectedSectionInfo, selectedRoomId, selectedLabId, location.pathname, location.search, navigate]);

    const summaryCards = [
        { label: 'Total Sessions', value: String(entries.length), icon: CalendarDays },
        { label: 'Faculty Conflicts', value: '0', icon: UserRound },
        { label: 'Room Conflicts', value: '0', icon: Building2 },
        { label: 'Laboratory Sessions', value: String(entries.filter((entry) => entry.type === 'Laboratory' || entry.type === 'LAB').length), icon: Layers3 },
        { label: 'Free Periods', value: String(Math.max((days.length * periods.length) - selectedSectionSchedule.length, 0)), icon: Clock3 },
    ];

    const renderSectionGrid = () => {
        if (!selectedSectionInfo) {
            return (
                <div className="rounded-3xl border border-dashed border-sky-200 bg-sky-50 p-8 text-center text-slate-600">
                    <p className="text-lg font-semibold text-slate-800">No sections found for {department} ({year})</p>
                    <p className="mt-1 text-sm text-slate-500">Please select another department/year or create a section in the Sections tab.</p>
                </div>
            );
        }

        const slotMap = new Map(selectedSectionSchedule.map((entry) => [`${entry.day}|${entry.period}`, entry]));

        return (
            <div className="space-y-5">
                <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">Section summary</div>
                            <div className="mt-2 text-xl font-bold text-slate-800">Section: {selectedSectionInfo.id}</div>
                        </div>
                        <div className="flex flex-wrap gap-2 text-sm text-slate-600">
                            <span className="rounded-full bg-white px-3 py-1.5 shadow-xs">Year: {selectedSectionInfo.year}</span>
                            <span className="rounded-full bg-white px-3 py-1.5 shadow-xs">Students: {selectedSectionInfo.studentStrength}</span>
                            <span className="rounded-full bg-white px-3 py-1.5 shadow-xs">Block: {selectedSectionInfo.block}</span>
                            <span className="rounded-full bg-white px-3 py-1.5 shadow-xs">Advisor: {selectedSectionInfo.advisor}</span>
                        </div>
                    </div>
                </div>

                {selectedSectionSchedule.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
                        No timetable has been generated for {selectedSectionInfo.id} yet. You can generate one from the Generate Timetable page.
                    </div>
                )}

                <div className="overflow-auto rounded-2xl border border-sky-100 bg-white shadow-soft">
                    <table className="min-w-[920px] w-full border-collapse text-left">
                        <thead>
                            <tr className="bg-sky-50 text-slate-700">
                                <th className="border-b border-sky-100 px-3 py-4 font-semibold">Period</th>
                                {days.map((day) => (
                                    <th key={day} className="border-b border-sky-100 px-3 py-4 font-semibold">{day}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {periods.map((period) => (
                                <tr key={period} className="align-top">
                                    <td className="border-b border-r border-sky-100 bg-slate-50 px-3 py-3 font-semibold text-slate-600">{period}</td>
                                    {days.map((day) => {
                                        const entry = slotMap.get(`${day}|${period}`);
                                        const fallbackLabel = getEmptyCellLabel();
                                        const matchedRoom = roomInfo(entry?.roomId);
                                        const matchedLab = labInfo(entry?.labId);

                                        const cell = entry
                                            ? {
                                                day,
                                                period,
                                                title: entry.details ?? courseName(entry.courseCode),
                                                course: courseName(entry.courseCode),
                                                courseCode: entry.courseCode ?? '—',
                                                faculty: facultyName(entry.facultyId),
                                                section: entry.sectionId,
                                                room: matchedRoom?.roomNumber ?? matchedLab?.name ?? entry.room ?? entry.laboratory ?? '—',
                                                block: matchedRoom?.block ?? matchedLab?.block ?? '—',
                                                type: entry.type,
                                                batch: entry.labBatch ?? (entry.labId ? 'Batch A' : undefined),
                                                electiveGroup: entry.electiveGroup,
                                            }
                                            : {
                                                day,
                                                period,
                                                title: fallbackLabel,
                                                course: fallbackLabel,
                                                courseCode: '—',
                                                faculty: '—',
                                                section: selectedSectionInfo.id,
                                                room: '—',
                                                block: selectedSectionInfo.block ?? '—',
                                                type: 'Free Period',
                                                isFree: true,
                                            };

                                        return (
                                            <td key={`${day}-${period}`} className="border-b border-r border-sky-100 px-2 py-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedSlot(cell)}
                                                    className={`w-full rounded-2xl border p-2 text-left transition hover:shadow-sm ${entry ? getCellStyle(entry.type) : 'border-dashed border-amber-200 bg-amber-50 text-amber-700'}`}
                                                >
                                                    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{cell.type}</div>
                                                    <div className="mt-1 text-sm font-bold">{cell.course}</div>
                                                    {entry && (
                                                        <>
                                                            <div className="mt-1 text-[11px] font-medium">{cell.courseCode}</div>
                                                            <div className="mt-2 flex items-center gap-1 text-[11px]">
                                                                <UserRound className="h-3 w-3" /> {cell.faculty}
                                                            </div>
                                                            <div className="mt-1 flex items-center gap-1 text-[11px]">
                                                                <MapPin className="h-3 w-3" /> {cell.room}
                                                            </div>
                                                        </>
                                                    )}
                                                    {!entry && <div className="mt-2 text-[11px] font-medium">{cell.title}</div>}
                                                </button>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    const renderFacultyGrid = () => {
        const facultyEntries = facultySchedule;

        return (
            <div className="space-y-5">
                <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">Faculty view</div>
                            <div className="mt-1 text-xl font-bold text-slate-800">Selected Faculty: {selectedFacultyId || 'None'}</div>
                        </div>
                        <label className="flex items-center gap-2 rounded-xl border border-sky-100 bg-white px-3 py-2 text-sm text-slate-600 shadow-xs">
                            <span>Faculty</span>
                            <select
                                value={selectedFacultyId}
                                onChange={(event) => setSelectedFacultyId(event.target.value)}
                                className="bg-transparent font-medium text-slate-800 outline-none"
                            >
                                {selectedFacultyOptions.map((member) => (
                                    <option key={member.id} value={member.id}>{member.name}</option>
                                ))}
                            </select>
                        </label>
                    </div>
                </div>

                <div className="overflow-auto rounded-2xl border border-sky-100 bg-white shadow-soft">
                    <table className="min-w-[900px] w-full border-collapse text-left">
                        <thead>
                            <tr className="bg-sky-50 text-slate-700">
                                <th className="px-3 py-4 font-semibold">Day</th>
                                <th className="px-3 py-4 font-semibold">Period</th>
                                <th className="px-3 py-4 font-semibold">Course</th>
                                <th className="px-3 py-4 font-semibold">Section</th>
                                <th className="px-3 py-4 font-semibold">Room / Lab</th>
                                <th className="px-3 py-4 font-semibold">Block</th>
                                <th className="px-3 py-4 font-semibold">Session Type</th>
                            </tr>
                        </thead>
                        <tbody>
                            {facultyEntries.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="p-6 text-center text-slate-400">No sessions scheduled for this faculty member.</td>
                                </tr>
                            ) : (
                                facultyEntries.map((entry) => {
                                    const currentRoom = roomInfo(entry.roomId);
                                    const currentLab = labInfo(entry.labId);
                                    return (
                                        <tr key={entry.id} className="border-t border-sky-100">
                                            <td className="px-3 py-3 font-medium text-slate-700">{entry.day}</td>
                                            <td className="px-3 py-3 text-slate-700">{entry.period}</td>
                                            <td className="px-3 py-3 font-medium text-slate-800">{courseName(entry.courseCode)}</td>
                                            <td className="px-3 py-3 text-slate-700">{entry.sectionId}</td>
                                            <td className="px-3 py-3 text-slate-700">{currentRoom?.roomNumber ?? currentLab?.name ?? entry.room ?? entry.laboratory ?? '—'}</td>
                                            <td className="px-3 py-3 text-slate-700">{currentRoom?.block ?? currentLab?.block ?? '—'}</td>
                                            <td className="px-3 py-3">
                                                <span className={`rounded-full px-2 py-1 text-xs font-semibold ${entry.type === 'Laboratory' || entry.type === 'LAB' ? 'bg-emerald-50 text-emerald-700' : 'bg-sky-50 text-sky-700'}`}>
                                                    {entry.type}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    const renderRoomGrid = () => {
        const currentRoom = roomInfo(selectedRoomId);
        const roomEntries = roomSchedule;
        const roomMap = new Map(roomEntries.map((entry) => [`${entry.day}|${entry.period}`, entry]));

        return (
            <div className="space-y-5">
                <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">Room view</div>
                            <div className="mt-1 text-xl font-bold text-slate-800">Room: {currentRoom?.roomNumber ?? selectedRoomId ?? '—'}</div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <label className="flex items-center gap-2 rounded-xl border border-sky-100 bg-white px-3 py-2 text-sm text-slate-600 shadow-xs">
                                <span>Block</span>
                                <select value={selectedBlock} onChange={(event) => setSelectedBlock(event.target.value)} className="bg-transparent font-medium text-slate-800 outline-none">
                                    {blockSource.map((block) => (
                                        <option key={block.id} value={block.name}>{block.name}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="flex items-center gap-2 rounded-xl border border-sky-100 bg-white px-3 py-2 text-sm text-slate-600 shadow-xs">
                                <span>Room</span>
                                <select value={selectedRoomId} onChange={(event) => setSelectedRoomId(event.target.value)} className="bg-transparent font-medium text-slate-800 outline-none">
                                    {roomOptions.map((room) => (
                                        <option key={room.id} value={room.id}>{room.roomNumber}</option>
                                    ))}
                                </select>
                            </label>
                        </div>
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                    <div className="rounded-2xl bg-sky-50 p-4"><div className="text-xs uppercase tracking-[0.2em] text-slate-500">Room</div><div className="mt-2 text-lg font-bold text-slate-800">{currentRoom?.roomNumber ?? '—'}</div></div>
                    <div className="rounded-2xl bg-sky-50 p-4"><div className="text-xs uppercase tracking-[0.2em] text-slate-500">Block</div><div className="mt-2 text-lg font-bold text-slate-800">{currentRoom?.block ?? '—'}</div></div>
                    <div className="rounded-2xl bg-sky-50 p-4"><div className="text-xs uppercase tracking-[0.2em] text-slate-500">Floor</div><div className="mt-2 text-lg font-bold text-slate-800">{currentRoom?.floor ?? '—'}</div></div>
                    <div className="rounded-2xl bg-sky-50 p-4"><div className="text-xs uppercase tracking-[0.2em] text-slate-500">Capacity</div><div className="mt-2 text-lg font-bold text-slate-800">{currentRoom?.capacity ?? '—'}</div></div>
                    <div className="rounded-2xl bg-sky-50 p-4"><div className="text-xs uppercase tracking-[0.2em] text-slate-500">Department</div><div className="mt-2 text-lg font-bold text-slate-800">{currentRoom?.department ?? 'Shared'}</div></div>
                </div>

                <div className="overflow-auto rounded-2xl border border-sky-100 bg-white shadow-soft">
                    <table className="min-w-[900px] w-full border-collapse text-left">
                        <thead>
                            <tr className="bg-sky-50 text-slate-700">
                                <th className="px-3 py-4 font-semibold">Day</th>
                                <th className="px-3 py-4 font-semibold">Period</th>
                                <th className="px-3 py-4 font-semibold">Course</th>
                                <th className="px-3 py-4 font-semibold">Section</th>
                                <th className="px-3 py-4 font-semibold">Faculty</th>
                                <th className="px-3 py-4 font-semibold">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {days.flatMap((day) => periods.map((period) => {
                                const entry = roomMap.get(`${day}|${period}`);
                                return (
                                    <tr key={`${day}-${period}`} className="border-t border-sky-100">
                                        <td className="px-3 py-3 text-slate-700 font-medium">{day}</td>
                                        <td className="px-3 py-3 text-slate-700">{period}</td>
                                        <td className="px-3 py-3 text-slate-800 font-medium">{entry ? courseName(entry.courseCode) : 'Free'}</td>
                                        <td className="px-3 py-3 text-slate-700">{entry ? entry.sectionId : '—'}</td>
                                        <td className="px-3 py-3 text-slate-700">{entry ? facultyName(entry.facultyId) : '—'}</td>
                                        <td className="px-3 py-3">
                                            <span className={`rounded-full px-2 py-1 text-xs font-semibold ${entry ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                                                {entry ? 'Occupied' : 'Available'}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            }))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    const renderLabGrid = () => {
        const currentLab = labInfo(selectedLabId);
        const labEntries = labSchedule;
        const labMap = new Map(labEntries.map((entry) => [`${entry.day}|${entry.period}`, entry]));

        return (
            <div className="space-y-5">
                <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">Laboratory view</div>
                            <div className="mt-1 text-xl font-bold text-slate-800">{currentLab?.name ?? selectedLabId ?? 'Laboratory'}</div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <label className="flex items-center gap-2 rounded-xl border border-sky-100 bg-white px-3 py-2 text-sm text-slate-600 shadow-xs">
                                <span>Department</span>
                                <select value={department} onChange={(event) => setDepartment(event.target.value)} className="bg-transparent font-medium text-slate-800 outline-none">
                                    {departmentOptions.map((option) => (
                                        <option key={option.code} value={option.code}>{option.name}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="flex items-center gap-2 rounded-xl border border-sky-100 bg-white px-3 py-2 text-sm text-slate-600 shadow-xs">
                                <span>Laboratory</span>
                                <select value={selectedLabId} onChange={(event) => setSelectedLabId(event.target.value)} className="bg-transparent font-medium text-slate-800 outline-none">
                                    {labOptions.map((lab) => (
                                        <option key={lab.id} value={lab.id}>{lab.name}</option>
                                    ))}
                                </select>
                            </label>
                        </div>
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-4">
                    <div className="rounded-2xl bg-sky-50 p-4"><div className="text-xs uppercase tracking-[0.2em] text-slate-500">Lab</div><div className="mt-2 text-lg font-bold text-slate-800">{currentLab?.name ?? '—'}</div></div>
                    <div className="rounded-2xl bg-sky-50 p-4"><div className="text-xs uppercase tracking-[0.2em] text-slate-500">Block</div><div className="mt-2 text-lg font-bold text-slate-800">{currentLab?.block ?? '—'}</div></div>
                    <div className="rounded-2xl bg-sky-50 p-4"><div className="text-xs uppercase tracking-[0.2em] text-slate-500">Floor</div><div className="mt-2 text-lg font-bold text-slate-800">{currentLab?.floor ?? '—'}</div></div>
                    <div className="rounded-2xl bg-sky-50 p-4"><div className="text-xs uppercase tracking-[0.2em] text-slate-500">Capacity</div><div className="mt-2 text-lg font-bold text-slate-800">{currentLab?.capacity ? `${currentLab.capacity} students` : '—'}</div></div>
                </div>

                <div className="overflow-auto rounded-2xl border border-sky-100 bg-white shadow-soft">
                    <table className="min-w-[1100px] w-full border-collapse text-left">
                        <thead>
                            <tr className="bg-sky-50 text-slate-700">
                                <th className="px-3 py-4 font-semibold">Day</th>
                                <th className="px-3 py-4 font-semibold">Period</th>
                                <th className="px-3 py-4 font-semibold">Lab</th>
                                <th className="px-3 py-4 font-semibold">Block</th>
                                <th className="px-3 py-4 font-semibold">Section</th>
                                <th className="px-3 py-4 font-semibold">Batch</th>
                                <th className="px-3 py-4 font-semibold">Faculty</th>
                                <th className="px-3 py-4 font-semibold">Course</th>
                            </tr>
                        </thead>
                        <tbody>
                            {days.flatMap((day) => periods.map((period) => {
                                const entry = labMap.get(`${day}|${period}`);
                                return (
                                    <tr key={`${day}-${period}`} className="border-t border-sky-100">
                                        <td className="px-3 py-3 text-slate-700 font-medium">{day}</td>
                                        <td className="px-3 py-3 text-slate-700">{period}</td>
                                        <td className="px-3 py-3 text-slate-800 font-medium">{entry ? currentLab?.name ?? 'Lab' : 'Available'}</td>
                                        <td className="px-3 py-3 text-slate-700">{currentLab?.block ?? '—'}</td>
                                        <td className="px-3 py-3 text-slate-700">{entry ? entry.sectionId : '—'}</td>
                                        <td className="px-3 py-3 text-slate-700">{entry?.labBatch ?? (entry ? 'Batch A' : '—')}</td>
                                        <td className="px-3 py-3 text-slate-700">{entry ? facultyName(entry.facultyId) : '—'}</td>
                                        <td className="px-3 py-3 text-slate-800 font-medium">{entry ? courseName(entry.courseCode) : 'Free'}</td>
                                    </tr>
                                );
                            }))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="card p-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div>
                        <div className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">Timetable</div>
                        <h1 className="mt-1 text-2xl font-bold text-slate-800">College-wide schedule</h1>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <label className="flex items-center gap-2 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-slate-600">
                            <span>Department</span>
                            <select value={department} onChange={(event) => setDepartment(event.target.value)} className="bg-transparent font-medium text-slate-800 outline-none">
                                {departmentOptions.map((option) => (
                                    <option key={option.code} value={option.code}>{option.code} — {option.name}</option>
                                ))}
                            </select>
                        </label>
                        <label className="flex items-center gap-2 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-slate-600">
                            <span>Year</span>
                            <select value={year} onChange={(event) => setYear(event.target.value)} className="bg-transparent font-medium text-slate-800 outline-none">
                                {yearOptions.map((item) => (
                                    <option key={item} value={item}>{item}</option>
                                ))}
                            </select>
                        </label>
                        {view === 'Section-wise' && (
                            <label className="flex items-center gap-2 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-slate-600">
                                <span>Section</span>
                                <select
                                    value={selectedSectionInfo?.id ?? ''}
                                    onChange={(event) => setSection(event.target.value)}
                                    className="bg-transparent font-medium text-slate-800 outline-none"
                                >
                                    {sectionRecords.map((item) => (
                                        <option key={item.id} value={item.id}>{item.id}</option>
                                    ))}
                                </select>
                            </label>
                        )}
                        <label className="flex items-center gap-2 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-slate-600">
                            <span>View</span>
                            <select value={view} onChange={(event) => setView(event.target.value)} className="bg-transparent font-medium text-slate-800 outline-none">
                                {viewOptions.map((item) => (
                                    <option key={item} value={item}>{item}</option>
                                ))}
                            </select>
                        </label>
                    </div>
                </div>
            </div>

            {isLoading ? (
                <div className="card p-12 text-center text-slate-500">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-sky-600 border-t-transparent"></div>
                    <p className="mt-3 font-medium">Loading live timetable data from database...</p>
                </div>
            ) : (
                <>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                        {summaryCards.map(({ label, value, icon: Icon }) => (
                            <div key={label} className="card p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-2xl font-bold text-slate-900">{value}</div>
                                        <div className="text-sm text-slate-500">{label}</div>
                                    </div>
                                    <div className="rounded-xl bg-sky-50 p-2 text-sky-700">
                                        <Icon className="h-5 w-5" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {view === 'Section-wise' && renderSectionGrid()}
                    {view === 'Faculty-wise' && renderFacultyGrid()}
                    {view === 'Room-wise' && renderRoomGrid()}
                    {view === 'Laboratory-wise' && renderLabGrid()}
                </>
            )}

            <TimetableSlotModal slot={selectedSlot} onClose={() => setSelectedSlot(null)} />
        </div>
    );
}

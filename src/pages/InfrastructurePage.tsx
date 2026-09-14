import { Building2, ClipboardList, Cpu, MapPin, Search, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sampleApiBlocks, sampleApiLabs, sampleApiRooms, sampleApiSections, sampleApiTimetable } from '../data/sampleFrontendData';
import { getDatasetBlocks, getDatasetLaboratories, getDatasetRooms, getDatasetSections, loadActiveCollegeDataset } from '../services/activeCollegeDataset';

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const periods = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];
const labTypeFilters = ['All', 'Physics', 'Chemistry', 'Computer', 'Electronics', 'Mechanical', 'Electrical'];
const roomTypeFilters = ['All', 'Teaching Room', 'Faculty Room', 'Administrative Space', 'Staff Space'];

const matchesSearch = (value: string, query: string) => value.toLowerCase().includes(query.toLowerCase());

const normalizeRoom = (room: any) => ({
    id: room.roomName ?? room.id ?? room.roomId ?? 'ROOM',
    roomNumber: room.roomName ?? room.roomNumber ?? 'Room',
    block: room.block?.name ?? room.blockName ?? room.block ?? 'A Block',
    floor: room.floor ?? 'Ground Floor',
    roomType: room.roomType === 'TEACHING_ROOM' ? 'Teaching Room' : room.roomType ?? 'Teaching Room',
    capacity: Number(room.capacity ?? 0),
    department: room.department ?? 'CSE',
    status: room.active === false ? 'inactive' : 'active',
    type: room.type ?? 'Classroom',
    currentSectionStrength: Number(room.currentSectionStrength ?? 0),
    equipment: Array.isArray(room.equipment) ? room.equipment : [],
});

const normalizeSection = (section: any) => ({
    id: section.name ?? section.id ?? 'SECTION',
    department: section.department?.code ?? section.department ?? 'CSE',
    strength: Number(section.strength ?? section.studentStrength ?? 0),
    block: section.assignedBlock ?? section.block ?? 'A Block',
});

const normalizeLab = (lab: any) => ({
    id: lab.id ?? lab.labId ?? lab.name,
    name: lab.name,
    labCode: lab.labCode ?? lab.id ?? 'LAB',
    block: lab.block?.name ?? lab.blockName ?? lab.block ?? 'A Block',
    floor: lab.floor ?? 'Ground Floor',
    capacity: Number(lab.capacity ?? 0),
    equipment: Array.isArray(lab.equipment) ? lab.equipment : typeof lab.equipment === 'string' ? lab.equipment.split(',') : [],
    department: lab.department ?? 'CSE',
    type: lab.labType ?? lab.type ?? 'Computer',
    assignedSections: Array.isArray(lab.assignedSections) ? lab.assignedSections : [],
    labBatches: Array.isArray(lab.labBatches) ? lab.labBatches : [],
    currentAllocation: Number(lab.currentAllocation ?? 0),
    status: lab.status ?? 'Ready',
    batchCapacity: Number(lab.batchCapacity ?? lab.capacity ?? 0),
});

const getRoomStatus = (room: any, timetable: any[], day: string, period: string, sectionStrengths: Map<string, number>) => {
    const entry = timetable.find((item) => {
        const roomValues = [item.room, item.roomId, item.roomName, item.room?.roomName, item.room?.id].filter(Boolean).map(String);
        return item.day === day && item.period === period && (roomValues.includes(room.roomNumber) || roomValues.includes(room.id));
    });

    const currentStudents = entry
        ? (sectionStrengths.get(String(entry.section ?? entry.sectionId ?? '')) ?? Number(room.currentSectionStrength ?? 0))
        : Number(room.currentSectionStrength ?? 0);

    return {
        entry,
        status: entry ? 'Occupied' : 'Available',
        currentStudents,
        availableSeats: Math.max(room.capacity - currentStudents, 0),
    };
};

const getLabStatus = (lab: any, timetable: any[], day: string, period: string) => {
    const occupied = timetable.some((entry) => {
        const labValues = [entry.laboratory, entry.lab, entry.labId, entry.laboratory?.name].filter(Boolean).map(String);
        return entry.day === day && entry.period === period && (labValues.includes(lab.name) || labValues.includes(lab.id));
    });

    return occupied ? 'Occupied' : 'Available';
};

export function InfrastructurePage() {
    const navigate = useNavigate();
    const [search, setSearch] = useState('');
    const [selectedDay, setSelectedDay] = useState('Monday');
    const [selectedPeriod, setSelectedPeriod] = useState('P1');
    const [selectedBlock, setSelectedBlock] = useState('A Block');
    const [selectedFloor, setSelectedFloor] = useState('All');
    const [roomTypeFilter, setRoomTypeFilter] = useState('All');
    const [departmentFilter, setDepartmentFilter] = useState('All');
    const [capacityFilter, setCapacityFilter] = useState('All');
    const [statusFilter, setStatusFilter] = useState('All');
    const [labTypeFilter, setLabTypeFilter] = useState('All');
    const [findDay, setFindDay] = useState('Tuesday');
    const [findPeriod, setFindPeriod] = useState('P5');
    const [findCapacity, setFindCapacity] = useState('55');
    const [findDepartment, setFindDepartment] = useState('All');
    const [findBlock, setFindBlock] = useState('All');
    const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
    const [blocksData, setBlocksData] = useState<any[]>([]);
    const [roomsData, setRoomsData] = useState<any[]>([]);
    const [labsData, setLabsData] = useState<any[]>([]);
    const [sectionsData, setSectionsData] = useState<any[]>([]);
    const [timetableData, setTimetableData] = useState<any[]>([]);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        let active = true;

        async function loadInfrastructure() {
            const result = await loadActiveCollegeDataset();
            if (!active) return;

            if (result.source === 'error') {
                setBlocksData([]);
                setRoomsData([]);
                setLabsData([]);
                setSectionsData([]);
                setTimetableData([]);
                setErrorMessage(result.message ?? 'API unavailable — active dataset data cannot be loaded right now.');
                return;
            }

            if (result.source === 'sample' || !result.dataset) {
                setBlocksData(sampleApiBlocks);
                setRoomsData(sampleApiRooms);
                setLabsData(sampleApiLabs);
                setSectionsData(sampleApiSections);
                setTimetableData(sampleApiTimetable);
                setErrorMessage(null);
                return;
            }

            const dataset = result.dataset;
            setBlocksData(getDatasetBlocks(dataset));
            setRoomsData(getDatasetRooms(dataset));
            setLabsData(getDatasetLaboratories(dataset));
            setSectionsData(getDatasetSections(dataset));
            setTimetableData([]);
            setErrorMessage(null);
        }

        void loadInfrastructure();
        return () => { active = false; };
    }, []);

    const blocks = blocksData.length > 0
        ? blocksData.map((block) => ({ id: block.id, name: block.name, floorLabels: ['Ground Floor', 'First Floor', 'Second Floor', 'Third Floor'] }))
        : sampleApiBlocks.map((block) => ({ id: block.id, name: block.name, floorLabels: ['Ground Floor', 'First Floor', 'Second Floor', 'Third Floor'] }));

    useEffect(() => {
        if (blocks.length > 0 && !blocks.some((block) => block.name === selectedBlock)) {
            setSelectedBlock(blocks[0].name);
        }
    }, [blocks, selectedBlock]);

    const rooms = roomsData.length > 0
        ? roomsData.map(normalizeRoom)
        : sampleApiRooms.map(normalizeRoom);

    const teachingRooms = rooms.filter((room) => room.roomType === 'Teaching Room' || room.type === 'Classroom');
    const laboratories = labsData.length > 0
        ? labsData.map(normalizeLab)
        : sampleApiLabs.map(normalizeLab);
    const sections = sectionsData.length > 0
        ? sectionsData.map(normalizeSection)
        : sampleApiSections.map(normalizeSection);
    const timetable = timetableData.length > 0
        ? timetableData
        : sampleApiTimetable;

    const sectionStrengths = useMemo(() => new Map(sections.map((section) => [section.id, section.strength])), [sections]);

    const blockStats = useMemo(
        () =>
            blocks.map((block) => {
                const blockRooms = teachingRooms.filter((room) => room.block === block.name);
                const blockLabs = laboratories.filter((lab) => lab.block === block.name);
                const occupied = blockRooms.filter((room) => getRoomStatus(room, timetable, selectedDay, selectedPeriod, sectionStrengths).status === 'Occupied').length;
                const available = blockRooms.length - occupied;
                const utilization = blockRooms.length ? Math.round((occupied / blockRooms.length) * 100) : 0;
                return {
                    ...block,
                    teachingRooms: blockRooms.length,
                    laboratories: blockLabs.length,
                    floors: Array.from(new Set([...blockRooms.map((room) => room.floor), ...blockLabs.map((lab) => lab.floor)])),
                    occupied,
                    available,
                    utilization,
                };
            }),
        [blocks, laboratories, sectionStrengths, selectedDay, selectedPeriod, teachingRooms, timetable],
    );

    const totalTeachingRooms = teachingRooms.length;
    const occupiedTeachingRooms = teachingRooms.filter((room) => getRoomStatus(room, timetable, selectedDay, selectedPeriod, sectionStrengths).status === 'Occupied').length;
    const availableTeachingRooms = totalTeachingRooms - occupiedTeachingRooms;
    const teachingRoomUtilization = totalTeachingRooms ? Math.round((occupiedTeachingRooms / totalTeachingRooms) * 100) : 0;

    const selectedBlockFloors = useMemo(
        () => {
            const blockRooms = teachingRooms.filter((room) => room.block === selectedBlock);
            const blockLabs = laboratories.filter((lab) => lab.block === selectedBlock);
            return Array.from(new Set([...blockRooms.map((room) => room.floor), ...blockLabs.map((lab) => lab.floor)]));
        },
        [laboratories, selectedBlock, teachingRooms],
    );

    const selectedBlockRooms = useMemo(
        () => teachingRooms.filter((room) => room.block === selectedBlock),
        [selectedBlock, teachingRooms],
    );

    const selectedBlockLabs = useMemo(
        () => laboratories.filter((lab) => lab.block === selectedBlock),
        [laboratories, selectedBlock],
    );

    const roomGroups = useMemo(() => {
        const groups = new Map<string, any[]>();
        const floorOrder = ['Ground Floor', 'First Floor', 'Second Floor', 'Third Floor'];
        selectedBlockRooms.forEach((room) => {
            const key = room.floor || 'Ground Floor';
            const list = groups.get(key) ?? [];
            list.push(room);
            groups.set(key, list);
        });

        return floorOrder.filter((floor) => groups.has(floor)).map((floor) => ({
            floor,
            rooms: [...(groups.get(floor) ?? [])].sort((a, b) => a.roomNumber.localeCompare(b.roomNumber)),
        })).concat(Array.from(groups.entries()).filter(([floor]) => !floorOrder.includes(floor)).map(([floor, rooms]) => ({ floor, rooms: [...rooms].sort((a, b) => a.roomNumber.localeCompare(b.roomNumber)) })));
    }, [selectedBlockRooms]);

    const filteredTeachingRooms = useMemo(() => {
        const query = search.trim();
        const minimumCapacity = capacityFilter === 'All' ? 0 : Number(capacityFilter);

        return teachingRooms.filter((room) => {
            const { status } = getRoomStatus(room, timetable, selectedDay, selectedPeriod, sectionStrengths);
            const matchesQuery = !query || [room.roomNumber, room.block, room.floor, room.roomType, room.department, room.type].some((value) => matchesSearch(value, query));
            const matchesBlock = selectedBlock === 'All' || room.block === selectedBlock;
            const matchesFloor = selectedFloor === 'All' || room.floor === selectedFloor;
            const matchesType = roomTypeFilter === 'All' || room.roomType === roomTypeFilter;
            const matchesDepartment = departmentFilter === 'All' || room.department === departmentFilter;
            const matchesCapacity = room.capacity >= minimumCapacity;
            const matchesStatus = statusFilter === 'All' || status === statusFilter;
            return matchesQuery && matchesBlock && matchesFloor && matchesType && matchesDepartment && matchesCapacity && matchesStatus;
        });
    }, [capacityFilter, departmentFilter, roomTypeFilter, search, sectionStrengths, selectedBlock, selectedDay, selectedFloor, selectedPeriod, statusFilter, teachingRooms, timetable]);

    const filteredLabs = useMemo(() => {
        const query = search.trim();
        return laboratories.filter((lab) => {
            const status = getLabStatus(lab, timetable, selectedDay, selectedPeriod);
            const matchesQuery = !query || [lab.name, lab.block, lab.floor, lab.type, lab.department, lab.labCode].some((value) => matchesSearch(value, query));
            const matchesBlock = selectedBlock === 'All' || lab.block === selectedBlock;
            const matchesFloor = selectedFloor === 'All' || lab.floor === selectedFloor;
            const matchesDepartment = departmentFilter === 'All' || lab.department === departmentFilter;
            const matchesType = labTypeFilter === 'All' || lab.type === labTypeFilter;
            const matchesStatus = statusFilter === 'All' || status === statusFilter;
            return matchesQuery && matchesBlock && matchesFloor && matchesDepartment && matchesType && matchesStatus;
        });
    }, [departmentFilter, labTypeFilter, laboratories, search, selectedBlock, selectedDay, selectedFloor, selectedPeriod, statusFilter, timetable]);

    const blockRoomCards = useMemo(
        () =>
            teachingRooms.filter((room) => room.block === selectedBlock).filter((room) => {
                const matchesFloor = selectedFloor === 'All' || room.floor === selectedFloor;
                const matchesType = roomTypeFilter === 'All' || room.roomType === roomTypeFilter;
                const matchesDepartment = departmentFilter === 'All' || room.department === departmentFilter;
                return matchesFloor && matchesType && matchesDepartment;
            }),
        [departmentFilter, roomTypeFilter, selectedBlock, selectedFloor, teachingRooms],
    );

    useEffect(() => {
        if (!selectedRoomId && selectedBlockRooms.length > 0) {
            setSelectedRoomId(selectedBlockRooms[0].id);
        }
        if (selectedRoomId && !selectedBlockRooms.some((room) => room.id === selectedRoomId)) {
            setSelectedRoomId(selectedBlockRooms[0]?.id ?? null);
        }
    }, [selectedBlockRooms, selectedRoomId]);

    const selectedRoomDetails = useMemo(() => {
        const roomsForSelection = selectedBlockRooms.length > 0 ? selectedBlockRooms : teachingRooms;
        const room = roomsForSelection.find((item) => item.id === selectedRoomId) ?? roomsForSelection[0] ?? teachingRooms[0] ?? null;
        return room ? room : null;
    }, [selectedBlockRooms, selectedRoomId, teachingRooms]);

    const findFreeResults = useMemo(() => {
        const requiredCapacity = Number(findCapacity) || 0;
        const matches = teachingRooms.filter((room) => {
            const blockMatch = findBlock === 'All' || room.block === findBlock;
            const departmentMatch = findDepartment === 'All' || room.department === findDepartment;
            const hasCapacity = room.capacity >= requiredCapacity;
            const { status } = getRoomStatus(room, timetable, findDay, findPeriod, sectionStrengths);
            const notOccupied = status === 'Available';
            return blockMatch && departmentMatch && hasCapacity && notOccupied;
        });

        return matches.map((room) => {
            const { currentStudents, availableSeats } = getRoomStatus(room, timetable, findDay, findPeriod, sectionStrengths);
            return {
                ...room,
                currentStudents,
                availableSeats,
                status: 'Available',
            };
        });
    }, [findBlock, findCapacity, findDay, findDepartment, findPeriod, sectionStrengths, teachingRooms, timetable]);

    const roomResultsReason = useMemo(() => {
        if (findFreeResults.length > 0) return '';
        const allOccupied = teachingRooms.filter((room) => {
            const { status } = getRoomStatus(room, timetable, findDay, findPeriod, sectionStrengths);
            return room.capacity >= (Number(findCapacity) || 0) && status === 'Occupied';
        }).length;
        if (allOccupied > 0) {
            return `All suitable rooms are occupied during ${findDay} ${findPeriod}.`;
        }
        return `No available room has capacity ≥ ${findCapacity || 0}.`;
    }, [findCapacity, findDay, findFreeResults.length, findPeriod, sectionStrengths, teachingRooms, timetable]);

    const selectedRoomStatus = selectedRoomDetails ? getRoomStatus(selectedRoomDetails, timetable, selectedDay, selectedPeriod, sectionStrengths) : null;
    const selectedLab = selectedBlockLabs[0] ?? laboratories[0] ?? null;
    const selectedLabStatus = selectedLab ? getLabStatus(selectedLab, timetable, selectedDay, selectedPeriod) : 'Available';

    return (
        <div className="space-y-6">
            <div className="card p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <div className="text-sm font-semibold uppercase tracking-[0.22em] text-sky-700">Infrastructure</div>
                        <div className="mt-1 text-2xl font-bold text-slate-800">Blocks, rooms and laboratories</div>
                    </div>
                    <label className="flex items-center gap-2 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-slate-600">
                        <Search className="h-4 w-4" />
                        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search room or lab" className="w-60 bg-transparent outline-none" />
                    </label>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="card p-4">
                    <div className="text-2xl font-bold text-slate-900">{totalTeachingRooms}</div>
                    <div className="text-sm text-slate-500">Total Teaching Rooms</div>
                </div>
                <div className="card p-4">
                    <div className="text-2xl font-bold text-slate-900">{occupiedTeachingRooms}</div>
                    <div className="text-sm text-slate-500">Occupied Teaching Rooms</div>
                </div>
                <div className="card p-4">
                    <div className="text-2xl font-bold text-slate-900">{availableTeachingRooms}</div>
                    <div className="text-sm text-slate-500">Available Teaching Rooms</div>
                </div>
                <div className="card p-4">
                    <div className="text-2xl font-bold text-slate-900">{teachingRoomUtilization}%</div>
                    <div className="text-sm text-slate-500">Teaching Room Utilization</div>
                </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
                <div className="card p-5">
                    <div className="mb-4 flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-sky-700" />
                        <div className="text-lg font-semibold text-slate-800">Blocks</div>
                    </div>
                    <div className="space-y-3">
                        {blockStats.map((block) => (
                            <button key={block.name} type="button" onClick={() => setSelectedBlock(block.name)} className="w-full rounded-2xl border border-sky-100 bg-sky-50 p-4 text-left transition hover:border-sky-200">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <div className="font-semibold text-slate-800">{block.name}</div>
                                        <div className="mt-1 text-sm text-slate-500">Teaching Rooms: {block.teachingRooms} • Laboratories: {block.laboratories}</div>
                                    </div>
                                    <div className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-sky-700">{block.utilization}%</div>
                                </div>
                                <div className="mt-3 grid gap-2 sm:grid-cols-4">
                                    <div className="rounded-xl bg-white p-2 text-xs text-slate-500">Floors <span className="mt-1 block font-semibold text-slate-800">{block.floors.length}</span></div>
                                    <div className="rounded-xl bg-white p-2 text-xs text-slate-500">Occupied <span className="mt-1 block font-semibold text-slate-800">{block.occupied}</span></div>
                                    <div className="rounded-xl bg-white p-2 text-xs text-slate-500">Available <span className="mt-1 block font-semibold text-slate-800">{block.available}</span></div>
                                    <div className="rounded-xl bg-white p-2 text-xs text-slate-500">Utilization <span className="mt-1 block font-semibold text-slate-800">{block.utilization}%</span></div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="card p-5">
                    <div className="mb-4 flex items-center gap-2">
                        <ClipboardList className="h-5 w-5 text-sky-700" />
                        <div className="text-lg font-semibold text-slate-800">Infrastructure filters</div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                        <label className="flex flex-col gap-1 text-sm text-slate-600">
                            <span>Block</span>
                            <select value={selectedBlock} onChange={(event) => { setSelectedBlock(event.target.value); setSelectedFloor('All'); }} className="rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 outline-none text-slate-800">
                                {blocks.map((block) => <option key={block.name} value={block.name}>{block.name}</option>)}
                            </select>
                        </label>
                        <label className="flex flex-col gap-1 text-sm text-slate-600">
                            <span>Floor</span>
                            <select value={selectedFloor} onChange={(event) => setSelectedFloor(event.target.value)} className="rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 outline-none text-slate-800">
                                <option value="All">All Floors</option>
                                {selectedBlockFloors.map((floor) => <option key={floor} value={floor}>{floor}</option>)}
                            </select>
                        </label>
                        <label className="flex flex-col gap-1 text-sm text-slate-600">
                            <span>Room Type</span>
                            <select value={roomTypeFilter} onChange={(event) => setRoomTypeFilter(event.target.value)} className="rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 outline-none text-slate-800">
                                {roomTypeFilters.map((option) => <option key={option} value={option}>{option}</option>)}
                            </select>
                        </label>
                        <label className="flex flex-col gap-1 text-sm text-slate-600">
                            <span>Department</span>
                            <select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} className="rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 outline-none text-slate-800">
                                <option value="All">All</option>
                                <option value="CSE">CSE</option>
                                <option value="ECE">ECE</option>
                                <option value="EEE">EEE</option>
                                <option value="ME">ME</option>
                            </select>
                        </label>
                        <label className="flex flex-col gap-1 text-sm text-slate-600">
                            <span>Capacity</span>
                            <select value={capacityFilter} onChange={(event) => setCapacityFilter(event.target.value)} className="rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 outline-none text-slate-800">
                                <option value="All">All</option>
                                <option value="30">30+</option>
                                <option value="50">50+</option>
                                <option value="60">60+</option>
                            </select>
                        </label>
                        <label className="flex flex-col gap-1 text-sm text-slate-600">
                            <span>Status</span>
                            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 outline-none text-slate-800">
                                <option value="All">All</option>
                                <option value="Available">Available</option>
                                <option value="Occupied">Occupied</option>
                            </select>
                        </label>
                        <label className="flex flex-col gap-1 text-sm text-slate-600">
                            <span>Day</span>
                            <select value={selectedDay} onChange={(event) => setSelectedDay(event.target.value)} className="rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 outline-none text-slate-800">
                                {days.map((day) => <option key={day} value={day}>{day}</option>)}
                            </select>
                        </label>
                        <label className="flex flex-col gap-1 text-sm text-slate-600">
                            <span>Period</span>
                            <select value={selectedPeriod} onChange={(event) => setSelectedPeriod(event.target.value)} className="rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 outline-none text-slate-800">
                                {periods.map((period) => <option key={period} value={period}>{period}</option>)}
                            </select>
                        </label>
                        <div className="md:col-span-2 flex items-center gap-3 pt-2">
                            <button type="button" onClick={() => { }} className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white">Apply Filters</button>
                            <button type="button" onClick={() => { setSelectedFloor('All'); setRoomTypeFilter('All'); setDepartmentFilter('All'); setCapacityFilter('All'); setStatusFilter('All'); setLabTypeFilter('All'); setSelectedDay('Monday'); setSelectedPeriod('P1'); }} className="rounded-xl border border-sky-200 bg-white px-4 py-2 text-sm font-semibold text-sky-700">Reset Filters</button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="card p-5">
                <div className="mb-4 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-sky-700" />
                        <div className="text-lg font-semibold text-slate-800">{selectedBlock} infrastructure</div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                        <span>{selectedDay} {selectedPeriod}</span>
                    </div>
                </div>

                <div className="mb-5 overflow-hidden rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-sky-100 p-4">
                    <div className="text-xs uppercase tracking-[0.22em] text-sky-700">Block visual</div>
                    <div className="mt-4 flex items-center gap-4">
                        <div className="flex h-28 w-28 items-center justify-center rounded-2xl border border-sky-200 bg-white text-4xl font-black text-sky-700 shadow-inner">
                            {selectedBlock.split(' ')[0]}
                        </div>
                        <div>
                            <div className="text-xl font-bold text-slate-800">{selectedBlock} placeholder</div>
                            <div className="mt-1 text-sm text-slate-500">Block-specific placeholder for {selectedBlock}. No project photograph is available for this block.</div>
                        </div>
                    </div>
                </div>

                {roomGroups.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-sky-200 bg-sky-50 p-4 text-slate-500">No rooms or laboratories match the selected filters.</div>
                ) : (
                    <div className="space-y-4">
                        {roomGroups.map((group) => (
                            <div key={group.floor} className="rounded-2xl border border-sky-100 bg-slate-50 p-4">
                                <div className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-600">{group.floor}</div>
                                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                    {group.rooms.map((room) => {
                                        const roomStatus = getRoomStatus(room, timetable, selectedDay, selectedPeriod, sectionStrengths);
                                        return (
                                            <button key={room.id} type="button" onClick={() => setSelectedRoomId(room.id)} className="rounded-2xl border border-sky-100 bg-white p-4 text-left">
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="font-semibold text-slate-800">{room.roomNumber}</div>
                                                    <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${roomStatus.status === 'Occupied' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{roomStatus.status}</span>
                                                </div>
                                                <div className="mt-2 text-sm text-slate-500">{room.block} • {room.floor}</div>
                                                <div className="mt-2 grid gap-2 text-xs text-slate-600">
                                                    <div>Capacity: {room.capacity}</div>
                                                    <div>Students: {roomStatus.currentStudents}</div>
                                                    <div>Available seats: {roomStatus.availableSeats}</div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
                <div className="card p-5">
                    <div className="mb-4 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2"><ClipboardList className="h-5 w-5 text-sky-700" /><div className="text-lg font-semibold text-slate-800">Teaching rooms</div></div>
                        <span className="text-sm text-slate-500">{filteredTeachingRooms.length} rooms</span>
                    </div>
                    {filteredTeachingRooms.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-sky-200 bg-sky-50 p-4 text-slate-500">No rooms or laboratories match the selected filters.</div>
                    ) : (
                        <div className="space-y-3">
                            {filteredTeachingRooms.map((room) => {
                                const roomStatus = getRoomStatus(room, timetable, selectedDay, selectedPeriod, sectionStrengths);
                                return (
                                    <div key={room.id} className="rounded-2xl border border-sky-100 bg-white p-3">
                                        <div className="flex items-center justify-between gap-2">
                                            <button type="button" onClick={() => setSelectedRoomId(room.id)} className="font-semibold text-slate-800 text-left">{room.roomNumber}</button>
                                            <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${roomStatus.status === 'Occupied' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{roomStatus.status}</span>
                                        </div>
                                        <div className="mt-2 text-sm text-slate-500">{room.block} • {room.floor} • {room.roomType}</div>
                                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                                            <span className="rounded-full bg-sky-50 px-2 py-1">Capacity {room.capacity}</span>
                                            <span className="rounded-full bg-sky-50 px-2 py-1">Available seats {roomStatus.availableSeats}</span>
                                            <span className="rounded-full bg-sky-50 px-2 py-1">{roomStatus.currentStudents} students</span>
                                        </div>
                                        <div className="mt-2 text-xs text-slate-600">Section: {roomStatus.entry?.section ?? roomStatus.entry?.sectionId ?? '—'} • Course: {roomStatus.entry?.course ?? roomStatus.entry?.courseCode ?? '—'}</div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="card p-5">
                    <div className="mb-4 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2"><Cpu className="h-5 w-5 text-sky-700" /><div className="text-lg font-semibold text-slate-800">Laboratories</div></div>
                        <span className="text-sm text-slate-500">{filteredLabs.length} labs</span>
                    </div>
                    {filteredLabs.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-sky-200 bg-sky-50 p-4 text-slate-500">No rooms or laboratories match the selected filters.</div>
                    ) : (
                        <div className="space-y-3">
                            {filteredLabs.map((lab) => {
                                const status = getLabStatus(lab, timetable, selectedDay, selectedPeriod);
                                return (
                                    <div key={lab.id} className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="font-semibold text-slate-800">{lab.name}</div>
                                            <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${status === 'Occupied' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{status}</span>
                                        </div>
                                        <div className="mt-2 text-sm text-slate-500">{lab.labCode} • {lab.block} • {lab.floor}</div>
                                        <div className="mt-2 grid gap-2 text-xs text-slate-600">
                                            <div>Capacity: {lab.capacity}</div>
                                            <div>Department: {lab.department}</div>
                                            <div>Equipment: {lab.equipment.join(', ') || '—'}</div>
                                            <div>Status: {status}</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            <div className="card p-5">
                <div className="mb-4 flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-sky-700" />
                    <div className="text-lg font-semibold text-slate-800">Find free room</div>
                </div>
                <div className="grid gap-3 md:grid-cols-5">
                    <select value={findDay} onChange={(event) => setFindDay(event.target.value)} className="rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 outline-none text-slate-800">
                        {days.map((day) => <option key={day} value={day}>{day}</option>)}
                    </select>
                    <select value={findPeriod} onChange={(event) => setFindPeriod(event.target.value)} className="rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 outline-none text-slate-800">
                        {periods.map((period) => <option key={period} value={period}>{period}</option>)}
                    </select>
                    <input value={findCapacity} onChange={(event) => setFindCapacity(event.target.value)} className="rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 outline-none text-slate-800" placeholder="Required capacity" />
                    <select value={findDepartment} onChange={(event) => setFindDepartment(event.target.value)} className="rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 outline-none text-slate-800">
                        <option value="All">All departments</option>
                        <option value="CSE">CSE</option>
                        <option value="ECE">ECE</option>
                        <option value="EEE">EEE</option>
                        <option value="ME">ME</option>
                    </select>
                    <select value={findBlock} onChange={(event) => setFindBlock(event.target.value)} className="rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 outline-none text-slate-800">
                        <option value="All">All blocks</option>
                        {blocks.map((block) => <option key={block.name} value={block.name}>{block.name}</option>)}
                    </select>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {findFreeResults.length > 0 ? findFreeResults.map((room) => (
                        <div key={room.id} className="rounded-2xl border border-sky-100 bg-slate-50 p-3">
                            <div className="font-semibold text-slate-800">{room.roomNumber}</div>
                            <div className="mt-1 text-sm text-slate-500">{room.block} • {room.floor}</div>
                            <div className="mt-2 text-xs text-slate-600">Capacity: {room.capacity} • Available: {room.availableSeats}</div>
                            <div className="mt-2 text-xs text-emerald-700">Status: Available</div>
                        </div>
                    )) : <div className="rounded-2xl border border-dashed border-sky-200 bg-sky-50 p-4 text-slate-500">No suitable room available. {roomResultsReason}</div>}
                </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
                <div className="card p-5">
                    <div className="mb-4 flex items-center gap-2">
                        <MapPin className="h-5 w-5 text-sky-700" />
                        <div className="text-lg font-semibold text-slate-800">Selected room details</div>
                    </div>
                    <div className="rounded-2xl bg-sky-50 p-4">
                        <div className="text-xl font-bold text-slate-800">{selectedRoomDetails?.roomNumber ?? 'A-101'}</div>
                        <div className="mt-2 text-sm text-slate-500">{selectedRoomDetails?.block ?? 'A Block'} • {selectedRoomDetails?.floor ?? 'Ground Floor'}</div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            <div className="rounded-xl bg-white p-3"><div className="text-xs uppercase tracking-[0.2em] text-slate-500">Room</div><div className="mt-1 font-semibold text-slate-800">{selectedRoomDetails?.roomNumber ?? 'A-101'}</div></div>
                            <div className="rounded-xl bg-white p-3"><div className="text-xs uppercase tracking-[0.2em] text-slate-500">Block</div><div className="mt-1 font-semibold text-slate-800">{selectedRoomDetails?.block ?? 'A Block'}</div></div>
                            <div className="rounded-xl bg-white p-3"><div className="text-xs uppercase tracking-[0.2em] text-slate-500">Floor</div><div className="mt-1 font-semibold text-slate-800">{selectedRoomDetails?.floor ?? 'Ground Floor'}</div></div>
                            <div className="rounded-xl bg-white p-3"><div className="text-xs uppercase tracking-[0.2em] text-slate-500">Capacity</div><div className="mt-1 font-semibold text-slate-800">{selectedRoomDetails?.capacity ?? 0}</div></div>
                            <div className="rounded-xl bg-white p-3"><div className="text-xs uppercase tracking-[0.2em] text-slate-500">Current Students</div><div className="mt-1 font-semibold text-slate-800">{selectedRoomStatus?.currentStudents ?? 0}</div></div>
                            <div className="rounded-xl bg-white p-3"><div className="text-xs uppercase tracking-[0.2em] text-slate-500">Available Seats</div><div className="mt-1 font-semibold text-slate-800">{selectedRoomStatus?.availableSeats ?? 0}</div></div>
                            <div className="rounded-xl bg-white p-3 sm:col-span-2"><div className="text-xs uppercase tracking-[0.2em] text-slate-500">Status</div><div className="mt-1 font-semibold text-slate-800">{selectedRoomStatus?.status ?? 'Available'}</div></div>
                        </div>
                    </div>
                </div>

                <div className="card p-5">
                    <div className="mb-4 flex items-center gap-2">
                        <Cpu className="h-5 w-5 text-sky-700" />
                        <div className="text-lg font-semibold text-slate-800">Laboratory details</div>
                    </div>
                    <div className="rounded-2xl bg-emerald-50 p-4">
                        <div className="text-xl font-bold text-slate-800">{selectedLab?.name ?? 'Programming Laboratory'}</div>
                        <div className="mt-2 text-sm text-slate-500">{selectedLab?.labCode ?? 'LAB-CSE'} • {selectedLab?.block ?? 'A Block'} • {selectedLab?.floor ?? 'Ground Floor'}</div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            <div className="rounded-xl bg-white p-3"><div className="text-xs uppercase tracking-[0.2em] text-slate-500">Capacity</div><div className="mt-1 font-semibold text-slate-800">{selectedLab?.capacity ?? 30}</div></div>
                            <div className="rounded-xl bg-white p-3"><div className="text-xs uppercase tracking-[0.2em] text-slate-500">Department</div><div className="mt-1 font-semibold text-slate-800">{selectedLab?.department ?? 'CSE'}</div></div>
                            <div className="rounded-xl bg-white p-3"><div className="text-xs uppercase tracking-[0.2em] text-slate-500">Equipment</div><div className="mt-1 font-semibold text-slate-800">{selectedLab?.equipment.join(', ') ?? 'Computers'}</div></div>
                            <div className="rounded-xl bg-white p-3"><div className="text-xs uppercase tracking-[0.2em] text-slate-500">Status</div><div className="mt-1 font-semibold text-slate-800">{selectedLabStatus}</div></div>
                        </div>
                    </div>
                </div>
            </div>

            {errorMessage ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">{errorMessage}</div>
            ) : null}
        </div>
    );
}

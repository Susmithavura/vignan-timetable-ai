import { Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { sampleApiSections } from '../data/sampleFrontendData';
import { getDatasetSections, loadActiveCollegeDataset } from '../services/activeCollegeDataset';

const normalizeSection = (section: any) => ({
    id: section.name ?? section.id ?? 'SECTION',
    department: section.department?.code ?? section.departmentId ?? 'CSE',
    year: section.year ?? '2nd Year',
    studentStrength: Number(section.strength ?? section.studentStrength ?? 0),
    block: section.assignedBlock ?? section.block ?? 'A Block',
    advisor: section.advisor ?? 'Academic Office',
});

export function SectionsPage() {
    const [sectionData, setSectionData] = useState<any[]>([]);
    const [search, setSearch] = useState('');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        let active = true;

        async function loadSections() {
            const result = await loadActiveCollegeDataset();
            if (!active) return;

            if (result.source === 'error') {
                setSectionData([]);
                setErrorMessage(result.message ?? 'API unavailable — active dataset data cannot be loaded right now.');
                return;
            }

            if (result.source === 'sample' || !result.dataset) {
                setSectionData(sampleApiSections.map(normalizeSection));
                setErrorMessage(null);
                return;
            }

            setSectionData(getDatasetSections(result.dataset).map((section) => ({
                id: section.id,
                department: section.department,
                year: section.year,
                studentStrength: section.strength,
                block: section.block,
                advisor: section.advisor,
            })));
            setErrorMessage(null);
        }

        void loadSections();
        return () => { active = false; };
    }, []);

    const sectionList = sectionData;
    const filteredSections = useMemo(() => {
        const query = search.trim().toLowerCase();
        return sectionList.filter((section) => [section.id, section.department, section.year, section.block, section.advisor].some((value) => String(value ?? '').toLowerCase().includes(query)));
    }, [search, sectionList]);

    return (
        <div className="space-y-6">
            <div className="card p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <div className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">Sections</div>
                        <div className="mt-1 text-2xl font-bold text-slate-800">Department-wise class sections</div>
                    </div>
                    <label className="flex items-center gap-2 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-slate-600">
                        <Search className="h-4 w-4" />
                        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search section" className="w-52 bg-transparent outline-none" />
                    </label>
                </div>
            </div>

            {errorMessage && (
                <div className="card border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{errorMessage}</div>
            )}

            <div className="card overflow-hidden">
                <div className="table-scroll">
                    <table className="min-w-[900px] w-full text-left">
                        <thead className="bg-sky-50">
                            <tr>
                                <th className="px-4 py-3 font-semibold text-slate-700">Section</th>
                                <th className="px-4 py-3 font-semibold text-slate-700">Department</th>
                                <th className="px-4 py-3 font-semibold text-slate-700">Year</th>
                                <th className="px-4 py-3 font-semibold text-slate-700">Strength</th>
                                <th className="px-4 py-3 font-semibold text-slate-700">Assigned Block</th>
                                <th className="px-4 py-3 font-semibold text-slate-700">Advisor</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredSections.map((section) => (
                                <tr key={section.id} className="border-t border-sky-100">
                                    <td className="px-4 py-3 font-medium text-slate-800">{section.id}</td>
                                    <td className="px-4 py-3 text-slate-600">{section.department}</td>
                                    <td className="px-4 py-3 text-slate-600">{section.year}</td>
                                    <td className="px-4 py-3 text-slate-600">{section.studentStrength}</td>
                                    <td className="px-4 py-3 text-slate-600">{section.block}</td>
                                    <td className="px-4 py-3 text-slate-600">{section.advisor}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

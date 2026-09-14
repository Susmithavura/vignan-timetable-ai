import { useMemo, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
    Activity,
    AlertTriangle,
    ArrowRight,
    Bell,
    BookOpen,
    Building2,
    CalendarDays,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    FileSpreadsheet,
    GraduationCap,
    LayoutDashboard,
    MessageSquareText,
    Settings,
    Sparkles,
    UserCircle2,
    Users,
    Wrench,
} from 'lucide-react';
import { VignanLogo } from './VignanLogo';

const navItems = [
    { label: 'Dashboard', to: '/', icon: LayoutDashboard },
    { label: 'Timetable', to: '/timetable', icon: CalendarDays },
    { label: 'Faculty', to: '/faculty', icon: Users },
    { label: 'Courses', to: '/courses', icon: BookOpen },
    { label: 'Sections', to: '/sections', icon: GraduationCap },
    { label: 'Infrastructure', to: '/infrastructure', icon: Building2 },
    { label: 'Lab Batches', to: '/lab-batches', icon: Wrench },
    { label: 'Constraints & Availability', to: '/constraints', icon: CheckCircle2 },
    { label: 'Generate Timetable', to: '/generate', icon: Sparkles },
    { label: 'Create Timetable', to: '/timetable-input', icon: Sparkles },
    { label: 'Clash Detection', to: '/clashes', icon: AlertTriangle },
    { label: 'Analytics', to: '/analytics', icon: Activity },
    { label: 'Change Requests', to: '/change-requests', icon: ArrowRight },
    { label: 'College Data', to: '/college-data', icon: FileSpreadsheet },
    { label: 'AI Assistant', to: '/assistant', icon: MessageSquareText },
    { label: 'Settings', to: '/settings', icon: Settings },
];

export function Layout() {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const currentYear = useMemo(() => '2026-2027', []);
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800">
            <div className="flex min-h-screen">
                <aside className={`${sidebarOpen ? 'w-72' : 'w-24'} border-r border-sky-100 bg-white/90 backdrop-blur-sm transition-all duration-200`}>
                    <div className="flex h-20 items-center justify-between border-b border-sky-100 px-4">
                        <div className={`${sidebarOpen ? 'opacity-100' : 'opacity-0 hidden'} transition-opacity`}>
                            <VignanLogo />
                        </div>
                        <button
                            className="flex h-9 w-9 items-center justify-center rounded-lg border border-sky-100 bg-sky-50 text-sky-700 transition hover:bg-sky-100"
                            onClick={() => setSidebarOpen((prev) => !prev)}
                            aria-label="Toggle sidebar"
                        >
                            {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                    </div>

                    <nav className="space-y-1 p-3">
                        {navItems.map(({ label, to, icon: Icon }) => (
                            <NavLink
                                key={label}
                                to={to}
                                end={to === '/'}
                                className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`}
                                title={label}
                            >
                                <Icon className="h-4 w-4 shrink-0" />
                                {sidebarOpen && <span className="truncate">{label}</span>}
                            </NavLink>
                        ))}
                    </nav>
                </aside>

                <div className="flex-1">
                    <header className="flex h-20 items-center justify-between border-b border-sky-100 bg-white/80 px-6 backdrop-blur-sm">
                        <div>
                            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">Academic Year {currentYear}</div>
                            <div className="mt-1 text-xl font-bold text-slate-800">VIGNAN TIMETABLE AI</div>
                        </div>
                        <div className="flex items-center gap-4">
                            <button className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-sky-100 bg-sky-50 text-sky-700 hover:bg-sky-100">
                                <Bell className="h-4 w-4" />
                                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-semibold text-white">3</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => navigate('/assistant')}
                                className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700"
                            >
                                AI Assistant
                            </button>
                            <div className="flex items-center gap-3 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2">
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-sky-700 shadow-sm">
                                    <UserCircle2 className="h-5 w-5" />
                                </div>
                                <div className="text-sm">
                                    <div className="font-semibold text-slate-800">Coordinator</div>
                                    <div className="text-xs text-slate-500">Timetable Office</div>
                                </div>
                            </div>
                        </div>
                    </header>

                    <main className="p-6">
                        <Outlet />
                    </main>
                </div>
            </div>
        </div>
    );
}

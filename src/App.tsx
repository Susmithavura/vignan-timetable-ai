import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { TimetablePage } from './pages/TimetablePage';
import { FacultyPage } from './pages/FacultyPage';
import { FacultyProfilePage } from './pages/FacultyProfilePage';
import { CoursesPage } from './pages/CoursesPage';
import { SectionsPage } from './pages/SectionsPage';
import { InfrastructurePage } from './pages/InfrastructurePage';
import { LabBatchesPage } from './pages/LabBatchesPage';
import { ConstraintsPage } from './pages/ConstraintsPage';
import { GenerateTimetablePage } from './pages/GenerateTimetablePage';
import { ClashDetectionPage } from './pages/ClashDetectionPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { ChangeRequestsPage } from './pages/ChangeRequestsPage';
import { CollegeDataPage } from './pages/CollegeDataPage';
import { AssistantPage } from './pages/AssistantPage';
import { SettingsPage } from './pages/SettingsPage';
import { TimetableInputPage } from './pages/TimetableInputPage';

export default function App() {
    return (
        <Routes>
            <Route element={<Layout />}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/timetable" element={<TimetablePage />} />
                <Route path="/faculty" element={<FacultyPage />} />
                <Route path="/faculty/:facultyId" element={<FacultyProfilePage />} />
                <Route path="/courses" element={<CoursesPage />} />
                <Route path="/sections" element={<SectionsPage />} />
                <Route path="/infrastructure" element={<InfrastructurePage />} />
                <Route path="/lab-batches" element={<LabBatchesPage />} />
                <Route path="/constraints" element={<ConstraintsPage />} />
                <Route path="/generate" element={<GenerateTimetablePage />} />
                <Route path="/timetable-input" element={<TimetableInputPage />} />
                <Route path="/clashes" element={<ClashDetectionPage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/change-requests" element={<ChangeRequestsPage />} />
                <Route path="/college-data" element={<CollegeDataPage />} />
                <Route path="/assistant" element={<AssistantPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
        </Routes>
    );
}

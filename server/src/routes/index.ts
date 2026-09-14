import { Router } from 'express';
import { askAssistant } from '../controllers/assistantController.js';
import { createBlock } from '../controllers/blockController.js';
import { createCourse, getCourses } from '../controllers/courseController.js';
import { createDepartment, getDepartments } from '../controllers/departmentController.js';
import { createFaculty, getFaculty } from '../controllers/facultyController.js';
import { createLaboratory } from '../controllers/laboratoryController.js';
import { approveChangeRequest, applyChangeRequest, createChangeRequest, getAnalytics, getAvailability, getBlocks, getChangeRequestById, getChangeRequests, getConflicts, getHealth, getLaboratories, getLabBatches, getRooms, getTimetable, handleFacultyAbsence, handleLaboratoryUnavailable, handleRoomUnavailable, rejectChangeRequest } from '../controllers/metadataController.js';
import { generateTimetable } from '../controllers/generationController.js';
import { createRoom } from '../controllers/roomController.js';
import { createSection, getSections } from '../controllers/sectionController.js';
import { activateCollegeDataset, getActiveCollegeDataset, getCollegeDatasets, importCollegeData, saveCollegeDataset } from '../controllers/importController.js';
import { generateTimetableDataset, saveTimetableDataset } from '../controllers/timetableInputController.js';

const router = Router();

router.get('/api/health', getHealth);

router.get('/api/departments', getDepartments);
router.post('/api/departments', createDepartment);

router.get('/api/sections', getSections);
router.post('/api/sections', createSection);

router.get('/api/faculty', getFaculty);
router.post('/api/faculty', createFaculty);

router.get('/api/courses', getCourses);
router.post('/api/courses', createCourse);

router.get('/api/blocks', getBlocks);
router.post('/api/blocks', createBlock);

router.get('/api/rooms', getRooms);
router.post('/api/rooms', createRoom);

router.get('/api/laboratories', getLaboratories);
router.post('/api/laboratories', createLaboratory);

router.get('/api/availability', getAvailability);
router.get('/api/lab-batches', getLabBatches);
router.get('/api/timetable', getTimetable);
router.get('/api/conflicts', getConflicts);
router.get('/api/analytics', getAnalytics);
router.post('/api/timetable/generate', generateTimetable);
router.get('/api/change-requests', getChangeRequests);
router.get('/api/change-requests/:id', getChangeRequestById);
router.post('/api/change-requests', createChangeRequest);
router.patch('/api/change-requests/:id/approve', approveChangeRequest);
router.patch('/api/change-requests/:id/reject', rejectChangeRequest);
router.post('/api/change-requests/:id/apply', applyChangeRequest);
router.post('/api/timetable/faculty-absence', handleFacultyAbsence);
router.post('/api/timetable/room-unavailable', handleRoomUnavailable);
router.post('/api/timetable/laboratory-unavailable', handleLaboratoryUnavailable);
router.post('/api/assistant', askAssistant);
router.post('/api/college-data/import', importCollegeData);
router.post('/api/college-data/save', saveCollegeDataset);
router.post('/api/college-data/:id/activate', activateCollegeDataset);
router.get('/api/college-data/active', getActiveCollegeDataset);
router.get('/api/college-data', getCollegeDatasets);
router.post('/api/timetable-input', saveTimetableDataset);
router.post('/api/timetable-input/:id/generate', generateTimetableDataset);

export default router;

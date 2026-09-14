import type { ConstraintRule } from './types';
import { changeRequests as sampleChangeRequests } from './sampleCollegeData';

export const constraints: ConstraintRule[] = [
    { id: 'hard-1', title: 'Faculty cannot teach two classes simultaneously', description: 'Each faculty must have a single assignment for any time slot.', priority: 'Hard', enabled: true },
    { id: 'hard-2', title: 'Room cannot host two sections simultaneously', description: 'Classrooms and labs must remain single occupancy per slot.', priority: 'Hard', enabled: true },
    { id: 'hard-3', title: 'Laboratory capacity must fit batch size', description: 'A 30-student batch can only be assigned to labs with capacity >= 30.', priority: 'Hard', enabled: true },
    { id: 'hard-4', title: 'Required course contact hours must be satisfied', description: 'Every theory and lab course should meet weekly contact hour targets.', priority: 'Hard', enabled: true },
    { id: 'hard-5', title: 'Required equipment must be available', description: 'Specialised labs require approved equipment, projectors, and support systems.', priority: 'Hard', enabled: true },
    { id: 'soft-1', title: 'Distribute courses throughout the week', description: 'Avoid clustering all courses into a single day.', priority: 'Soft', enabled: true },
    { id: 'soft-2', title: 'Avoid first/last period for laboratories', description: 'Labs should ideally run in mid-day windows.', priority: 'Soft', enabled: true },
    { id: 'soft-3', title: 'Respect faculty preferred slots', description: 'Prefer faculty availability and preferred periods when scheduling.', priority: 'Soft', enabled: true },
    { id: 'soft-4', title: 'Minimise faculty idle gaps', description: 'Reduce dead time between teaching blocks.', priority: 'Soft', enabled: true },
    { id: 'soft-5', title: 'Minimise student idle gaps', description: 'Prevent long student downtime between theory and labs.', priority: 'Soft', enabled: true },
    { id: 'soft-6', title: 'Avoid more than three consecutive theory periods', description: 'Maintain balanced academic flow for students.', priority: 'Soft', enabled: true },
];

export const changeRequests = sampleChangeRequests;

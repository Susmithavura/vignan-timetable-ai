export type DepartmentName = 'CSE' | 'ECE' | 'EEE' | 'ME';
export type StudentYear = '1st Year' | '2nd Year' | '3rd Year' | '4th Year';
export type RoomType = 'Classroom' | 'Laboratory' | 'Faculty Room' | 'Administrative Space' | 'Staff Space';
export type LabType = 'Physics' | 'Chemistry' | 'Computer' | 'Electronics' | 'Electrical' | 'Mechanical';
export type DayName = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';
export type PeriodName = 'P1' | 'P2' | 'P3' | 'P4' | 'P5' | 'P6';
export type SessionType = 'Theory' | 'Laboratory' | 'Elective' | 'Library';

export interface Department {
    id: DepartmentName;
    name: string;
    code: string;
}

export interface Block {
    id: string;
    name: string;
    description: string;
}

export interface Faculty {
    id: string;
    name: string;
    department: DepartmentName;
    designation: string;
    courses: string[];
    weeklyLoad: number;
    availability: Record<DayName, { available: string[]; unavailable: string[]; preferred: string[] }>;
    status: 'Available' | 'On Leave' | 'Busy';
}

export interface Course {
    code: string;
    name: string;
    department: DepartmentName;
    year: StudentYear;
    type: 'Theory' | 'Laboratory' | 'Elective';
    requiredPeriodsPerWeek: number;
    roomRequirement: 'Classroom' | 'Computer Lab' | 'Electronics Lab' | 'Physics Lab' | 'Chemistry Lab' | 'Electrical Lab' | 'Mechanical Lab';
    facultyId: string;
}

export interface Section {
    id: string;
    department: DepartmentName;
    year: StudentYear;
    studentStrength: number;
    block: string;
    advisor: string;
}

export interface Room {
    id: string;
    roomNumber: string;
    block: string;
    capacity: number;
    type: RoomType;
    equipment: string[];
    currentUtilization: number;
}

export interface Laboratory {
    id: string;
    name: string;
    block: string;
    capacity: number;
    equipment: string[];
    type: LabType;
    currentAllocation: number;
}

export interface LabBatch {
    id: string;
    sectionId: string;
    courseCode: string;
    batchName: string;
    studentCount: number;
    labId: string;
    facultyId: string;
}

export interface TimetableEntry {
    id: string;
    day: DayName;
    period: PeriodName;
    type: SessionType;
    sectionId?: string;
    facultyId?: string;
    courseCode?: string;
    roomId?: string;
    labId?: string;
    details?: string;
    label?: string;
}

export interface ConstraintRule {
    id: string;
    title: string;
    description: string;
    priority: 'Hard' | 'Soft';
    enabled: boolean;
}

export interface ChangeRequest {
    id: string;
    facultyName: string;
    course: string;
    section: string;
    day: DayName;
    period: PeriodName;
    suggestedSubstitute: string;
    status: 'Pending' | 'Approved' | 'Rejected';
}

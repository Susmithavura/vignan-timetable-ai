import { blocks as seedBlocks } from './blocks';
import { laboratories as seedLaboratories } from './laboratories';
import { rooms as seedRooms } from './rooms';

export type RoomSummary = {
    id: string;
    roomNumber: string;
    block: string;
    floor: string;
    roomType: 'Teaching Room' | 'Faculty Room' | 'Administrative Space' | 'Staff Space';
    capacity: number;
    department: string;
    status: 'active' | 'inactive';
    type: 'Classroom' | 'Faculty Room' | 'Administrative Space' | 'Staff Space';
    currentSectionStrength: number;
    equipment: string[];
};

export type InfrastructureBlockSummary = {
    id: string;
    name: string;
    teachingRooms: number;
    laboratories: number;
    floors: string[];
};

export const rooms = seedRooms.map((room) => ({
    id: room.id,
    roomNumber: room.roomNumber,
    block: room.block,
    floor: 'Ground Floor',
    roomType: room.type === 'Classroom' ? 'Teaching Room' : room.type,
    capacity: room.capacity,
    department: 'CSE',
    status: 'active',
    type: room.type,
    currentSectionStrength: room.currentUtilization,
    equipment: room.equipment,
}));

export const teachingRooms = rooms.filter((room) => room.type === 'Classroom');

export const laboratories = seedLaboratories.map((lab) => ({
    id: lab.id,
    name: lab.name,
    labCode: lab.id,
    block: lab.block,
    floor: 'Ground Floor',
    capacity: lab.capacity,
    equipment: lab.equipment,
    department: 'CSE',
    type: lab.type,
    assignedSections: [],
    labBatches: [],
    currentAllocation: lab.currentAllocation,
    status: 'Ready',
    batchCapacity: lab.capacity,
}));

export const blocks = seedBlocks.map((block) => ({
    id: block.id,
    name: block.name,
    floorLabels: ['Ground Floor', 'First Floor', 'Second Floor', 'Third Floor'],
}));

export const blockSummaries: InfrastructureBlockSummary[] = blocks.map((block) => {
    const blockRooms = teachingRooms.filter((room) => room.block === block.name);
    const blockLabs = laboratories.filter((lab) => lab.block === block.name);
    return {
        id: block.id,
        name: block.name,
        teachingRooms: blockRooms.length,
        laboratories: blockLabs.length,
        floors: Array.from(new Set([...blockRooms.map((room) => room.floor), ...blockLabs.map((lab) => lab.floor)])),
    };
});

export const totalTeachingRooms = teachingRooms.length;
export const totalLaboratories = laboratories.length;

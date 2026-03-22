import { Gender } from "../../../generated/prisma";
export interface ICreateStudentPayload {
    password: string;
    student: {
        name: string;
        email: string;
        profilePhoto?: string;
        contactNumber?: string;
        address?: string;
        gender: Gender;
    }
    specialties: string[];
}
export interface ICreateAdminPayload {
    password: string;
    admin: {
        name: string;
        email: string;
        profilePhoto?: string;
        contactNumber?: string;
    }
    role: "ADMIN";
}
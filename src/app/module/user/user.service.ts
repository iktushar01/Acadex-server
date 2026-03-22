/* eslint-disable @typescript-eslint/no-explicit-any */
// import status from "http-status";
// import { Role, Specialty } from "../../../generated/prisma/client";
import { StatusCodes } from "http-status-codes";
import { Role } from "../../../generated/prisma";
import AppError from "../../errorHelpers/AppError";
import { auth } from "../../lib/auth";
import { prisma } from "../../lib/prisma";

import { ICreateAdminPayload, ICreateStudentPayload } from "./user.interface";

const createStudent = async (payload: ICreateStudentPayload) => {


    const userExists = await prisma.user.findUnique({
        where: {
            email: payload.student.email
        }
    })

    if (userExists) {
        // throw new Error("User with this email already exists");
        throw new AppError(StatusCodes.CONFLICT, "User with this email already exists");
    }

    const userData = await auth.api.signUpEmail({
        body: {
            email: payload.student.email,
            password: payload.password,
            role: Role.STUDENT,
            name: payload.student.name,
            needPasswordChange: true,
        }
    })


    try {
        const result = await prisma.$transaction(async (tx) => {
            const studentData = await tx.student.create({
                data: {
                    userId: userData.user.id,
                    ...payload.student,
                }
            })

            


            const student = await tx.student.findUnique({
                where: {
                    id: studentData.id
                },
                select: {
                    id: true,
                    userId: true,
                    name: true,
                    email: true,
                    profilePhoto: true,
                    contactNumber: true,
                    address: true,
                    gender: true,
                    createdAt: true,
                    updatedAt: true,
                    user: {
                        select: {
                            id: true,
                            email: true,
                            name: true,
                            role: true,
                            status: true,
                            emailVerified: true,
                            image: true,
                            isDeleted: true,
                            deletedAt: true,
                            createdAt: true,
                            updatedAt: true,
                        }
                    },
                    
                }
            })

            return student;

        })

        return result;
    } catch (error) {
        console.log("Transaction error : ", error);
        await prisma.user.delete({
            where: {
                id: userData.user.id
            }
        })
        throw error;
    }
}

const createAdmin = async (payload: ICreateAdminPayload) => {
    //TODO: Validate who is creating the admin user. Only super admin can create admin user and only super admin can create super admin user but admin user cannot create super admin user

    const userExists = await prisma.user.findUnique({
        where: {
            email: payload.admin.email
        }
    })

    if (userExists) {
        throw new AppError(StatusCodes.CONFLICT, "User with this email already exists");
    }

    const { admin, role, password } = payload;



    const userData = await auth.api.signUpEmail({
        body: {
            ...admin,
            password,
            role,
            needPasswordChange: true,
        }
    })

    try {
        const adminData = await prisma.admin.create({
            data: {
                userId: userData.user.id,
                ...admin,
            }
        })

        return adminData;


    } catch (error: any) {
        console.log("Error creating admin: ", error);
        await prisma.user.delete({
            where: {
                id: userData.user.id
            }
        })
        throw error;
    }


}

export const UserService = {
    createStudent,
    createAdmin,
}
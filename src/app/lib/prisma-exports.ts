import prismaPkg from "../../generated/prisma/index";

const prismaModule = prismaPkg as typeof import("../../generated/prisma/index");

export const PrismaClient = prismaModule.PrismaClient;
export const Prisma = prismaModule.Prisma;

export const Role = prismaModule.Role;
export type Role = (typeof Role)[keyof typeof Role];

export const UserStatus = prismaModule.UserStatus;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const Gender = prismaModule.Gender;
export type Gender = (typeof Gender)[keyof typeof Gender];

export const ClassroomStatus = prismaModule.ClassroomStatus;
export type ClassroomStatus =
  (typeof ClassroomStatus)[keyof typeof ClassroomStatus];

export const MembershipRole = prismaModule.MembershipRole;
export type MembershipRole =
  (typeof MembershipRole)[keyof typeof MembershipRole];

export const NoteStatus = prismaModule.NoteStatus;
export type NoteStatus = (typeof NoteStatus)[keyof typeof NoteStatus];

export const InstitutionLevel = prismaModule.InstitutionLevel;
export type InstitutionLevel =
  (typeof InstitutionLevel)[keyof typeof InstitutionLevel];

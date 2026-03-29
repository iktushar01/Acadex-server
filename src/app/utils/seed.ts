import { Role } from "../../generated/prisma";
import { auth } from "../lib/auth";
import { prisma } from "../lib/prisma";
import { envVars } from "../../config/env";

export const seedSuperAdmin = async () => {
    try {
        if (!envVars.SUPER_ADMIN_EMAIL || !envVars.SUPER_ADMIN_PASSWORD) {
            console.warn("SUPER_ADMIN_EMAIL or SUPER_ADMIN_PASSWORD not set. Skipping seeding.");
            return;
        }

        const trimmedEmail = envVars.SUPER_ADMIN_EMAIL.trim();

        const isSuperAdminExist = await prisma.user.findFirst({
            where: {
                role: Role.SUPER_ADMIN
            }
        });

        if (isSuperAdminExist) {
            console.log("Super admin already exists. Skipping seeding super admin.");
            return;
        }

        console.log(`Seeding super admin with email: ${trimmedEmail}`);

        const superAdminUser = await auth.api.signUpEmail({
            body: {
                email: trimmedEmail,
                password: envVars.SUPER_ADMIN_PASSWORD,
                name: "Super Admin",
                role: Role.SUPER_ADMIN,
                needPasswordChange: false,
                rememberMe: false,
            }
        });

        if (!superAdminUser || !superAdminUser.user) {
            throw new Error("Failed to create super admin user through auth API");
        }

        await prisma.$transaction(async (tx) => {
            await tx.user.update({
                where: {
                    id: superAdminUser.user.id
                },
                data: {
                    emailVerified: true,
                }
            });

            await tx.admin.create({
                data: {
                    userId: superAdminUser.user.id,
                    name: "Super Admin",
                    email: trimmedEmail,
                }
            });
        });

        const superAdmin = await prisma.admin.findFirst({
            where: {
                email: trimmedEmail,
            },
            include: {
                user: true,
            }
        });

        console.log("Super Admin Created successfully.");
    } catch (error) {
        console.error("Error seeding super admin: ", error);
        
        try {
            // Use deleteMany to avoid "Record not found" error if the user was never created
            if (envVars.SUPER_ADMIN_EMAIL) {
                await prisma.user.deleteMany({
                    where: {
                        email: envVars.SUPER_ADMIN_EMAIL.trim(),
                    }
                });
            }
        } catch (cleanupError) {
            console.error("Failed to clean up super admin seed state:", cleanupError);
        }
    }
}

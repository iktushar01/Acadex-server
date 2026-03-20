import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma";
import { Role, UserStatus } from "../../generated/prisma";
import { envVars } from "../../config/env";
import ms, { StringValue } from "ms";
import { bearer, emailOTP } from "better-auth/plugins";
import { sendEmail } from "../utils/email";

export const auth = betterAuth({
    baseURL : envVars.BETTER_AUTH_URL,
    secret : envVars.BETTER_AUTH_SECRET,
    database: prismaAdapter(prisma, {
        provider: "postgresql", // or "mysql", "postgresql", ...etc
    }),
    emailAndPassword: {
        enabled: true,
        requireEmailVerification: true,
    },
    socialProviders: {
        google: {
            clientId: envVars.GOOGLE_CLIENT_ID,
            clientSecret: envVars.GOOGLE_CLIENT_SECRET,
            mapProfileToUser: (profile: any) => {
                return {
                    role: Role.STUDENT,
                    needPasswordChange: false,
                    emailVerified: true,
                    isDeleted: false,
                    deletedAt: null,
                    status: UserStatus.ACTIVE,
                    lastLogin: new Date(),
                    lastIpAddress: "",
                    lastUserAgent: "",
                    failedLoginAttempts: 0,
                    lockedUntil: null,
                }
            }
        }
        
    },


    
    emailVerification:{
        sendOnSignUp: true,
        sendOnSignIn: true,
        autoSignInAfterVerification: true,
    },
    user: {
        additionalFields: {
            role: { type: "string", required: true, defaultValue: Role.STUDENT },
            status: { type: "string", required: true, defaultValue: UserStatus.ACTIVE },
            needPasswordChange: { type: "boolean", required: true, defaultValue: true },
            isDeleted: { type: "boolean", required: true, defaultValue: false },
            deletedAt: { type: "date", required: false, defaultValue: null },
            lastLogin: { type: "date", required: false, defaultValue: null },
            lastIpAddress: { type: "string", required: false, defaultValue: null },
            lastUserAgent: { type: "string", required: false, defaultValue: null },
            failedLoginAttempts: { type: "number", required: true, defaultValue: 0 },
            lockedUntil: { type: "date", required: false, defaultValue: null },
        }
    },

   plugins: [
        bearer(),
        emailOTP({
            overrideDefaultEmailVerification: true,
            async sendVerificationOTP({email, otp, type}) {
                if(type === "email-verification"){
                  const user = await prisma.user.findUnique({
                    where : {
                        email,
                    }
                  })

                   if(!user){
                    console.error(`User with email ${email} not found. Cannot send verification OTP.`);
                    return;
                   }

                   if(user && user.role === Role.ADMIN){
                    console.log(`User with email ${email} is a admin. Skipping sending verification OTP.`);
                    return;
                   }
                  
                    if (user && !user.emailVerified){
                    sendEmail({
                        to : email,
                        subject : "Verify your email",
                        templateName : "otp",
                        templateData :{
                            name : user.name,
                            otp,
                        }
                    })
                  }
                }else if(type === "forget-password"){
                    const user = await prisma.user.findUnique({
                        where : {
                            email,
                        }
                    })

                    if(user){
                        sendEmail({
                            to : email,
                            subject : "Password Reset OTP",
                            templateName : "otp",
                            templateData :{
                                name : user.name,
                                otp,
                            }
                        })
                    }
                }
            },
            expiresIn : ms(envVars.EXPIRE_OTP_TIME as StringValue) / 1000,
            otpLength : 6,
        })
    ],


    session: {
        expiresIn: ms(envVars.BETTER_AUTH_SESSION_TOKEN_EXPIRES_IN as StringValue) / 1000,
        updateAge: ms(envVars.BETTER_AUTH_SESSION_TOKEN_UPDATE_AGE as StringValue) / 1000,
        cookieCache: {
            enabled: true,
            maxAge: ms(envVars.BETTER_AUTH_SESSION_TOKEN_EXPIRES_IN as StringValue) / 1000,
            cookieOptions: {
                httpOnly: true,
                secure: true,
                sameSite: "none",
                path: "/",
            }
        }
    },


    redirectURLs:{
        signIn : `${envVars.BETTER_AUTH_URL}/api/v1/auth/google/success`,
    },

    trustedOrigins: [process.env.BETTER_AUTH_URL || "http://localhost:5000", envVars.FRONTEND_URL],

    advanced: {
        // disableCSRFCheck: true,
        useSecureCookies : false,
        cookies:{
            state:{
                attributes:{
                    sameSite: "none",
                    secure: true,
                    httpOnly: true,
                    path: "/",
                }
            },
            sessionToken:{
                attributes:{
                    sameSite: "none",
                    secure: true,
                    httpOnly: true,
                    path: "/",
                }
            }
        }
    }

});
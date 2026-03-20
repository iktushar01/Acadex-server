import nodemailer from "nodemailer";
import { envVars } from "../../config/env";
import AppError from "../errorHelpers/AppError";
import { StatusCodes } from "http-status-codes";
import path from "node:path";
import ejs from "ejs";


export const transporter = nodemailer.createTransport({
    host: envVars.EMAIL_HOST,
    port: envVars.EMAIL_PORT,
    secure: envVars.EMAIL_SECURE,
    auth: {
        user: envVars.EMAIL_USER,
        pass: envVars.EMAIL_PASSWORD,
    },
});


interface EmailOptions {
    to: string;
    subject: string;
    templateName: string;
    templateData: Record<string, any>;
    attachments?: {
        filename: string;
        content: string | Buffer;
        contentType: string;
    }[];
}
    
export const sendEmail = async ({subject, to, templateName, templateData, attachments}: EmailOptions) => {
    try {
        const templatePath = path.resolve(process.cwd(), `src/app/templates/${templateName}.ejs`);
        const html = await ejs.renderFile(templatePath, templateData);
        const info = await transporter.sendMail({
            from: `"DocScheduleBD" <${envVars.EMAIL_USER}>`,
            to: to,
            subject: subject,
            html : html,
            attachments: attachments?.map((attachment) => ({
                filename: attachment.filename,
                content: attachment.content,
                contentType: attachment.contentType,
            })),
        });
        console.log(`Email sending successfully to ${to} with subject ${subject} message id ${info.messageId} and response ${info.response}`);
        return info;
    } catch (error : any) {
        console.log('Email sending failed', error.message);
        throw new AppError(StatusCodes.INTERNAL_SERVER_ERROR, error.message);
    }
}
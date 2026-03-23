import dotenv from "dotenv";
dotenv.config();

export const imgbbConfig = {
    apiKey: process.env.IMGBB_API_KEY || "",
    endpoint: "https://api.imgbb.com/1/upload",
};
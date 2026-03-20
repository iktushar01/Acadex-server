import app from "./app";
import dotenv from "dotenv";
import { envVars } from "../config/env";

dotenv.config();

const bootstrap = async () => {
  try {
    const port = envVars.PORT || 5000;

    await app.listen(port);
    console.log(`✅ Server running on ${envVars.NODE_ENV} mode at http://localhost:${port}`);
  } catch (error: any) {
    if (error.code === "EADDRINUSE") {
      console.error(`❌ Port ${envVars.PORT} is already in use. Please free it or change PORT in .env`);
    } else {
      console.error("❌ Failed to start server:", error);
    }
  }
};

bootstrap();
import app from "./app";
import { envVars } from "./config/env";
import { seedSuperAdmin } from "./app/utils/seed";

// Load .env only in development
if (process.env.NODE_ENV !== "production") {
  import('dotenv/config');
}

const bootstrap = async () => {
  try {
    // Use process.env.PORT set by Railway, fallback to envVars or 5000
    const port = process.env.PORT || envVars.PORT || 5000;

    await app.listen(port);
    console.log(
      `✅ Server running on ${process.env.NODE_ENV || envVars.NODE_ENV} mode at http://localhost:${port}`
    );

    // Seed super admin (errors won't break server)
    seedSuperAdmin().catch((error) => {
      console.error(
        "Super admin seed skipped due to startup error:",
        error
      );
    });
  } catch (error: any) {
    if (error.code === "EADDRINUSE") {
      console.error(
        `❌ Port ${process.env.PORT || envVars.PORT} is already in use.`
      );
    } else {
      console.error("❌ Failed to start server:", error);
    }
  }
};

bootstrap();
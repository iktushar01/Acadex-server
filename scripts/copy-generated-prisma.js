import fs from "fs";
import path from "path";

const sourceDir = path.join("src", "generated", "prisma");
const targetDir = path.join("dist", "generated", "prisma");

if (!fs.existsSync(sourceDir)) {
  throw new Error(`Generated Prisma client not found at ${sourceDir}`);
}

fs.rmSync(targetDir, { recursive: true, force: true });
fs.mkdirSync(path.dirname(targetDir), { recursive: true });
fs.cpSync(sourceDir, targetDir, { recursive: true });

console.log(`Copied Prisma client to ${targetDir}`);

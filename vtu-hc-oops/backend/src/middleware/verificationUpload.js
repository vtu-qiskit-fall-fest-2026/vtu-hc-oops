import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

// Resolve storage relative to this file, not process.cwd(), so uploads work
// whether the server is started from the backend folder or repository root.
const middlewareDirectory = path.dirname(fileURLToPath(import.meta.url));
const privateDirectory = path.resolve(middlewareDirectory, "../../private_uploads/verification");
fs.mkdirSync(privateDirectory, { recursive: true });
const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, privateDirectory),
  filename: (_req, file, callback) => callback(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`)
});
const allowed = new Set(["application/pdf", "image/jpeg", "image/png"]);
export const verificationUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 2 },
  fileFilter: (_req, file, callback) => {
    if (!allowed.has(file.mimetype)) return callback(new Error("Upload PDF, JPG or PNG documents only."));
    callback(null, true);
  }
});
export { privateDirectory };

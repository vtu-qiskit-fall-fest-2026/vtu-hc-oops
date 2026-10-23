import crypto from "node:crypto";
import mongoose from "mongoose";

let memoryServer = null;

const isPlaceholder = (uri) => !uri || /your_mongodb|<.*>|changeme/i.test(uri);

/**
 * Connects to MONGODB_URI. With no real URI (fresh clone, judges' laptops) it starts a
 * throwaway in-memory MongoDB and loads demo accounts, so `npm run dev` just works.
 * Data in that mode is lost when the server stops. Never used in production.
 */
export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!isPlaceholder(uri)) {
    await mongoose.connect(uri);
    console.log("MongoDB connected");
    return;
  }
  if (process.env.NODE_ENV === "production") throw new Error("MONGODB_URI is missing. Add it to backend/.env");

  const { MongoMemoryServer } = await import("mongodb-memory-server");
  memoryServer = await MongoMemoryServer.create();
  await mongoose.connect(memoryServer.getUri("loadsetu"));
  if (!process.env.JWT_SECRET || /replace_with/.test(process.env.JWT_SECRET)) {
    process.env.JWT_SECRET = crypto.randomBytes(32).toString("hex");
  }
  console.log("No MONGODB_URI set: using a temporary in-memory database (demo mode).");
  const { seedDemoData } = await import("../seed/demoData.js");
  await seedDemoData();
}

export async function disconnectDB() {
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
}

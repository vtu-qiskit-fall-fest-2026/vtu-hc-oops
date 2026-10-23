// npm run seed: load the demo accounts and freight into the database in MONGODB_URI.
import "dotenv/config";
import mongoose from "mongoose";
import { seedDemoData } from "./demoData.js";

if (!process.env.MONGODB_URI) {
  console.error("Set MONGODB_URI in backend/.env first. (Without it, `npm run dev` seeds an in-memory database automatically.)");
  process.exit(1);
}
// Demo accounts share a published password and come pre-subscribed: never on a live database.
if (process.env.NODE_ENV === "production") {
  console.error("Refusing to seed demo accounts with NODE_ENV=production.");
  process.exit(1);
}
await mongoose.connect(process.env.MONGODB_URI);
await seedDemoData();
await mongoose.disconnect();

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema.js";
import { config } from "../config.js"; // التغيير هنا

const conn = postgres(config.db.url); // والتغيير 
export const db = drizzle(conn, { schema });

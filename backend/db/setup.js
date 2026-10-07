/**
 * Database bootstrap.
 *   npm run db:setup   create database + tables (safe to re-run)
 *   npm run db:seed    create tables, then (re)load the seed data
 *   npm run db:reset   DROP the database, recreate it, and seed (destructive)
 */
import "../config/env.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mysql from "mysql2/promise";
import { seed } from "./seed.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const reset = args.includes("--reset");
const doSeed = args.includes("--seed");
const dbName = process.env.DB_NAME;

if (!/^[A-Za-z0-9_]+$/.test(dbName)) {
    console.error("DB_NAME may only contain letters, numbers and underscores.");
    process.exit(1);
}

const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    multipleStatements: true,
    timezone: "Z",
}).catch((e) => {
    console.error(`\nCould not connect to MySQL: ${e.message}`);
    console.error("Start MySQL and check DB_HOST / DB_USER / DB_PASSWORD in backend/.env\n");
    process.exit(1);
});

await conn.query("SET time_zone = '+00:00'");

if (reset) {
    console.log(`Dropping database ${dbName}...`);
    await conn.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
}
await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
await conn.query(`USE \`${dbName}\``);

// Your original project had no schema file. If an old food_items table from that
// version is present it lacks the new columns, so stop with clear instructions.
const [old] = await conn.query(
    `SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_schema = ? AND table_name = 'food_items'`, [dbName]);
if (old[0].c) {
    const [col] = await conn.query(
        `SELECT COUNT(*) AS c FROM information_schema.columns WHERE table_schema = ? AND table_name = 'food_items' AND column_name = 'category'`, [dbName]);
    if (!col[0].c) {
        console.error("\nAn older food_items table (from the first version of FoodLink) exists in this database.");
        console.error("Run:  npm run db:reset   (this drops and recreates the database, then seeds it)\n");
        process.exit(1);
    }
}

await conn.query(fs.readFileSync(path.join(here, "schema.sql"), "utf8"));
console.log("Tables ready.");

// Idempotent upgrade for databases created before the NGO food-request feature
// (safe to run when the columns already exist, e.g. if you added them by hand).
async function hasColumn(table, column) {
    const [r] = await conn.query(
        `SELECT COUNT(*) AS c FROM information_schema.columns WHERE table_schema = ? AND table_name = ? AND column_name = ?`,
        [dbName, table, column]);
    return r[0].c > 0;
}
if (!(await hasColumn("food_items", "remaining_quantity"))) {
    await conn.query("ALTER TABLE food_items ADD COLUMN remaining_quantity DECIMAL(8,2) NULL AFTER quantity");
    console.log("Migrated: food_items.remaining_quantity");
}
await conn.query("UPDATE food_items SET remaining_quantity = quantity WHERE remaining_quantity IS NULL");
if (!(await hasColumn("donations", "request_id"))) {
    await conn.query("ALTER TABLE donations ADD COLUMN request_id INT NULL");
    await conn.query("ALTER TABLE donations ADD CONSTRAINT fk_don_request FOREIGN KEY (request_id) REFERENCES food_requests(id) ON DELETE SET NULL");
    console.log("Migrated: donations.request_id");
}
if (!(await hasColumn("donations", "quantity_delivered"))) {
    await conn.query("ALTER TABLE donations ADD COLUMN quantity_delivered DECIMAL(8,2) NULL");
    console.log("Migrated: donations.quantity_delivered");
}
if (!(await hasColumn("donations", "unit_delivered"))) {
    await conn.query("ALTER TABLE donations ADD COLUMN unit_delivered ENUM('kg','litres','packs','plates') NULL");
    console.log("Migrated: donations.unit_delivered");
}


if (doSeed) await seed(conn);

await conn.end();
console.log("Done.");

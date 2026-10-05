import mysql from "mysql2/promise";
import "./env.js";

const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    // All DATETIME values are stored and read as UTC, so expiry maths is
    // identical on every machine regardless of its local time zone.
    timezone: "Z",
});

db.pool.on("connection", (conn) => conn.query("SET time_zone = '+00:00'"));

export default db;

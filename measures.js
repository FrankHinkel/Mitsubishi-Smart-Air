"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const ROOT = __dirname;
const MEASURES_DIR = process.env.MEASURES_DIR || path.join(ROOT, "measures");
const MAX_BUFFER = 8 * 1024 * 1024;
const BUCKET_MINUTES = 10;

function ensureMeasuresDir() {
  fs.mkdirSync(MEASURES_DIR, { recursive: true });
}

function runSql(dbPath, sql) {
  ensureMeasuresDir();
  execFileSync("sqlite3", [dbPath], {
    input: `${sql}\n`,
    encoding: "utf8",
    maxBuffer: MAX_BUFFER,
  });
}

function sqlText(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlValue(value) {
  if (value === null || value === undefined) {
    return "NULL";
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "NULL";
  }
  if (typeof value === "boolean") {
    return value ? "1" : "0";
  }
  return sqlText(value);
}

function bucketDate(date = new Date()) {
  const next = new Date(date);
  next.setUTCSeconds(0, 0);
  next.setUTCMinutes(next.getUTCMinutes() - (next.getUTCMinutes() % BUCKET_MINUTES));
  return next;
}

function bucketIso(date = new Date()) {
  return bucketDate(date).toISOString();
}

function measuresDbPath(date = new Date()) {
  const monthKey = bucketDate(date).toISOString().slice(0, 7);
  return path.join(MEASURES_DIR, `measures_${monthKey}.sqlite`);
}

function ensureMeasuresSchema(dbPath) {
  runSql(dbPath, `
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS measurements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recorded_at TEXT NOT NULL,
      bucket_at TEXT NOT NULL,
      device_name TEXT NOT NULL,
      temperature_kind TEXT NOT NULL,
      temperature REAL NOT NULL,
      device_setting TEXT NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_measurements_bucket_device_kind
      ON measurements(bucket_at, device_name, temperature_kind);

    CREATE INDEX IF NOT EXISTS idx_measurements_recorded_at
      ON measurements(recorded_at);
  `);
}

function statusPayload(status = {}) {
  return JSON.stringify({
    operation: Boolean(status.operation),
    operationMode: Number.isFinite(Number(status.operationMode)) ? Number(status.operationMode) : null,
    presetTemp: Number.isFinite(Number(status.presetTemp)) ? Number(status.presetTemp) : null,
    airFlow: Number.isFinite(Number(status.airFlow)) ? Number(status.airFlow) : null,
    windDirectionUD: Number.isFinite(Number(status.windDirectionUD)) ? Number(status.windDirectionUD) : null,
    windDirectionLR: Number.isFinite(Number(status.windDirectionLR)) ? Number(status.windDirectionLR) : null,
    errorCode: String(status.errorCode || "00"),
  });
}

function measurementRows(device) {
  const status = device && device.status ? device.status : null;
  if (!status) {
    return [];
  }

  const deviceName = String(device.name || `WF-RAC ${device.ipAddress || "unknown"}`).trim();
  const rows = [];
  if (Number.isFinite(status.indoorTemp)) {
    rows.push({
      deviceName,
      deviceSetting: statusPayload(status),
      temperature: Number(status.indoorTemp),
      temperatureKind: "indoor",
    });
  }
  if (Number.isFinite(status.outdoorTemp)) {
    rows.push({
      deviceName,
      deviceSetting: statusPayload(status),
      temperature: Number(status.outdoorTemp),
      temperatureKind: "outdoor",
    });
  }
  return rows;
}

function recordDeviceMeasurements(device, recordedAt = new Date()) {
  const rows = measurementRows(device);
  if (!rows.length) {
    return 0;
  }

  const recordedAtIso = new Date(recordedAt).toISOString();
  const bucketAt = bucketIso(recordedAt);
  const dbPath = measuresDbPath(recordedAt);
  ensureMeasuresSchema(dbPath);

  const statements = ["BEGIN;"];
  for (const row of rows) {
    statements.push(`
      INSERT INTO measurements (
        recorded_at, bucket_at, device_name, temperature_kind, temperature, device_setting
      ) VALUES (
        ${sqlText(recordedAtIso)},
        ${sqlText(bucketAt)},
        ${sqlText(row.deviceName)},
        ${sqlText(row.temperatureKind)},
        ${sqlValue(row.temperature)},
        ${sqlText(row.deviceSetting)}
      )
      ON CONFLICT(bucket_at, device_name, temperature_kind) DO UPDATE SET
        recorded_at = excluded.recorded_at,
        temperature = excluded.temperature,
        device_setting = excluded.device_setting;
    `);
  }
  statements.push("COMMIT;");
  runSql(dbPath, statements.join("\n"));
  return rows.length;
}

module.exports = {
  MEASURES_DIR,
  bucketIso,
  measuresDbPath,
  recordDeviceMeasurements,
};
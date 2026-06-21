"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const ROOT = __dirname;
const MEASURES_DIR = process.env.MEASURES_DIR || path.join(ROOT, "measures");
const MAX_BUFFER = 64 * 1024 * 1024;
const BUCKET_MINUTES = 10;
const TEMPERATURE_KINDS = new Set(["indoor", "outdoor"]);

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

function runSqlJson(dbPath, sql) {
  ensureMeasuresDir();
  const output = execFileSync("sqlite3", ["-json", dbPath], {
    input: `${sql}\n`,
    encoding: "utf8",
    maxBuffer: MAX_BUFFER,
  });
  const text = String(output || "").trim();
  if (!text) {
    return [];
  }
  return JSON.parse(text);
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

function roundToNearestMinute(date = new Date()) {
  const parsed = new Date(date);
  if (!Number.isFinite(parsed.getTime())) {
    return roundToNearestMinute(new Date());
  }
  return new Date(Math.round(parsed.getTime() / 60000) * 60000);
}

function bucketIso(date = new Date()) {
  return bucketDate(date).toISOString();
}

function measuresDbPath(date = new Date()) {
  const monthKey = bucketDate(date).toISOString().slice(0, 7);
  return path.join(MEASURES_DIR, `measures_${monthKey}.sqlite`);
}

function parseIsoDate(value) {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function monthStart(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
}

function nextMonth(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1, 0, 0, 0, 0));
}

function listMeasuresDbPaths(fromDate, toDate) {
  const paths = [];
  let current = monthStart(fromDate);
  const limit = monthStart(toDate);
  while (current <= limit) {
    const dbPath = measuresDbPath(current);
    if (fs.existsSync(dbPath)) {
      paths.push(dbPath);
    }
    current = nextMonth(current);
  }
  return paths;
}

function asNonNegativeInt(value, fallback) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function parseDeviceSetting(value) {
  try {
    return JSON.parse(String(value || "{}"));
  } catch {
    return {};
  }
}

function normalizeTemperatureKind(value) {
  if (value === null || value === undefined || value === "" || value === "all") {
    return null;
  }
  const normalized = String(value).toLowerCase();
  if (!TEMPERATURE_KINDS.has(normalized)) {
    throw new Error("Invalid temperatureKind. Use indoor, outdoor, or all.");
  }
  return normalized;
}

function buildUnionSelect(aliases, options) {
  const conditions = [
    `recorded_at >= ${sqlText(options.fromIso)}`,
    `recorded_at < ${sqlText(options.toIso)}`,
  ];
  if (options.deviceName) {
    conditions.push(`device_name = ${sqlText(options.deviceName)}`);
  }
  if (options.temperatureKind) {
    conditions.push(`temperature_kind = ${sqlText(options.temperatureKind)}`);
  }
  const whereClause = conditions.join(" AND ");
  return aliases
    .map((alias) => `
      SELECT
        recorded_at,
        bucket_at,
        device_name,
        temperature_kind,
        temperature,
        device_setting
      FROM ${alias}.measurements
      WHERE ${whereClause}
    `)
    .join("\nUNION ALL\n");
}

function attachSql(dbPaths) {
  return dbPaths
    .map((dbPath, index) => `ATTACH DATABASE ${sqlText(dbPath)} AS m${index};`)
    .join("\n");
}

function queryDeviceMeasurements(options) {
  const deviceName = String(options.deviceName || "").trim();
  if (!deviceName) {
    throw new Error("Missing deviceName.");
  }

  return queryMeasurements({
    ...options,
    deviceName,
  });
}

function queryMeasurements(options) {
  const fromDate = parseIsoDate(options.from);
  const toDate = parseIsoDate(options.to);
  if (!fromDate || !toDate || !(toDate > fromDate)) {
    throw new Error("Invalid range. Use ISO dates and ensure to > from.");
  }

  const limit = Math.min(500000, Math.max(1, asNonNegativeInt(options.limit, 500)));
  const offset = Math.min(100000, asNonNegativeInt(options.offset, 0));
  const temperatureKind = normalizeTemperatureKind(options.temperatureKind);
  const dbPaths = listMeasuresDbPaths(fromDate, toDate);
  if (!dbPaths.length) {
    return {
      hasMore: false,
      limit,
      measurements: [],
      offset,
      total: 0,
    };
  }

  const aliases = dbPaths.map((_, index) => `m${index}`);
  const unionSelect = buildUnionSelect(aliases, {
    deviceName: options.deviceName ? String(options.deviceName).trim() : "",
    fromIso: fromDate.toISOString(),
    temperatureKind,
    toIso: toDate.toISOString(),
  });
  const attachStatements = attachSql(dbPaths);

  const countRows = runSqlJson(":memory:", `
    ${attachStatements}
    SELECT COUNT(*) AS total
    FROM (
      ${unionSelect}
    );
  `);
  const total = Number(countRows[0] && countRows[0].total) || 0;
  if (!total || offset >= total) {
    return {
      hasMore: false,
      limit,
      measurements: [],
      offset,
      total,
    };
  }

  const dataRows = runSqlJson(":memory:", `
    ${attachStatements}
    SELECT
      recorded_at,
      bucket_at,
      device_name,
      temperature_kind,
      temperature,
      device_setting
    FROM (
      ${unionSelect}
    )
    ORDER BY recorded_at DESC, temperature_kind ASC
    LIMIT ${limit + 1}
    OFFSET ${offset};
  `);

  const hasMore = dataRows.length > limit;
  const measurements = dataRows.slice(0, limit).map((row) => ({
    bucketAt: row.bucket_at,
    deviceName: row.device_name,
    deviceSetting: parseDeviceSetting(row.device_setting),
    recordedAt: row.recorded_at,
    temperature: Number(row.temperature),
    temperatureKind: row.temperature_kind,
  }));

  return {
    hasMore,
    limit,
    measurements,
    offset,
    total,
  };
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

  const roundedRecordedAt = roundToNearestMinute(recordedAt);
  const recordedAtIso = roundedRecordedAt.toISOString();
  const bucketAt = bucketIso(roundedRecordedAt);
  const dbPath = measuresDbPath(roundedRecordedAt);
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
  queryMeasurements,
  queryDeviceMeasurements,
  recordDeviceMeasurements,
  roundToNearestMinute,
};

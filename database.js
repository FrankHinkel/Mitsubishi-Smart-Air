"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const ROOT = __dirname;
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, "data");
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, "app.sqlite");
const DEFAULT_APP_TITLE = "Smart Air";
const PBKDF2_ITERATIONS = 120000;
const MAX_BUFFER = 8 * 1024 * 1024;

function ensureDataDir() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

function runSql(sql) {
  ensureDataDir();
  execFileSync("sqlite3", [DB_PATH], {
    input: `${sql}\n`,
    encoding: "utf8",
    maxBuffer: MAX_BUFFER,
  });
}

function queryRows(sql) {
  ensureDataDir();
  const output = execFileSync("sqlite3", ["-json", DB_PATH, sql], {
    encoding: "utf8",
    maxBuffer: MAX_BUFFER,
  }).trim();
  return output ? JSON.parse(output) : [];
}

function queryOne(sql) {
  return queryRows(sql)[0] || null;
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

function nowIso() {
  return new Date().toISOString();
}

function normalizeMac(value) {
  const normalized = String(value || "").trim().toLowerCase().replace(/-/g, ":");
  if (/^[0-9a-f]{12}$/.test(normalized)) {
    return normalized.match(/.{2}/g).join(":");
  }
  return normalized;
}

function normalizeAirconId(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeProtocol(value) {
  return value === "http" || value === "https" || value === "auto" ? value : "auto";
}

function normalizePort(value) {
  const port = Number.parseInt(value, 10);
  return Number.isInteger(port) && port > 0 && port <= 65535 ? port : 51443;
}

function cleanText(value) {
  return String(value || "").trim();
}

function normalizeAppTitle(value) {
  return cleanText(value).slice(0, 120) || DEFAULT_APP_TITLE;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(String(password), salt, PBKDF2_ITERATIONS, 32, "sha256").toString("hex");
  return `pbkdf2-sha256$${PBKDF2_ITERATIONS}$${salt}$${hash}`;
}

function verifyPassword(password, storedHash) {
  const parts = String(storedHash || "").split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2-sha256") {
    return false;
  }

  const iterations = Number.parseInt(parts[1], 10);
  const salt = parts[2];
  const expected = Buffer.from(parts[3], "hex");
  if (!Number.isInteger(iterations) || !salt || !expected.length) {
    return false;
  }

  const actual = crypto.pbkdf2Sync(String(password), salt, iterations, expected.length, "sha256");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function selectDeviceColumns() {
  return `
    id,
    name,
    ip_address AS ipAddress,
    port,
    protocol,
    operator_id AS operatorId,
    aircon_id AS airconId,
    mac_address AS macAddress,
    firm_type AS firmType,
    sort_order AS sortOrder,
    hidden,
    status_json AS statusJson,
    raw_info_json AS rawInfoJson,
    sleep_until AS sleepUntil,
    sleep_next_attempt_at AS sleepNextAttemptAt,
    sleep_retry_count AS sleepRetryCount,
    sleep_last_error AS sleepLastError,
    created_at AS createdAt,
    updated_at AS updatedAt,
    last_seen_at AS lastSeenAt
  `;
}

function parseJsonField(value, fallback = null) {
  if (!value) {
    return fallback;
  }
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function rowToDevice(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    deviceId: row.name,
    ipAddress: row.ipAddress,
    port: row.port,
    protocol: row.protocol,
    operatorId: row.operatorId,
    airconId: row.airconId,
    macAddress: row.macAddress,
    firmType: row.firmType,
    sortOrder: row.sortOrder,
    hidden: Boolean(row.hidden),
    status: parseJsonField(row.statusJson),
    rawInfo: parseJsonField(row.rawInfoJson),
    sleepTimer: row.sleepUntil
      ? {
        until: row.sleepUntil,
        nextAttemptAt: row.sleepNextAttemptAt || row.sleepUntil,
        retryCount: Number(row.sleepRetryCount) || 0,
        lastError: row.sleepLastError || "",
      }
      : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastSeenAt: row.lastSeenAt,
  };
}

function tableColumns(tableName) {
  return new Set(queryRows(`PRAGMA table_info(${tableName});`).map((row) => row.name));
}

function ensureColumn(tableName, columnName, definition) {
  const columns = tableColumns(tableName);
  if (columns.has(columnName)) {
    return;
  }
  runSql(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition};`);
}

function ensureDeviceTimerColumns() {
  ensureColumn("devices", "sleep_until", "TEXT");
  ensureColumn("devices", "sleep_next_attempt_at", "TEXT");
  ensureColumn("devices", "sleep_retry_count", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn("devices", "sleep_last_error", "TEXT NOT NULL DEFAULT ''");
}

function initDatabase() {
  ensureDataDir();
  runSql(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL COLLATE NOCASE UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      ip_address TEXT NOT NULL,
      port INTEGER NOT NULL DEFAULT 51443,
      protocol TEXT NOT NULL DEFAULT 'auto',
      operator_id TEXT NOT NULL DEFAULT '',
      aircon_id TEXT NOT NULL DEFAULT '',
      mac_address TEXT NOT NULL DEFAULT '',
      firm_type TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      hidden INTEGER NOT NULL DEFAULT 0,
      status_json TEXT,
      raw_info_json TEXT,
      sleep_until TEXT,
      sleep_next_attempt_at TEXT,
      sleep_retry_count INTEGER NOT NULL DEFAULT 0,
      sleep_last_error TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_seen_at TEXT
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_devices_mac
      ON devices(mac_address)
      WHERE mac_address <> '';

    CREATE UNIQUE INDEX IF NOT EXISTS idx_devices_aircon
      ON devices(aircon_id)
      WHERE aircon_id <> '';

    CREATE INDEX IF NOT EXISTS idx_devices_order
      ON devices(hidden, sort_order, name);
  `);

  ensureDeviceTimerColumns();
  seedDefaultUser();
}

function getSetting(key) {
  return queryOne(`
    SELECT key, value, updated_at AS updatedAt
    FROM settings
    WHERE key = ${sqlText(cleanText(key))}
    LIMIT 1;
  `);
}

function setSetting(key, value) {
  const timestamp = nowIso();
  runSql(`
    INSERT INTO settings (key, value, updated_at)
    VALUES (${sqlText(cleanText(key))}, ${sqlText(String(value || ""))}, ${sqlText(timestamp)})
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at;
  `);
}

function getAppSettings() {
  const titleSetting = getSetting("app_title");
  return {
    title: normalizeAppTitle(titleSetting && titleSetting.value),
  };
}

function saveAppSettings(input = {}) {
  const settings = {
    title: normalizeAppTitle(input.title),
  };
  setSetting("app_title", settings.title);
  return settings;
}

function seedDefaultUser() {
  const row = queryOne("SELECT COUNT(*) AS count FROM users;");
  if (row && Number(row.count) > 0) {
    return;
  }

  const username = cleanText(process.env.DEFAULT_ADMIN_USERNAME || "admin") || "admin";
  const password = String(process.env.DEFAULT_ADMIN_PASSWORD || "admin");
  const timestamp = nowIso();
  runSql(`
    INSERT INTO users (username, password_hash, created_at, updated_at)
    VALUES (${sqlText(username)}, ${sqlText(hashPassword(password))}, ${sqlText(timestamp)}, ${sqlText(timestamp)});
  `);
}

function getUserByUsername(username) {
  return queryOne(`
    SELECT id, username, password_hash AS passwordHash, created_at AS createdAt, updated_at AS updatedAt
    FROM users
    WHERE username = ${sqlText(cleanText(username))}
    LIMIT 1;
  `);
}

function getUserById(id) {
  return queryOne(`
    SELECT id, username, created_at AS createdAt, updated_at AS updatedAt
    FROM users
    WHERE id = ${Number.parseInt(id, 10) || 0}
    LIMIT 1;
  `);
}

function createSession(userId, token, expiresAt) {
  const timestamp = nowIso();
  runSql(`
    INSERT INTO sessions (token_hash, user_id, expires_at, created_at)
    VALUES (${sqlText(hashToken(token))}, ${Number.parseInt(userId, 10) || 0}, ${sqlText(expiresAt)}, ${sqlText(timestamp)});
  `);
}

function getSession(token) {
  const tokenHash = hashToken(token);
  const timestamp = nowIso();
  return queryOne(`
    SELECT
      sessions.token_hash AS tokenHash,
      sessions.expires_at AS expiresAt,
      users.id AS userId,
      users.username AS username
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ${sqlText(tokenHash)}
      AND sessions.expires_at > ${sqlText(timestamp)}
    LIMIT 1;
  `);
}

function deleteSession(token) {
  runSql(`DELETE FROM sessions WHERE token_hash = ${sqlText(hashToken(token))};`);
}

function deleteExpiredSessions() {
  runSql(`DELETE FROM sessions WHERE expires_at <= ${sqlText(nowIso())};`);
}

function listDevices(options = {}) {
  const includeHidden = Boolean(options.includeHidden);
  const rows = queryRows(`
    SELECT ${selectDeviceColumns()}
    FROM devices
    ${includeHidden ? "" : "WHERE hidden = 0"}
    ORDER BY sort_order ASC, lower(name) ASC, id ASC;
  `);
  return rows.map(rowToDevice);
}

function getDevice(id) {
  return rowToDevice(getDeviceRow(id));
}

function getDeviceRow(id) {
  return queryOne(`
    SELECT ${selectDeviceColumns()}
    FROM devices
    WHERE id = ${Number.parseInt(id, 10) || 0}
    LIMIT 1;
  `);
}

function findMatchingDeviceRow(input) {
  const config = input.config || input;
  const info = input.info || {};
  const debugContents = input.debug && input.debug.contents ? input.debug.contents : {};
  const macAddress = normalizeMac(input.macAddress || info.macAddress || debugContents.macAddress);
  const airconId = normalizeAirconId(config.airconId || input.airconId || info.airconId || debugContents.airconId);
  const ipAddress = cleanText(config.ipAddress || input.ipAddress);
  const port = normalizePort(config.port || input.port);
  const clauses = [];

  if (macAddress) {
    clauses.push(`(mac_address <> '' AND mac_address = ${sqlText(macAddress)})`);
  }
  if (airconId) {
    clauses.push(`(aircon_id <> '' AND aircon_id = ${sqlText(airconId)})`);
  }
  if (ipAddress) {
    clauses.push(`(ip_address = ${sqlText(ipAddress)} AND port = ${port})`);
  }
  if (!clauses.length) {
    return null;
  }

  return queryOne(`
    SELECT ${selectDeviceColumns()}
    FROM devices
    WHERE ${clauses.join(" OR ")}
    ORDER BY updated_at DESC, id DESC
    LIMIT 1;
  `);
}

function maxSortOrder() {
  const row = queryOne("SELECT COALESCE(MAX(sort_order), 0) AS value FROM devices;");
  return row ? Number(row.value) || 0 : 0;
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function saveDevice(input) {
  const config = input.config || input;
  const info = input.info || {};
  const debugContents = input.debug && input.debug.contents ? input.debug.contents : {};
  const existing = input.id ? getDeviceRow(input.id) : findMatchingDeviceRow(input);
  const timestamp = nowIso();
  const ipAddress = cleanText(config.ipAddress || input.ipAddress || (existing && existing.ipAddress));

  if (!ipAddress) {
    throw new Error("Device IP address is required.");
  }

  const operatorCandidate = cleanText(config.operatorId || input.operatorId);
  const operatorId = operatorCandidate === "probe" && existing && existing.operatorId
    ? existing.operatorId
    : operatorCandidate || (existing && existing.operatorId) || "";
  const name = cleanText(input.name || input.deviceId || config.deviceId || (existing && existing.name) || `WF-RAC ${ipAddress}`);
  const statusJson = hasOwn(input, "status")
    ? (input.status ? JSON.stringify(input.status) : null)
    : (existing && existing.statusJson) || null;
  const rawInfo = Object.keys(info).length ? info : null;
  const rawInfoJson = rawInfo ? JSON.stringify(rawInfo) : (existing && existing.rawInfoJson) || null;

  const values = {
    name,
    ipAddress,
    port: normalizePort(config.port || input.port || (existing && existing.port)),
    protocol: normalizeProtocol(config.protocol || input.protocol || (existing && existing.protocol)),
    operatorId,
    airconId: normalizeAirconId(config.airconId || input.airconId || info.airconId || debugContents.airconId || (existing && existing.airconId)),
    macAddress: normalizeMac(input.macAddress || info.macAddress || debugContents.macAddress || (existing && existing.macAddress)),
    firmType: cleanText(input.firmType || info.firmType || debugContents.firmType || (existing && existing.firmType)),
    sortOrder: existing ? Number(existing.sortOrder) || 0 : maxSortOrder() + 10,
    hidden: existing ? Number(existing.hidden) || 0 : (input.hidden ? 1 : 0),
    statusJson,
    rawInfoJson,
  };

  if (existing) {
    runSql(`
      UPDATE devices SET
        name = ${sqlText(values.name)},
        ip_address = ${sqlText(values.ipAddress)},
        port = ${values.port},
        protocol = ${sqlText(values.protocol)},
        operator_id = ${sqlText(values.operatorId)},
        aircon_id = ${sqlText(values.airconId)},
        mac_address = ${sqlText(values.macAddress)},
        firm_type = ${sqlText(values.firmType)},
        sort_order = ${values.sortOrder},
        hidden = ${values.hidden},
        status_json = ${sqlValue(values.statusJson)},
        raw_info_json = ${sqlValue(values.rawInfoJson)},
        updated_at = ${sqlText(timestamp)},
        last_seen_at = ${sqlText(timestamp)}
      WHERE id = ${Number(existing.id)};
    `);
    return getDevice(existing.id);
  }

  runSql(`
    INSERT INTO devices (
      name, ip_address, port, protocol, operator_id, aircon_id, mac_address, firm_type,
      sort_order, hidden, status_json, raw_info_json, created_at, updated_at, last_seen_at
    ) VALUES (
      ${sqlText(values.name)},
      ${sqlText(values.ipAddress)},
      ${values.port},
      ${sqlText(values.protocol)},
      ${sqlText(values.operatorId)},
      ${sqlText(values.airconId)},
      ${sqlText(values.macAddress)},
      ${sqlText(values.firmType)},
      ${values.sortOrder},
      ${values.hidden},
      ${sqlValue(values.statusJson)},
      ${sqlValue(values.rawInfoJson)},
      ${sqlText(timestamp)},
      ${sqlText(timestamp)},
      ${sqlText(timestamp)}
    );
  `);

  return rowToDevice(findMatchingDeviceRow(input));
}

function updateDeviceList(items) {
  const timestamp = nowIso();
  const statements = ["BEGIN;"];
  items.forEach((item, index) => {
    const id = Number.parseInt(item.id, 10);
    if (!id) {
      return;
    }

    const name = cleanText(item.name);
    const hidden = item.hidden ? 1 : 0;
    const sortOrder = Number.isInteger(item.sortOrder) ? item.sortOrder : (index + 1) * 10;
    statements.push(`
      UPDATE devices SET
        name = CASE WHEN length(trim(${sqlText(name)})) > 0 THEN ${sqlText(name)} ELSE name END,
        hidden = ${hidden},
        sort_order = ${sortOrder},
        updated_at = ${sqlText(timestamp)}
      WHERE id = ${id};
    `);
  });
  statements.push("COMMIT;");
  runSql(statements.join("\n"));
  return listDevices({ includeHidden: true });
}

function setDeviceSleepTimer(id, untilIso) {
  const deviceId = Number.parseInt(id, 10) || 0;
  const timestamp = nowIso();
  if (!untilIso) {
    runSql(`
      UPDATE devices SET
        sleep_until = NULL,
        sleep_next_attempt_at = NULL,
        sleep_retry_count = 0,
        sleep_last_error = '',
        updated_at = ${sqlText(timestamp)}
      WHERE id = ${deviceId};
    `);
    return getDevice(deviceId);
  }

  runSql(`
    UPDATE devices SET
      sleep_until = ${sqlText(untilIso)},
      sleep_next_attempt_at = ${sqlText(untilIso)},
      sleep_retry_count = 0,
      sleep_last_error = '',
      updated_at = ${sqlText(timestamp)}
    WHERE id = ${deviceId};
  `);
  return getDevice(deviceId);
}

function listDueSleepTimerDevices(referenceIso = nowIso()) {
  return queryRows(`
    SELECT ${selectDeviceColumns()}
    FROM devices
    WHERE sleep_until IS NOT NULL
      AND sleep_next_attempt_at IS NOT NULL
      AND sleep_next_attempt_at <= ${sqlText(referenceIso)}
    ORDER BY sleep_next_attempt_at ASC, id ASC;
  `).map(rowToDevice);
}

function markSleepTimerFailure(id, retryCount, nextAttemptAt, errorMessage) {
  const deviceId = Number.parseInt(id, 10) || 0;
  const timestamp = nowIso();
  runSql(`
    UPDATE devices SET
      sleep_retry_count = ${Number.parseInt(retryCount, 10) || 0},
      sleep_next_attempt_at = ${sqlValue(nextAttemptAt || null)},
      sleep_last_error = ${sqlText(cleanText(errorMessage).slice(0, 400))},
      updated_at = ${sqlText(timestamp)}
    WHERE id = ${deviceId};
  `);
  return getDevice(deviceId);
}

module.exports = {
  DB_PATH,
  createSession,
  deleteExpiredSessions,
  deleteSession,
  getAppSettings,
  getDevice,
  getSession,
  getSetting,
  getUserById,
  getUserByUsername,
  hashPassword,
  initDatabase,
  listDueSleepTimerDevices,
  listDevices,
  markSleepTimerFailure,
  saveAppSettings,
  saveDevice,
  setSetting,
  setDeviceSleepTimer,
  updateDeviceList,
  verifyPassword,
};

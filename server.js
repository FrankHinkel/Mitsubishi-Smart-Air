"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const {
  applyStatus,
  defaultStatus,
  loadDeviceInfo,
  refreshStatus,
  registerRemote,
} = require("./device-api");
const db = require("./database");
const measures = require("./measures");

const execFileAsync = promisify(execFile);
const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number.parseInt(process.env.PORT || "13920", 10);
const ROOT = __dirname;
const SESSION_COOKIE = "msa_session";
const SESSION_DAYS = Number.parseInt(process.env.SESSION_DAYS || "36500", 10);
const SCAN_TIMEOUT_MS = Number.parseInt(process.env.SCAN_TIMEOUT_MS || "550", 10);
const SCAN_CONCURRENCY = Number.parseInt(process.env.SCAN_CONCURRENCY || "64", 10);
const MAX_SCAN_HOSTS = Number.parseInt(process.env.MAX_SCAN_HOSTS || "512", 10);
const STATUS_POLL_INTERVAL_MS = Number.parseInt(process.env.STATUS_POLL_INTERVAL_MS || "60000", 10);
const STATUS_POLL_START_DELAY_MS = Number.parseInt(process.env.STATUS_POLL_START_DELAY_MS || "10000", 10);
const SLEEP_TIMER_CHECK_INTERVAL_MS = Number.parseInt(process.env.SLEEP_TIMER_CHECK_INTERVAL_MS || "30000", 10);
const SLEEP_TIMER_RETRY_DELAY_MS = Number.parseInt(process.env.SLEEP_TIMER_RETRY_DELAY_MS || "180000", 10);
const SLEEP_TIMER_MAX_RETRIES = Number.parseInt(process.env.SLEEP_TIMER_MAX_RETRIES || "3", 10);
const MAC_PREFIXES = parseCsv(process.env.MAC_PREFIXES || "a0:43:b0").map(normalizeMacPrefix);
const SCAN_PORTS = parsePorts(process.env.SCAN_PORTS || "51443");
const SCAN_PROTOCOLS = parseCsv(process.env.SCAN_PROTOCOLS || "http,https").filter((value) => value === "http" || value === "https");
const PUBLIC_FILES = new Map([
  ["/", "index.html"],
  ["/index.html", "index.html"],
  ["/app.js", "app.js"],
  ["/styles.css", "styles.css"],
  ["/favicon.ico", null],
]);
const CONTENT_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

db.initDatabase();
db.deleteExpiredSessions();
setInterval(() => db.deleteExpiredSessions(), 60 * 60 * 1000).unref();
let statusPollRunning = false;
let boostTimerRunning = false;
let sleepTimerRunning = false;

function parseCsv(value) {
  return String(value || "")
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

function parsePorts(value) {
  const ports = parseCsv(value)
    .map((part) => Number.parseInt(part, 10))
    .filter((port) => Number.isInteger(port) && port > 0 && port <= 65535);
  return ports.length ? [...new Set(ports)] : [51443];
}

function normalizeMac(value) {
  const normalized = String(value || "").trim().toLowerCase().replace(/-/g, ":");
  if (/^[0-9a-f]{12}$/.test(normalized)) {
    return normalized.match(/.{2}/g).join(":");
  }
  return normalized;
}

function normalizeMacPrefix(value) {
  return normalizeMac(value).split(":").slice(0, 3).join(":");
}

function macPrefix(value) {
  const normalized = normalizeMac(value);
  return normalized ? normalized.split(":").slice(0, 3).join(":") : "";
}

function isPreferredMac(value) {
  const prefix = macPrefix(value);
  return Boolean(prefix && MAC_PREFIXES.includes(prefix));
}

function normalizeProtocol(value) {
  return value === "http" || value === "https" || value === "auto" ? value : "auto";
}

function makeOperatorId() {
  return `web-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function sendJson(response, statusCode, payload, headers = {}) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body),
    "Content-Type": CONTENT_TYPES[".json"],
    ...headers,
  });
  response.end(body);
}

function sendText(response, statusCode, body) {
  response.writeHead(statusCode, {
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body),
    "Content-Type": CONTENT_TYPES[".txt"],
  });
  response.end(body);
}

function sendError(response, statusCode, error) {
  const message = error && error.message ? error.message : String(error || "Error");
  sendJson(response, statusCode, { error: message });
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > 1024 * 1024) {
        reject(new Error("Request body is too large."));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

async function parseJsonBody(request) {
  const text = await readRequestBody(request);
  return text ? JSON.parse(text) : {};
}

function parseCookies(request) {
  const cookies = new Map();
  const header = request.headers.cookie || "";
  for (const pair of header.split(";")) {
    const index = pair.indexOf("=");
    if (index <= 0) {
      continue;
    }
    const name = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    cookies.set(name, decodeURIComponent(value));
  }
  return cookies;
}

function sessionCookie(token, maxAgeSeconds) {
  const encoded = encodeURIComponent(token);
  return `${SESSION_COOKIE}=${encoded}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

function currentUser(request) {
  const token = parseCookies(request).get(SESSION_COOKIE);
  if (!token) {
    return null;
  }

  const session = db.getSession(token);
  if (!session) {
    return null;
  }

  return {
    id: session.userId,
    username: session.username,
    token,
  };
}

function publicApiRoute(method, pathname) {
  return (method === "GET" && pathname === "/api/health")
    || (method === "GET" && pathname === "/api/settings")
    || (method === "GET" && pathname === "/api/me")
    || (method === "POST" && pathname === "/api/login")
    || (method === "POST" && pathname === "/api/logout");
}

function recordMeasurements(device) {
  try {
    measures.recordDeviceMeasurements(device);
  } catch {
    // Measurement logging must never block control or refresh flows.
  }
}

function safeDevice(device) {
  if (!device) {
    return null;
  }
  const {
    operatorId,
    rawInfo,
    ...publicDevice
  } = device;
  return {
    ...publicDevice,
    hasOperatorId: Boolean(operatorId),
    rawInfo: rawInfo || null,
  };
}

function deviceToConfig(device) {
  return {
    deviceId: device.name || `WF-RAC ${device.ipAddress}`,
    ipAddress: device.ipAddress,
    port: Number.parseInt(device.port, 10) || 51443,
    protocol: normalizeProtocol(device.protocol),
    operatorId: device.operatorId || makeOperatorId(),
    airconId: device.airconId || "",
  };
}

function remoteListFromDebug(debug) {
  const remoteList = debug && debug.contents && Array.isArray(debug.contents.remoteList)
    ? debug.contents.remoteList
    : [];
  return remoteList
    .map((value) => String(value || "").trim())
    .filter(Boolean);
}

function preferredOperatorId(debug, currentOperatorId) {
  const current = String(currentOperatorId || "").trim();
  const remoteList = remoteListFromDebug(debug);
  if (!remoteList.length) {
    return current;
  }
  if (current && remoteList.some((remoteId) => remoteId.toLowerCase() === current.toLowerCase())) {
    return current;
  }
  return remoteList[0];
}

function writeResultCode(result) {
  return result && result.debug && Number.isInteger(result.debug.result)
    ? result.debug.result
    : 0;
}

function assertWriteAccepted(result) {
  const resultCode = writeResultCode(result);
  if (resultCode === 0) {
    return;
  }

  if (resultCode === 2) {
    throw new Error("The device rejected the command because this app is not registered as a writable remote.");
  }

  throw new Error(`The device rejected the command with result ${resultCode}.`);
}

function normalizedStatus(status) {
  return {
    ...defaultStatus(),
    ...(status || {}),
  };
}

function validBoostMinutes(value) {
  const minutes = Number.parseInt(value, 10);
  return [5, 10, 15, 30].includes(minutes) ? minutes : 0;
}

function buildBoostStatus(status) {
  const current = normalizedStatus(status);
  if (Number(current.operationMode) === 1) {
    return {
      ...current,
      airFlow: 4,
      operation: true,
      presetTemp: 18,
    };
  }
  if (Number(current.operationMode) === 2) {
    return {
      ...current,
      airFlow: 4,
      operation: true,
      presetTemp: 30,
    };
  }
  throw new Error("Boost is only available in Cool or Heat mode.");
}

function validIpAddress(ipAddress) {
  const parts = String(ipAddress || "").split(".");
  return parts.length === 4 && parts.every((part) => {
    const number = Number.parseInt(part, 10);
    return /^\d+$/.test(part) && number >= 0 && number <= 255;
  });
}

function sameSubnet(left, right) {
  return String(left || "").split(".").slice(0, 3).join(".") === String(right || "").split(".").slice(0, 3).join(".");
}

function isPrivateIpv4(ipAddress) {
  const parts = String(ipAddress || "").split(".").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return false;
  }

  return parts[0] === 10
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168);
}

function isLikelyVirtualInterface(name) {
  return /^(lo|docker\d*|br-[0-9a-f]+|veth[0-9a-f]+|virbr\d*|cni\d*|flannel\d*|podman\d*|tailscale\d*|zt\w*|wg\d*|tun\d*|tap\d*|utun\d*|vboxnet\d*|vmnet\d*)$/i.test(String(name || ""));
}

function interfacePriority(name) {
  const interfaceName = String(name || "").toLowerCase();
  if (/^(eth\d*|en\d*|end\d*|eno\d*|ens\d*|enp\d*|wlan\d*|wl\w*|wifi\d*|lan\d*)$/.test(interfaceName)) {
    return 0;
  }
  if (isLikelyVirtualInterface(interfaceName)) {
    return 3;
  }
  return 1;
}

function isIpv4Family(value) {
  return value === "IPv4" || value === 4 || value === "4";
}

function parseArpTable(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.match(/\(([^)]+)\)\s+at\s+([0-9a-fA-F:.-]+)/))
    .filter(Boolean)
    .map((match) => ({
      ipAddress: match[1],
      macAddress: normalizeMac(match[2]),
    }))
    .filter((entry) => validIpAddress(entry.ipAddress) && entry.macAddress && entry.macAddress !== "(incomplete)");
}

function parseNeighborTable(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.match(/^(\d+\.\d+\.\d+\.\d+)\s+.*\slladdr\s+([0-9a-fA-F:.-]+)/))
    .filter(Boolean)
    .map((match) => ({
      ipAddress: match[1],
      macAddress: normalizeMac(match[2]),
    }))
    .filter((entry) => validIpAddress(entry.ipAddress) && entry.macAddress);
}

async function readNeighborEntries() {
  const entries = [];
  try {
    const result = await execFileAsync("arp", ["-an"], { maxBuffer: 1024 * 1024 });
    entries.push(...parseArpTable(result.stdout));
  } catch {
    // Linux containers may not ship arp unless net-tools is installed.
  }

  if (!entries.length) {
    try {
      const result = await execFileAsync("ip", ["neighbor"], { maxBuffer: 1024 * 1024 });
      entries.push(...parseNeighborTable(result.stdout));
    } catch {
      // Discovery can still fall back to subnet probing.
    }
  }

  const byIp = new Map();
  for (const entry of entries) {
    byIp.set(entry.ipAddress, entry);
  }
  return [...byIp.values()];
}

function subnetHosts(prefix) {
  const match = String(prefix || "").trim().match(/^(\d+\.\d+\.\d+)\.(?:\d+)(?:\/24)?$/);
  if (!match) {
    return [];
  }

  const base = match[1];
  const hosts = [];
  for (let host = 1; host <= 254; host += 1) {
    hosts.push(`${base}.${host}`);
  }
  return hosts;
}

function configuredSubnetHosts() {
  return parseCsv(process.env.SCAN_SUBNETS || "").flatMap(subnetHosts);
}

function localSubnetHosts() {
  const groups = [];
  const interfaces = os.networkInterfaces();
  for (const [name, entries] of Object.entries(interfaces)) {
    if (isLikelyVirtualInterface(name)) {
      continue;
    }

    const subnetSet = new Set();
    for (const entry of entries || []) {
      if (entry.internal || !isIpv4Family(entry.family) || !validIpAddress(entry.address) || !isPrivateIpv4(entry.address)) {
        continue;
      }
      for (const host of subnetHosts(`${entry.address}/24`)) {
        subnetSet.add(host);
      }
    }

    if (subnetSet.size) {
      groups.push({
        name,
        priority: interfacePriority(name),
        hosts: [...subnetSet],
      });
    }
  }

  return groups
    .sort((left, right) => left.priority - right.priority || left.name.localeCompare(right.name, "en"))
    .flatMap((group) => group.hosts);
}

function buildCandidateMap(neighborEntries, options = {}) {
  const devices = db.listDevices({ includeHidden: true });
  const candidateMap = new Map();

  function addCandidate(ipAddress, details = {}) {
    if (!validIpAddress(ipAddress) || ipAddress.endsWith(".0") || ipAddress.endsWith(".255")) {
      return;
    }
    const current = candidateMap.get(ipAddress) || {
      ipAddress,
      macAddress: "",
      preferredMac: false,
      source: new Set(),
    };
    if (details.macAddress) {
      current.macAddress = normalizeMac(details.macAddress);
      current.preferredMac = current.preferredMac || isPreferredMac(current.macAddress);
    }
    if (details.source) {
      current.source.add(details.source);
    }
    candidateMap.set(ipAddress, current);
  }

  for (const entry of neighborEntries) {
    if (isPreferredMac(entry.macAddress)) {
      addCandidate(entry.ipAddress, {
        macAddress: entry.macAddress,
        source: "mac",
      });
    }
  }

  for (const device of devices) {
    for (const entry of neighborEntries) {
      if (sameSubnet(device.ipAddress, entry.ipAddress) && isPreferredMac(entry.macAddress)) {
        addCandidate(entry.ipAddress, {
          macAddress: entry.macAddress,
          source: "known-subnet-mac",
        });
      }
    }
  }

  if (options.wideScan) {
    for (const ipAddress of configuredSubnetHosts()) {
      addCandidate(ipAddress, { source: "configured-subnet" });
    }
    for (const ipAddress of localSubnetHosts()) {
      addCandidate(ipAddress, { source: "local-subnet" });
    }
    for (const device of devices) {
      for (const ipAddress of subnetHosts(`${device.ipAddress}/24`)) {
        addCandidate(ipAddress, { source: "device-subnet" });
      }
    }
  }

  return [...candidateMap.values()]
    .sort((left, right) => Number(right.preferredMac) - Number(left.preferredMac) || left.ipAddress.localeCompare(right.ipAddress, "en", { numeric: true }))
    .slice(0, MAX_SCAN_HOSTS);
}

function canConnect(ipAddress, port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: ipAddress, port });
    let done = false;

    function finish(result) {
      if (done) {
        return;
      }
      done = true;
      socket.destroy();
      resolve(result);
    }

    socket.setTimeout(SCAN_TIMEOUT_MS);
    socket.on("connect", () => finish(true));
    socket.on("timeout", () => finish(false));
    socket.on("error", () => finish(false));
  });
}

async function mapLimited(items, limit, task) {
  const results = [];
  let nextIndex = 0;
  const workers = new Array(Math.max(1, Math.min(limit, items.length))).fill(null).map(async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await task(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

async function discoverDevices(options = {}) {
  const neighborEntries = await readNeighborEntries();
  const candidates = buildCandidateMap(neighborEntries, options);
  const knownDevices = db.listDevices({ includeHidden: true });
  const knownMacs = new Set(knownDevices.map((device) => normalizeMac(device.macAddress)).filter(Boolean));
  const knownAirconIds = new Set(knownDevices.map((device) => String(device.airconId || "").toLowerCase()).filter(Boolean));
  const probeTargets = [];

  for (const candidate of candidates) {
    for (const port of SCAN_PORTS) {
      probeTargets.push({ ...candidate, port });
    }
  }

  const openTargets = (await mapLimited(probeTargets, SCAN_CONCURRENCY, async (target) => {
    const open = await canConnect(target.ipAddress, target.port);
    return open ? target : null;
  })).filter(Boolean);

  const discoveries = [];
  for (const target of openTargets) {
    if (target.macAddress && knownMacs.has(target.macAddress)) {
      continue;
    }

    for (const protocol of SCAN_PROTOCOLS) {
      try {
        const result = await loadDeviceInfo({
          deviceId: `WF-RAC ${target.ipAddress}`,
          ipAddress: target.ipAddress,
          port: target.port,
          protocol,
          operatorId: makeOperatorId(),
        });
        const info = {
          ...(result.info || {}),
          macAddress: normalizeMac((result.info && result.info.macAddress) || target.macAddress),
        };
        const macAddress = normalizeMac(info.macAddress);
        const airconId = String(info.airconId || result.config.airconId || "").trim().toLowerCase();

        if ((macAddress && knownMacs.has(macAddress)) || (airconId && knownAirconIds.has(airconId))) {
          break;
        }

        const saved = db.saveDevice({
          config: {
            ...result.config,
            deviceId: result.config.deviceId || `WF-RAC ${target.ipAddress}`,
          },
          info,
          debug: result.debug,
        });
        discoveries.push(saved);
        if (macAddress) {
          knownMacs.add(macAddress);
        }
        if (airconId) {
          knownAirconIds.add(airconId);
        }
        break;
      } catch {
        // Continue with the next protocol or target.
      }
    }
  }

  return discoveries;
}

function serveStatic(response, pathname) {
  const mapped = PUBLIC_FILES.get(pathname);
  if (mapped === undefined) {
    sendText(response, 404, "Not found.");
    return;
  }
  if (mapped === null) {
    response.writeHead(204, { "Cache-Control": "no-store" });
    response.end();
    return;
  }

  const filePath = path.join(ROOT, mapped);
  fs.readFile(filePath, (error, data) => {
    if (error) {
      sendText(response, 500, "File could not be read.");
      return;
    }
    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": CONTENT_TYPES[path.extname(filePath)] || "application/octet-stream",
    });
    response.end(data);
  });
}

async function handleLogin(request, response) {
  const payload = await parseJsonBody(request);
  const user = db.getUserByUsername(payload.username);
  if (!user || !db.verifyPassword(payload.password, user.passwordHash)) {
    sendJson(response, 401, { error: "Invalid username or password." });
    return;
  }

  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  db.createSession(user.id, token, expiresAt);
  sendJson(response, 200, {
    user: {
      id: user.id,
      username: user.username,
    },
  }, {
    "Set-Cookie": sessionCookie(token, SESSION_DAYS * 24 * 60 * 60),
  });
}

async function handleDeviceStatus(deviceId, response) {
  const device = db.getDevice(deviceId);
  if (!device) {
    sendJson(response, 404, { error: "Device not found." });
    return;
  }

  const { saved, debug } = await refreshDeviceCache(device);
  sendJson(response, 200, {
    device: safeDevice(saved),
    debug,
  });
}

async function refreshDeviceCache(device) {
  const result = await refreshStatus(deviceToConfig(device));
  const operatorId = preferredOperatorId(result.debug, result.config.operatorId);
  const saved = db.saveDevice({
    id: device.id,
    config: {
      ...result.config,
      operatorId,
      deviceId: device.name,
    },
    status: result.status,
    debug: result.debug,
  });
  recordMeasurements(saved);
  return {
    debug: result.debug,
    saved,
  };
}

async function refreshVisibleDeviceCache() {
  if (statusPollRunning) {
    return;
  }

  statusPollRunning = true;
  try {
    const devices = db.listDevices({ includeHidden: false });
    for (const device of devices) {
      try {
        await refreshDeviceCache(device);
      } catch {
        // Background refresh should never make the UI feel noisy or blocked.
      }
    }
  } finally {
    statusPollRunning = false;
  }
}

async function applyDeviceStatus(device, nextStatus, options = {}) {
  const config = deviceToConfig(device);
  let result = await applyStatus(config, nextStatus, {
    forceOff: Boolean(options.forceOff),
  });
  let operatorId = preferredOperatorId(result.debug, result.config.operatorId);
  if (writeResultCode(result) !== 0 && operatorId && operatorId.toLowerCase() !== String(config.operatorId || "").toLowerCase()) {
    result = await applyStatus({
      ...config,
      operatorId,
    }, nextStatus, {
      forceOff: Boolean(options.forceOff),
    });
    operatorId = preferredOperatorId(result.debug, result.config.operatorId);
  }
  assertWriteAccepted(result);
  const saved = db.saveDevice({
    id: device.id,
    config: {
      ...result.config,
      operatorId,
      deviceId: device.name,
    },
    status: result.status,
    debug: result.debug,
  });
  recordMeasurements(saved);
  return {
    debug: result.debug,
    saved,
  };
}

async function handleDeviceApply(deviceId, request, response) {
  const device = db.getDevice(deviceId);
  if (!device) {
    sendJson(response, 404, { error: "Device not found." });
    return;
  }

  const payload = await parseJsonBody(request);
  const nextStatus = {
    ...defaultStatus(),
    ...(device.status || {}),
    ...(payload.status && typeof payload.status === "object" ? payload.status : {}),
  };
  const { saved, debug } = await applyDeviceStatus(device, nextStatus, {
    forceOff: Boolean(payload.forceOff),
  });
  const finalDevice = device.boostTimer && payload.cancelBoost !== false
    ? db.setDeviceBoostTimer(saved.id, null)
    : saved;
  sendJson(response, 200, {
    device: safeDevice(finalDevice),
    debug,
  });
}

function validSleepHours(value) {
  const hours = Number.parseInt(value, 10);
  return [1, 2, 3, 4, 8, 12].includes(hours) ? hours : 0;
}

async function handleDeviceSleep(deviceId, request, response) {
  const device = db.getDevice(deviceId);
  if (!device) {
    sendJson(response, 404, { error: "Device not found." });
    return;
  }

  const payload = await parseJsonBody(request);
  if (payload.hours === null || payload.hours === undefined || payload.hours === "" || payload.hours === 0) {
    sendJson(response, 200, {
      device: safeDevice(db.setDeviceSleepTimer(device.id, null)),
    });
    return;
  }

  const hours = validSleepHours(payload.hours);
  if (!hours) {
    sendJson(response, 400, { error: "Invalid sleep timer." });
    return;
  }

  const until = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
  sendJson(response, 200, {
    device: safeDevice(db.setDeviceSleepTimer(device.id, until)),
  });
}

async function handleDeviceBoost(deviceId, request, response) {
  const device = db.getDevice(deviceId);
  if (!device) {
    sendJson(response, 404, { error: "Device not found." });
    return;
  }

  const payload = await parseJsonBody(request);
  if (payload.minutes === null || payload.minutes === undefined || payload.minutes === "" || payload.minutes === 0) {
    sendJson(response, 200, {
      device: safeDevice(db.setDeviceBoostTimer(device.id, null)),
    });
    return;
  }

  const minutes = validBoostMinutes(payload.minutes);
  if (!minutes) {
    sendJson(response, 400, { error: "Invalid boost timer." });
    return;
  }

  const currentStatus = normalizedStatus(device.status);
  const restoreStatus = device.boostTimer && device.boostTimer.restoreStatus
    ? normalizedStatus(device.boostTimer.restoreStatus)
    : currentStatus;
  const boostStatus = buildBoostStatus(currentStatus);
  const { saved, debug } = await applyDeviceStatus(device, boostStatus);
  const until = new Date(Date.now() + minutes * 60 * 1000).toISOString();
  const boosted = db.setDeviceBoostTimer(saved.id, until, restoreStatus);
  sendJson(response, 200, {
    device: safeDevice(boosted),
    debug,
  });
}

async function runDueSleepTimers() {
  if (sleepTimerRunning) {
    return;
  }

  sleepTimerRunning = true;
  try {
    const dueDevices = db.listDueSleepTimerDevices();
    for (const device of dueDevices) {
      try {
        const nextStatus = {
          ...defaultStatus(),
          ...(device.status || {}),
          operation: false,
        };
        const result = await applyDeviceStatus(device, nextStatus, { forceOff: true });
        let updated = db.setDeviceSleepTimer(result.saved.id, null);
        if (device.boostTimer) {
          updated = db.setDeviceBoostTimer(updated.id, null);
        }
      } catch (error) {
        const nextRetryCount = (device.sleepTimer ? device.sleepTimer.retryCount : 0) + 1;
        const message = error && error.message ? error.message : String(error);
        const nextAttemptAt = nextRetryCount <= SLEEP_TIMER_MAX_RETRIES
          ? new Date(Date.now() + SLEEP_TIMER_RETRY_DELAY_MS).toISOString()
          : null;
        db.markSleepTimerFailure(device.id, nextRetryCount, nextAttemptAt, message);
      }
    }
  } finally {
    sleepTimerRunning = false;
  }
}

async function runDueBoostTimers() {
  if (boostTimerRunning) {
    return;
  }

  boostTimerRunning = true;
  try {
    const dueDevices = db.listDueBoostTimerDevices();
    for (const device of dueDevices) {
      try {
        const restoreStatus = device.boostTimer && device.boostTimer.restoreStatus
          ? normalizedStatus(device.boostTimer.restoreStatus)
          : null;
        if (!restoreStatus) {
          db.setDeviceBoostTimer(device.id, null);
          continue;
        }
        const result = await applyDeviceStatus(device, restoreStatus);
        db.setDeviceBoostTimer(result.saved.id, null);
      } catch (error) {
        const nextRetryCount = (device.boostTimer ? device.boostTimer.retryCount : 0) + 1;
        const message = error && error.message ? error.message : String(error);
        const nextAttemptAt = nextRetryCount <= SLEEP_TIMER_MAX_RETRIES
          ? new Date(Date.now() + SLEEP_TIMER_RETRY_DELAY_MS).toISOString()
          : null;
        db.markBoostTimerFailure(device.id, nextRetryCount, nextAttemptAt, message);
      }
    }
  } finally {
    boostTimerRunning = false;
  }
}

async function handleDeviceRegister(deviceId, response) {
  const device = db.getDevice(deviceId);
  if (!device) {
    sendJson(response, 404, { error: "Device not found." });
    return;
  }

  const result = await registerRemote(deviceToConfig(device));
  const saved = db.saveDevice({
    id: device.id,
    config: {
      ...result.config,
      deviceId: device.name,
    },
    debug: result.debug,
  });
  sendJson(response, 200, {
    device: safeDevice(saved),
    debug: result.debug,
  });
}

async function handleApi(request, response, pathname, url) {
  if (request.method === "GET" && pathname === "/api/health") {
    sendJson(response, 200, {
      ok: true,
      dbPath: db.DB_PATH,
      measuresDir: measures.MEASURES_DIR,
      port: PORT,
      statusPollIntervalMs: STATUS_POLL_INTERVAL_MS,
      sleepTimerCheckIntervalMs: SLEEP_TIMER_CHECK_INTERVAL_MS,
    });
    return;
  }

  if (request.method === "GET" && pathname === "/api/settings") {
    sendJson(response, 200, {
      settings: db.getAppSettings(),
    });
    return;
  }

  if (request.method === "GET" && pathname === "/api/me") {
    const user = currentUser(request);
    if (!user) {
      sendJson(response, 401, { error: "Login required." });
      return;
    }
    sendJson(response, 200, {
      user: {
        id: user.id,
        username: user.username,
      },
    });
    return;
  }

  if (request.method === "POST" && pathname === "/api/login") {
    await handleLogin(request, response);
    return;
  }

  if (request.method === "POST" && pathname === "/api/logout") {
    const user = currentUser(request);
    if (user) {
      db.deleteSession(user.token);
    }
    sendJson(response, 200, { ok: true }, { "Set-Cookie": clearSessionCookie() });
    return;
  }

  const user = currentUser(request);
  if (!user && !publicApiRoute(request.method, pathname)) {
    sendJson(response, 401, { error: "Login required." });
    return;
  }

  if (request.method === "GET" && pathname === "/api/devices") {
    const includeHidden = url.searchParams.get("includeHidden") === "1";
    sendJson(response, 200, {
      devices: db.listDevices({ includeHidden }).map(safeDevice),
    });
    return;
  }

  if (request.method === "POST" && pathname === "/api/devices") {
    const payload = await parseJsonBody(request);
    const desiredName = String(payload.name || payload.deviceId || "").trim();
    const probe = await loadDeviceInfo({
      deviceId: desiredName || `WF-RAC ${payload.ipAddress}`,
      ipAddress: payload.ipAddress,
      port: payload.port,
      protocol: payload.protocol,
      operatorId: payload.operatorId || makeOperatorId(),
      airconId: payload.airconId,
    });
    const saved = db.saveDevice({
      config: {
        ...probe.config,
        deviceId: desiredName || probe.config.deviceId,
      },
      info: probe.info,
      debug: probe.debug,
    });
    sendJson(response, 201, {
      device: safeDevice(saved),
      debug: probe.debug,
    });
    return;
  }

  if (request.method === "POST" && pathname === "/api/devices/scan") {
    const payload = await parseJsonBody(request);
    const visibleDevices = db.listDevices({ includeHidden: false });
    const discoveries = await discoverDevices({
      wideScan: visibleDevices.length === 0 || payload.wideScan === true,
    });
    sendJson(response, 200, {
      discoveries: discoveries.map(safeDevice),
      devices: db.listDevices({ includeHidden: false }).map(safeDevice),
    });
    return;
  }

  if (request.method === "POST" && pathname === "/api/devices/list") {
    const payload = await parseJsonBody(request);
    const devices = db.updateDeviceList(Array.isArray(payload.devices) ? payload.devices : []);
    const settings = db.saveAppSettings({
      title: payload.title,
    });
    sendJson(response, 200, {
      devices: devices.map(safeDevice),
      settings,
    });
    return;
  }

  const deviceAction = pathname.match(/^\/api\/devices\/(\d+)\/(status|apply|boost|register|sleep)$/);
  if (deviceAction) {
    const deviceId = Number.parseInt(deviceAction[1], 10);
    const action = deviceAction[2];
    if (request.method !== "POST") {
      sendText(response, 405, "Method not allowed.");
      return;
    }
    if (action === "status") {
      await handleDeviceStatus(deviceId, response);
      return;
    }
    if (action === "apply") {
      await handleDeviceApply(deviceId, request, response);
      return;
    }
    if (action === "boost") {
      await handleDeviceBoost(deviceId, request, response);
      return;
    }
    if (action === "sleep") {
      await handleDeviceSleep(deviceId, request, response);
      return;
    }
    if (action === "register") {
      await handleDeviceRegister(deviceId, response);
      return;
    }
  }

  sendText(response, 404, "Not found.");
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || `${HOST}:${PORT}`}`);
  const { pathname } = url;

  try {
    if (pathname.startsWith("/api/")) {
      await handleApi(request, response, pathname, url);
      return;
    }

    if (request.method === "GET") {
      serveStatic(response, pathname);
      return;
    }

    sendText(response, 405, "Method not allowed.");
  } catch (error) {
    sendError(response, 500, error);
  }
});

server.listen(PORT, HOST, () => {
  const shownHost = HOST === "0.0.0.0" ? "127.0.0.1" : HOST;
  process.stdout.write(`Smart Air is running at http://${shownHost}:${PORT}\n`);
  if (STATUS_POLL_INTERVAL_MS > 0) {
    setTimeout(() => {
      refreshVisibleDeviceCache().catch(() => {});
    }, Math.max(0, STATUS_POLL_START_DELAY_MS)).unref();
    setInterval(() => {
      refreshVisibleDeviceCache().catch(() => {});
    }, STATUS_POLL_INTERVAL_MS).unref();
  }
  if (SLEEP_TIMER_CHECK_INTERVAL_MS > 0) {
    setInterval(() => {
      runDueSleepTimers().catch(() => {});
      runDueBoostTimers().catch(() => {});
    }, SLEEP_TIMER_CHECK_INTERVAL_MS).unref();
    runDueSleepTimers().catch(() => {});
    runDueBoostTimers().catch(() => {});
  }
});

"use strict";

const { execFile } = require("node:child_process");
const { promisify } = require("node:util");

const REQUEST_GAP_MS = 1100;
const REQUEST_TIMEOUT_MS = 10000;
const execFileAsync = promisify(execFile);

const OUTDOOR_TEMP = [-50.0, -50.0, -50.0, -50.0, -50.0, -48.9, -46.0, -44.0, -42.0, -41.0, -39.0, -38.0, -37.0, -36.0, -35.0, -34.0, -33.0, -32.0, -31.0, -30.0, -29.0, -28.5, -28.0, -27.0, -26.0, -25.5, -25.0, -24.0, -23.5, -23.0, -22.5, -22.0, -21.5, -21.0, -20.5, -20.0, -19.5, -19.0, -18.5, -18.0, -17.5, -17.0, -16.5, -16.0, -15.5, -15.0, -14.6, -14.3, -14.0, -13.5, -13.0, -12.6, -12.3, -12.0, -11.5, -11.0, -10.6, -10.3, -10.0, -9.6, -9.3, -9.0, -8.6, -8.3, -8.0, -7.6, -7.3, -7.0, -6.6, -6.3, -6.0, -5.6, -5.3, -5.0, -4.6, -4.3, -4.0, -3.7, -3.5, -3.2, -3.0, -2.6, -2.3, -2.0, -1.7, -1.5, -1.2, -1.0, -0.6, -0.3, 0.0, 0.2, 0.5, 0.7, 1.0, 1.3, 1.6, 2.0, 2.2, 2.5, 2.7, 3.0, 3.2, 3.5, 3.7, 4.0, 4.2, 4.5, 4.7, 5.0, 5.2, 5.5, 5.7, 6.0, 6.2, 6.5, 6.7, 7.0, 7.2, 7.5, 7.7, 8.0, 8.2, 8.5, 8.7, 9.0, 9.2, 9.5, 9.7, 10.0, 10.2, 10.5, 10.7, 11.0, 11.2, 11.5, 11.7, 12.0, 12.2, 12.5, 12.7, 13.0, 13.2, 13.5, 13.7, 14.0, 14.2, 14.4, 14.6, 14.8, 15.0, 15.2, 15.5, 15.7, 16.0, 16.2, 16.5, 16.7, 17.0, 17.2, 17.5, 17.7, 18.0, 18.2, 18.5, 18.7, 19.0, 19.2, 19.4, 19.6, 19.8, 20.0, 20.2, 20.5, 20.7, 21.0, 21.2, 21.5, 21.7, 22.0, 22.2, 22.5, 22.7, 23.0, 23.2, 23.5, 23.7, 24.0, 24.2, 24.5, 24.7, 25.0, 25.2, 25.5, 25.7, 26.0, 26.2, 26.5, 26.7, 27.0, 27.2, 27.5, 27.7, 28.0, 28.2, 28.5, 28.7, 29.0, 29.2, 29.5, 29.7, 30.0, 30.2, 30.5, 30.7, 31.0, 31.3, 31.6, 32.0, 32.2, 32.5, 32.7, 33.0, 33.2, 33.5, 33.7, 34.0, 34.3, 34.6, 35.0, 35.2, 35.5, 35.7, 36.0, 36.3, 36.6, 37.0, 37.2, 37.5, 37.7, 38.0, 38.3, 38.6, 39.0, 39.3, 39.6, 40.0, 40.3, 40.6, 41.0, 41.3, 41.6, 42.0, 42.3, 42.6, 43.0];
const INDOOR_TEMP = [-30.0, -30.0, -30.0, -30.0, -30.0, -30.0, -30.0, -30.0, -30.0, -30.0, -30.0, -30.0, -30.0, -30.0, -30.0, -30.0, -29.0, -28.0, -27.0, -26.0, -25.0, -24.0, -23.0, -22.5, -22.0, -21.0, -20.0, -19.5, -19.0, -18.0, -17.5, -17.0, -16.5, -16.0, -15.0, -14.5, -14.0, -13.5, -13.0, -12.5, -12.0, -11.5, -11.0, -10.5, -10.0, -9.5, -9.0, -8.6, -8.3, -8.0, -7.5, -7.0, -6.5, -6.0, -5.6, -5.3, -5.0, -4.5, -4.0, -3.6, -3.3, -3.0, -2.6, -2.3, -2.0, -1.6, -1.3, -1.0, -0.5, 0.0, 0.3, 0.6, 1.0, 1.3, 1.6, 2.0, 2.3, 2.6, 3.0, 3.2, 3.5, 3.7, 4.0, 4.3, 4.6, 5.0, 5.3, 5.6, 6.0, 6.3, 6.6, 7.0, 7.2, 7.5, 7.7, 8.0, 8.3, 8.6, 9.0, 9.2, 9.5, 9.7, 10.0, 10.3, 10.6, 11.0, 11.2, 11.5, 11.7, 12.0, 12.3, 12.6, 13.0, 13.2, 13.5, 13.7, 14.0, 14.2, 14.5, 14.7, 15.0, 15.3, 15.6, 16.0, 16.2, 16.5, 16.7, 17.0, 17.2, 17.5, 17.7, 18.0, 18.2, 18.5, 18.7, 19.0, 19.2, 19.5, 19.7, 20.0, 20.2, 20.5, 20.7, 21.0, 21.2, 21.5, 21.7, 22.0, 22.2, 22.5, 22.7, 23.0, 23.2, 23.5, 23.7, 24.0, 24.2, 24.5, 24.7, 25.0, 25.2, 25.5, 25.7, 26.0, 26.2, 26.5, 26.7, 27.0, 27.2, 27.5, 27.7, 28.0, 28.2, 28.5, 28.7, 29.0, 29.2, 29.5, 29.7, 30.0, 30.2, 30.5, 30.7, 31.0, 31.3, 31.6, 32.0, 32.2, 32.5, 32.7, 33.0, 33.2, 33.5, 33.7, 34.0, 34.2, 34.5, 34.7, 35.0, 35.3, 35.6, 36.0, 36.2, 36.5, 36.7, 37.0, 37.2, 37.5, 37.7, 38.0, 38.3, 38.6, 39.0, 39.2, 39.5, 39.7, 40.0, 40.3, 40.6, 41.0, 41.2, 41.5, 41.7, 42.0, 42.3, 42.6, 43.0, 43.2, 43.5, 43.7, 44.0, 44.3, 44.6, 45.0, 45.3, 45.6, 46.0, 46.2, 46.5, 46.7, 47.0, 47.3, 47.6, 48.0, 48.3, 48.6, 49.0, 49.3, 49.6, 50.0, 50.3, 50.6, 51.0, 51.3, 51.6, 52.0];

const requestQueues = new Map();
const activeProtocols = new Map();
let nextRequestSequence = 0;

function deviceKey(config) {
  return `${config.ipAddress}:${config.port}`;
}

function normalizeConfig(rawConfig) {
  const config = rawConfig && typeof rawConfig === "object" ? rawConfig : {};
  const ipAddress = String(config.ipAddress || "").trim();
  if (!ipAddress) {
    throw new Error("Bitte zuerst die IP-Adresse eintragen.");
  }

  const protocol = config.protocol === "http" || config.protocol === "https"
    ? config.protocol
    : "auto";

  return {
    deviceId: String(config.deviceId || "browser").trim() || "browser",
    ipAddress,
    port: Number.parseInt(config.port, 10) || 51443,
    protocol,
    operatorId: String(config.operatorId || "").trim(),
    airconId: String(config.airconId || "").trim(),
  };
}

function withOperatorId(config) {
  return {
    ...config,
    operatorId: config.operatorId || makeOperatorId(),
  };
}

function hasLegacyOperatorId(value) {
  return /^web-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || "").trim());
}

function makeOperatorId() {
  return `web-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function commandPriority(command) {
  if (command === "setAirconStat") {
    return 10;
  }
  if (command === "updateAccountInfo") {
    return 5;
  }
  return 0;
}

function runNextQueuedRequest(key) {
  const queue = requestQueues.get(key);
  if (!queue || queue.running) {
    return;
  }

  const entry = queue.items.shift();
  if (!entry) {
    requestQueues.delete(key);
    return;
  }

  queue.running = true;
  (async () => {
    try {
      await sleep(REQUEST_GAP_MS);
      entry.resolve(await entry.task());
    } catch (error) {
      entry.reject(error);
    } finally {
      queue.running = false;
      if (queue.items.length) {
        queueMicrotask(() => runNextQueuedRequest(key));
      } else {
        requestQueues.delete(key);
      }
    }
  })();
}

function enqueue(config, task, options = {}) {
  const key = deviceKey(config);
  let queue = requestQueues.get(key);
  if (!queue) {
    queue = {
      items: [],
      running: false,
    };
    requestQueues.set(key, queue);
  }

  return new Promise((resolve, reject) => {
    queue.items.push({
      priority: Number.isFinite(options.priority) ? options.priority : 0,
      reject,
      resolve,
      sequence: nextRequestSequence += 1,
      task,
    });
    queue.items.sort((left, right) => right.priority - left.priority || left.sequence - right.sequence);
    runNextQueuedRequest(key);
  });
}

function buildRequestBody(config, command, contents = null) {
  const body = {
    apiVer: "1.0",
    command,
    deviceId: config.deviceId,
    operatorId: config.operatorId,
    timestamp: Math.floor(Date.now() / 1000),
  };
  if (contents) {
    body.contents = contents;
  }
  return body;
}

async function sendDeviceRequest(protocol, config, command, body) {
  const bodyText = JSON.stringify(body);
  const url = `${protocol}://${config.ipAddress}:${config.port}/beaver/command/${command}`;
  const args = [
    "--silent",
    "--show-error",
    "--include",
    "--request", "POST",
    "--header", "Accept: */*",
    "--header", "Connection: close",
    "--header", "Content-Type: application/json; charset=utf-8",
    "--header", "User-Agent: smartmair_app[1.4.005]",
    "--data", bodyText,
    "--max-time", String(Math.ceil(REQUEST_TIMEOUT_MS / 1000)),
  ];

  if (protocol === "https") {
    args.push("--insecure", "--http1.1", "--tlsv1.2");
  }

  args.push(url);

  try {
    const { stdout } = await execFileAsync("curl", args, {
      maxBuffer: 1024 * 1024,
    });
    const separator = stdout.indexOf("\r\n\r\n") >= 0 ? "\r\n\r\n" : "\n\n";
    const splitIndex = stdout.lastIndexOf(separator);
    const headerBlock = splitIndex >= 0 ? stdout.slice(0, splitIndex) : "";
    const text = splitIndex >= 0 ? stdout.slice(splitIndex + separator.length) : stdout;
    const statusLine = headerBlock.split(/\r?\n/).filter(Boolean)[0] || "";
    const statusMatch = statusLine.match(/^HTTP\/\S+\s+(\d{3})/);
    const statusCode = statusMatch ? Number.parseInt(statusMatch[1], 10) : 0;

    if (!statusCode || statusCode < 200 || statusCode >= 300) {
      throw new Error(`HTTP ${statusCode || 502}: ${text || "Fehler"}`);
    }
    if (!text) {
      throw new Error("Leere Antwort vom WF-RAC.");
    }

    return JSON.parse(text);
  } catch (error) {
    const stderr = error && error.stderr ? String(error.stderr).trim() : "";
    const stdout = error && error.stdout ? String(error.stdout).trim() : "";
    if (stdout) {
      const separator = stdout.indexOf("\r\n\r\n") >= 0 ? "\r\n\r\n" : "\n\n";
      const splitIndex = stdout.lastIndexOf(separator);
      const bodyTextOut = splitIndex >= 0 ? stdout.slice(splitIndex + separator.length) : stdout;
      const headerBlock = splitIndex >= 0 ? stdout.slice(0, splitIndex) : "";
      const statusLine = headerBlock.split(/\r?\n/).filter(Boolean)[0] || "";
      const statusMatch = statusLine.match(/^HTTP\/\S+\s+(\d{3})/);
      if (statusMatch) {
        throw new Error(`HTTP ${statusMatch[1]}: ${bodyTextOut || stderr || "Fehler"}`);
      }
    }
    throw new Error(stderr || String(error && error.message ? error.message : error));
  }
}

async function callDevice(rawConfig, command, contents = null) {
  return callDeviceInternal(withOperatorId(normalizeConfig(rawConfig)), command, contents, true);
}

async function callDeviceInternal(config, command, contents, allowOperatorIdRetry) {
  const body = buildRequestBody(config, command, contents);
  const key = deviceKey(config);
  const protocols = config.protocol === "auto"
    ? (activeProtocols.get(key) ? [activeProtocols.get(key), activeProtocols.get(key) === "https" ? "http" : "https"] : ["https", "http"])
    : [config.protocol];

  let lastError = null;
  for (const protocol of protocols) {
    try {
      const response = await enqueue(
        config,
        () => sendDeviceRequest(protocol, config, command, body),
        { priority: commandPriority(command) }
      );
      activeProtocols.set(key, protocol);
      return { config: { ...config, protocol }, response };
    } catch (error) {
      lastError = error;
      if (config.protocol !== "auto") {
        break;
      }
    }
  }

  if (allowOperatorIdRetry && hasLegacyOperatorId(config.operatorId) && lastError && String(lastError.message || lastError).includes("Not supported this command")) {
    return callDeviceInternal({
      ...config,
      operatorId: makeOperatorId(),
    }, command, contents, false);
  }

  throw lastError || new Error("Keine Antwort vom WF-RAC.");
}

function ensureOk(data, command) {
  if (!data || data.result !== 0) {
    throw new Error(`${command} fehlgeschlagen: ${JSON.stringify(data)}`);
  }
}

function hasAirconStat(data) {
  return Boolean(data && data.contents && data.contents.airconStat);
}

async function loadDeviceInfo(rawConfig) {
  const config = withOperatorId(normalizeConfig(rawConfig));
  try {
    const result = await callDevice(config, "getDeviceInfo");
    ensureOk(result.response, "getDeviceInfo");
    const airconId = result.response.contents && result.response.contents.airconId;
    if (!airconId) {
      throw new Error("Keine Aircon ID gefunden.");
    }
    return {
      config: { ...result.config, airconId },
      info: result.response.contents,
      debug: result.response,
    };
  } catch (error) {
    const fallback = await callDevice(config, "getAirconStat");
    const contents = fallback.response && fallback.response.contents;
    if (!contents || !contents.airconId) {
      throw error;
    }
    return {
      config: { ...fallback.config, airconId: contents.airconId },
      info: {
        airconId: contents.airconId,
        firmType: contents.firmType,
        mcu: contents.mcu,
        wireless: contents.wireless,
      },
      debug: {
        fallback: "getAirconStat",
        reason: String(error && error.message ? error.message : error),
        response: fallback.response,
      },
    };
  }
}

async function registerRemote(rawConfig) {
  let config = withOperatorId(normalizeConfig(rawConfig));
  if (!config.airconId) {
    const info = await loadDeviceInfo(config);
    config = info.config;
  }

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Berlin";
  const result = await callDevice(config, "updateAccountInfo", {
    accountId: config.operatorId,
    airconId: config.airconId,
    remote: 0,
    timezone,
  });

  if (result.response && result.response.result === 2) {
    throw new Error("Das Geraet hat bereits die maximale Zahl registrierter Remotes erreicht.");
  }

  return {
    config: result.config,
    debug: result.response,
  };
}

async function refreshStatus(rawConfig) {
  let config = withOperatorId(normalizeConfig(rawConfig));
  if (!config.airconId) {
    const info = await loadDeviceInfo(config);
    config = info.config;
  }

  let result = await callDevice(config, "getAirconStat", { airconId: config.airconId });
  if (!hasAirconStat(result.response) && config.airconId) {
    result = await callDevice(config, "getAirconStat");
  }
  if (!hasAirconStat(result.response)) {
    ensureOk(result.response, "getAirconStat");
  }

  return {
    config: { ...result.config, airconId: result.response.contents.airconId || config.airconId },
    status: DeviceStatus.fromBase64(result.response.contents.airconStat),
    debug: result.response,
  };
}

async function applyStatus(rawConfig, nextStatus, options = {}) {
  const config = withOperatorId(normalizeConfig(rawConfig));
  if (!config.airconId) {
    throw new Error("Bitte zuerst Info laden, damit die Aircon ID bekannt ist.");
  }

  const status = {
    ...defaultStatus(),
    ...(nextStatus && typeof nextStatus === "object" ? nextStatus : {}),
  };

  if (options.forceOff) {
    status.operation = false;
  }

  const result = await callDevice(config, "setAirconStat", {
    airconId: config.airconId,
    airconStat: DeviceStatus.toBase64(status),
  });
  if (!hasAirconStat(result.response)) {
    ensureOk(result.response, "setAirconStat");
  }

  return {
    config: { ...result.config, airconId: result.response.contents.airconId || config.airconId },
    status: DeviceStatus.fromBase64(result.response.contents.airconStat),
    debug: result.response,
  };
}

function defaultStatus() {
  return {
    airFlow: 0,
    coolHotJudge: true,
    electric: 0,
    entrust: false,
    errorCode: "00",
    indoorTemp: null,
    isSelfCleanOperation: false,
    isSelfCleanReset: false,
    isVacantProperty: 0,
    modelNo: 0,
    operation: false,
    operationMode: 1,
    outdoorTemp: null,
    presetTemp: 22,
    windDirectionLR: 0,
    windDirectionUD: 0,
  };
}

class DeviceStatus {
  static fromBase64(base64) {
    const bytes = base64ToBytes(String(base64 || "").replace(/\s/g, ""));
    const dataStart = bytes[18] * 4 + 21;
    const data = bytes.slice(dataStart, bytes.length - 2);
    const status = defaultStatus();

    const findMatch = (value, posVals, offset = 0) => {
      const index = posVals.indexOf(value);
      return index === -1 ? -1 : index + offset;
    };

    status.operation = (data[2] & 3) === 1;
    status.presetTemp = data[4] / 2;
    status.operationMode = findMatch(data[2] & 60, [8, 16, 12, 4], 1);
    if (status.operationMode === -1 && (data[2] & 60) === 0) {
      status.operationMode = 0;
    }
    status.airFlow = findMatch(data[3] & 15, [7, 0, 1, 2, 6]);
    status.windDirectionUD = (data[2] & 192) === 64
      ? 0
      : findMatch(data[3] & 240, [0, 16, 32, 48], 1);
    status.windDirectionLR = (data[12] & 3) === 1
      ? 0
      : findMatch(data[11] & 31, [0, 1, 2, 3, 4, 5, 6], 1);
    status.entrust = (data[12] & 12) === 4;
    status.coolHotJudge = (data[8] & 8) <= 0;
    status.modelNo = findMatch(data[0] & 127, [0, 1, 2]);
    status.isVacantProperty = data[10] & 1;

    const code = data[6] & 127;
    if (code === 0) {
      status.errorCode = "00";
    } else if ((data[6] & 128) <= 0) {
      status.errorCode = `M${String(code).padStart(2, "0")}`;
    } else {
      status.errorCode = `E${code}`;
    }

    for (let index = dataStart + 19; index < bytes.length - 2; index += 4) {
      const marker = bytes[index];
      const kind = bytes[index + 1];
      const value = bytes[index + 2];
      const value2 = bytes[index + 3];
      if (marker === 128 && kind === 16) {
        status.outdoorTemp = OUTDOOR_TEMP[value] ?? null;
      }
      if (marker === 128 && kind === 32) {
        status.indoorTemp = INDOOR_TEMP[value] ?? null;
      }
      if (marker === 148 && kind === 16) {
        status.electric = (((value2 << 8) | value) >>> 0) * 0.25;
      }
    }

    return status;
  }

  static toBase64(status) {
    const command = buildFrame(commandToBytes(status));
    const receive = buildFrame(receiveToBytes(status));
    return bytesToBase64(command.concat(receive));
  }
}

function buildFrame(payload) {
  const framed = payload.concat([1, 255, 255, 255, 255]);
  const crc = crc16ccitt(framed);
  return framed.concat([crc & 255, (crc >> 8) & 255]);
}

function commandToBytes(status) {
  const bytes = new Array(18).fill(0);
  bytes[5] = 255;

  bytes[2] |= status.operation ? 3 : 2;

  if (status.operationMode === 0) bytes[2] |= 32;
  else if (status.operationMode === 1) bytes[2] |= 40;
  else if (status.operationMode === 2) bytes[2] |= 48;
  else if (status.operationMode === 3) bytes[2] |= 44;
  else if (status.operationMode === 4) bytes[2] |= 36;

  if (status.airFlow === 0) bytes[3] |= 15;
  else if (status.airFlow === 1) bytes[3] |= 8;
  else if (status.airFlow === 2) bytes[3] |= 9;
  else if (status.airFlow === 3) bytes[3] |= 10;
  else if (status.airFlow === 4) bytes[3] |= 14;

  if (status.windDirectionUD === 0) {
    bytes[2] |= 192;
    bytes[3] |= 128;
  } else if (status.windDirectionUD === 1) {
    bytes[2] |= 128;
    bytes[3] |= 128;
  } else if (status.windDirectionUD === 2) {
    bytes[2] |= 128;
    bytes[3] |= 144;
  } else if (status.windDirectionUD === 3) {
    bytes[2] |= 128;
    bytes[3] |= 160;
  } else if (status.windDirectionUD === 4) {
    bytes[2] |= 128;
    bytes[3] |= 176;
  }

  if (status.windDirectionLR === 0) {
    bytes[12] |= 3;
    bytes[11] |= 16;
  } else if (status.windDirectionLR >= 1 && status.windDirectionLR <= 7) {
    bytes[12] |= 2;
    bytes[11] |= 15 + status.windDirectionLR;
  }

  const presetTemp = status.operationMode !== 3 && status.presetTemp !== null
    ? status.presetTemp
    : 25.0;
  bytes[4] |= Math.floor(presetTemp / 0.5) + 128;
  bytes[12] |= status.entrust ? 12 : 8;

  if (status.modelNo === 1) {
    bytes[10] |= status.isVacantProperty ? 1 : 0;
  }
  if (status.modelNo === 1 || status.modelNo === 2) {
    bytes[10] |= status.isSelfCleanReset ? 4 : 0;
    bytes[10] |= status.isSelfCleanOperation ? 144 : 128;
  }

  return bytes;
}

function receiveToBytes(status) {
  const bytes = new Array(18).fill(0);
  bytes[5] = 255;

  if (status.operation) {
    bytes[2] |= 1;
  }

  if (status.operationMode === 1) bytes[2] |= 8;
  else if (status.operationMode === 2) bytes[2] |= 16;
  else if (status.operationMode === 3) bytes[2] |= 12;
  else if (status.operationMode === 4) bytes[2] |= 4;

  if (status.airFlow === 0) bytes[3] |= 7;
  else if (status.airFlow === 2) bytes[3] |= 1;
  else if (status.airFlow === 3) bytes[3] |= 2;
  else if (status.airFlow === 4) bytes[3] |= 6;

  if (status.windDirectionUD === 0) bytes[2] |= 64;
  else if (status.windDirectionUD === 2) bytes[3] |= 16;
  else if (status.windDirectionUD === 3) bytes[3] |= 32;
  else if (status.windDirectionUD === 4) bytes[3] |= 48;

  if (status.windDirectionLR === 0) bytes[12] |= 1;
  else if (status.windDirectionLR >= 1 && status.windDirectionLR <= 7) bytes[11] |= status.windDirectionLR - 1;

  const presetTemp = status.operationMode !== 3 && status.presetTemp !== null
    ? status.presetTemp
    : 25.0;
  bytes[4] |= Math.floor(presetTemp / 0.5);

  if (status.entrust) {
    bytes[12] |= 4;
  }
  if (!status.coolHotJudge) {
    bytes[8] |= 8;
  }
  if (status.modelNo === 1) {
    bytes[0] |= 1;
    bytes[10] |= status.isVacantProperty ? 1 : 0;
  } else if (status.modelNo === 2) {
    bytes[0] |= 2;
  }
  if (status.modelNo === 1 || status.modelNo === 2) {
    bytes[15] |= status.isSelfCleanOperation ? 1 : 0;
  }

  return bytes;
}

function crc16ccitt(data) {
  let crc = 65535;
  for (const byte of data) {
    for (let bit = 0; bit < 8; bit += 1) {
      const bitSet = ((byte >> (7 - bit)) & 1) === 1;
      const carry = ((crc >> 15) & 1) === 1;
      crc <<= 1;
      if (bitSet !== carry) {
        crc ^= 4129;
      }
    }
  }
  return crc & 65535;
}

function base64ToBytes(base64) {
  return Array.from(Buffer.from(base64, "base64"));
}

function bytesToBase64(bytes) {
  return Buffer.from(bytes).toString("base64");
}

module.exports = {
  applyStatus,
  defaultStatus,
  loadDeviceInfo,
  normalizeConfig,
  refreshStatus,
  registerRemote,
};

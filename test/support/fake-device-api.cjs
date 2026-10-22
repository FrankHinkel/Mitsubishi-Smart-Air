"use strict";

// Test preload only: no requests are ever sent to real climate devices.
const fs = require("node:fs");
const path = require("node:path");
const api = require("../../device-api");
const statePath = process.env.MOCK_DEVICE_STATE;
if (!statePath) throw new Error("MOCK_DEVICE_STATE is required for the fake driver.");

function read(config) {
  const all = JSON.parse(fs.readFileSync(statePath, "utf8"));
  const device = all[config.ipAddress];
  if (!device) throw new Error("Unknown simulated device");
  return { all, device };
}

function reply(config, device, result = 0) {
  return {
    config, status: { ...api.defaultStatus(), ...device.status },
    debug: { result, contents: { airconId: config.airconId, remoteList: [], firmType: "FAKE" } },
  };
}

api.refreshStatus = async (config) => {
  const { device } = read(config);
  if (device.failRead) throw new Error("Simulated device unreachable");
  return reply(config, device);
};

api.applyStatus = async (config, status, options = {}) => {
  const { all, device } = read(config);
  if (device.failWrite) return reply(config, device, 12);
  const next = { ...status, outdoorTemp: device.status.outdoorTemp };
  if (options.forceOff) next.operation = false;
  if (!device.ignoreWrite) device.status = next;
  const temporary = `${statePath}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(all));
  fs.renameSync(temporary, statePath);
  fs.appendFileSync(path.join(path.dirname(statePath), "writes.jsonl"), `${JSON.stringify({ ip: config.ipAddress, status: next })}\n`);
  return reply(config, device.echoWrite ? { ...device, status: next } : device);
};

api.loadDeviceInfo = async (config) => {
  const { device } = read(config);
  return { ...reply(config, device), info: { airconId: config.airconId, firmType: "FAKE" } };
};
api.registerRemote = async (config) => ({ config, debug: { result: 0 } });

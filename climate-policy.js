"use strict";

const SEASON_MODES = Object.freeze(["manual", "off", "summer", "auto", "winter"]);
const OUTDOOR_MAX_AGE_MS = 5 * 60 * 1000;

function seasonPolicy(mode, devices, now = Date.now()) {
  const samples = devices.filter((device) => !device.hidden)
    .filter((device) => {
      const age = now - Date.parse(device.lastSeenAt);
      return Number.isFinite(age) && age >= -30000 && age <= OUTDOOR_MAX_AGE_MS;
    })
    .map((device) => device.status && device.status.outdoorTemp)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  const mid = Math.floor(samples.length / 2);
  const outdoorTemp = samples.length
    ? (samples.length % 2 ? samples[mid] : (samples[mid - 1] + samples[mid]) / 2)
    : null;
  let restriction = "none";
  if (mode === "off") restriction = "off";
  if (mode === "summer") restriction = "cool";
  if (mode === "winter") restriction = "heat";
  if (mode === "auto") {
    restriction = outdoorTemp === null ? "unavailable"
      : outdoorTemp < 18 ? "heat"
        : outdoorTemp > 22 ? "cool" : "both";
  }
  const allowedModes = restriction === "off" ? []
    : restriction === "cool" ? [1, 3, 4]
      : restriction === "heat" ? [2, 3, 4] : [0, 1, 2, 3, 4];
  return { mode, restriction, outdoorTemp, sourceCount: samples.length, allowedModes };
}

// Never start a stopped device. Fan and Dry remain available except in Off.
function correctedStatus(status, policy) {
  if (policy.restriction === "off") return { ...status, operation: false };
  if (!status.operation) return { ...status };
  const mode = Number(status.operationMode);
  if ([0, 1, 2].includes(mode)) {
    if (policy.restriction === "cool") return { ...status, operationMode: 1 };
    if (policy.restriction === "heat") return { ...status, operationMode: 2 };
  }
  return { ...status };
}

function needsCorrection(status, policy) {
  const corrected = correctedStatus(status, policy);
  return corrected.operation !== status.operation
    || corrected.operationMode !== status.operationMode;
}

module.exports = { SEASON_MODES, OUTDOOR_MAX_AGE_MS, seasonPolicy, correctedStatus, needsCorrection };

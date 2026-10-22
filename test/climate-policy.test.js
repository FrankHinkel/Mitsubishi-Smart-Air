"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { seasonPolicy, correctedStatus, needsCorrection, OUTDOOR_MAX_AGE_MS } = require("../climate-policy");

const now = Date.parse("2026-10-22T12:00:00Z");
const device = (outdoorTemp, age = 0, extra = {}) => ({
  lastSeenAt: new Date(now - age).toISOString(), status: { outdoorTemp }, ...extra,
});
const state = { operation: true, operationMode: 2, presetTemp: 23.5, airFlow: 2, windDirectionUD: 3 };

test("Auto uses exact outside-temperature boundaries; 18 and 22 allow both", () => {
  for (const [temperature, restriction] of [[-10, "heat"], [17.9, "heat"], [18, "both"], [20, "both"], [22, "both"], [22.1, "cool"]]) {
    assert.equal(seasonPolicy("auto", [device(temperature)], now).restriction, restriction);
  }
});

test("only fresh, numeric, visible observations determine the median", () => {
  const policy = seasonPolicy("auto", [device(17), device(19), device(80, 0, { hidden: true }),
    device(-20, OUTDOOR_MAX_AGE_MS + 1), device(null), device("40"), device(100, -60000)], now);
  assert.equal(policy.outdoorTemp, 18);
  assert.equal(policy.sourceCount, 2);
  assert.equal(policy.restriction, "both");
  assert.equal(seasonPolicy("auto", [device(16), device(17), device(30)], now).outdoorTemp, 17);
  assert.equal(seasonPolicy("auto", [device(null)], now).restriction, "unavailable");
});

test("summer/winter correct Heat, Cool and native Auto, preserving other settings", () => {
  for (const [mode, wanted] of [["summer", 1], ["winter", 2]]) {
    const policy = seasonPolicy(mode, [], now);
    for (const operationMode of [0, 1, 2]) {
      assert.deepEqual(correctedStatus({ ...state, operationMode }, policy), { ...state, operationMode: wanted });
    }
    for (const operationMode of [3, 4]) {
      assert.equal(needsCorrection({ ...state, operationMode }, policy), false);
    }
  }
});

test("manual and Auto without data do not interfere; no policy starts a stopped device", () => {
  for (const mode of ["manual", "auto"]) {
    assert.deepEqual(correctedStatus(state, seasonPolicy(mode, [], now)), state);
  }
  for (const mode of ["manual", "off", "auto", "winter", "summer"]) {
    const stopped = { ...state, operation: false };
    assert.deepEqual(correctedStatus(stopped, seasonPolicy(mode, [device(10)], now)), stopped);
  }
});

test("Off stops even Fan and Dry, without changing the setpoint", () => {
  for (const operationMode of [0, 1, 2, 3, 4]) {
    assert.deepEqual(correctedStatus({ ...state, operationMode }, seasonPolicy("off", [], now)),
      { ...state, operationMode, operation: false });
  }
});

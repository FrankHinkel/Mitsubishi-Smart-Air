"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const { spawn } = require("node:child_process");

test("persisted season settings and real HTTP routes enforce policy with a simulated IR remote", { timeout: 90000 }, async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "smart-air-season-"));
  process.env.DATA_DIR = directory;
  process.env.DB_PATH = path.join(directory, "app.sqlite");
  process.env.DEFAULT_ADMIN_USERNAME = "tester";
  process.env.DEFAULT_ADMIN_PASSWORD = "test-only-password";
  const db = require("../database");
  const { defaultStatus } = require("../device-api");
  db.initDatabase();
  const addresses = ["192.0.2.10", "192.0.2.11"];
  const fakePath = path.join(directory, "devices.json");
  let remote = Object.fromEntries(addresses.map((ip) => [ip, { status: {
    ...defaultStatus(), operation: false, operationMode: 1, outdoorTemp: 20, presetTemp: 23.5,
  } }]));
  function persistRemote() {
    const temporary = `${fakePath}.parent.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(remote));
    fs.renameSync(temporary, fakePath);
  }
  function externalChange(patch, index = 0, flags = {}) {
    remote = JSON.parse(fs.readFileSync(fakePath, "utf8"));
    Object.assign(remote[addresses[index]], flags);
    Object.assign(remote[addresses[index]].status, patch);
    persistRemote();
  }
  persistRemote();
  const devices = addresses.map((ipAddress, index) => db.saveDevice({ config: {
    ipAddress, deviceId: `Test climate ${index + 1}`, port: 51443, protocol: "http",
    operatorId: `test-operator-${index}`, airconId: `fake${index}`,
  }, status: remote[ipAddress].status }));
  let child;
  let base;
  let cookie;
  let errors = "";
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  async function stop() {
    if (!child || child.exitCode !== null) return;
    const closed = new Promise((resolve) => child.once("exit", resolve));
    child.kill("SIGTERM");
    await closed;
  }
  t.after(async () => { await stop(); fs.rmSync(directory, { recursive: true, force: true }); });
  async function request(route, body, auth = true) {
    const response = await fetch(`${base}${route}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { "Content-Type": "application/json", ...(auth && cookie ? { Cookie: cookie } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = await response.json();
    return { response, data };
  }
  async function start(pollInterval = 0) {
    const socket = net.createServer();
    await new Promise((resolve) => socket.listen(0, "127.0.0.1", resolve));
    const port = socket.address().port;
    await new Promise((resolve) => socket.close(resolve));
    base = `http://127.0.0.1:${port}`;
    child = spawn(process.execPath, ["--require", path.join(__dirname, "support/fake-device-api.cjs"), path.join(__dirname, "../server.js")], {
      env: { ...process.env, MOCK_DEVICE_STATE: fakePath, HOST: "127.0.0.1", PORT: String(port),
        MEASURES_DIR: path.join(directory, "measures"), STATUS_POLL_INTERVAL_MS: String(pollInterval),
        STATUS_POLL_START_DELAY_MS: "0", SLEEP_TIMER_CHECK_INTERVAL_MS: "100" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stderr.on("data", (data) => { errors += data; });
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      if (child.exitCode !== null) throw new Error(`Test server failed: ${errors}`);
      try { await request("/api/health"); ready = true; break; } catch {}
      await delay(50);
    }
    assert.ok(ready, errors || "Server did not start");
    const login = await request("/api/login", { username: "tester", password: "test-only-password" }, false);
    assert.equal(login.response.status, 200);
    cookie = login.response.headers.get("set-cookie").split(";")[0];
  }
  const setMode = async (seasonMode) => {
    const result = await request("/api/settings", { seasonMode });
    assert.equal(result.response.status, 200, JSON.stringify(result.data));
    return result.data;
  };
  const readStatus = async (index = 0) => {
    const result = await request(`/api/devices/${devices[index].id}/status`, {});
    assert.equal(result.response.status, 200, JSON.stringify(result.data));
    return result.data;
  };
  await start();

  await t.test("legacy installations start in Manual; unauthorized and invalid changes are rejected", async () => {
    assert.equal((await request("/api/settings")).data.settings.seasonMode, "manual");
    assert.equal((await request("/api/settings", { seasonMode: "off" }, false)).response.status, 401);
    assert.equal((await request("/api/settings", { seasonMode: "invalid" })).response.status, 400);
    externalChange({ operation: true, operationMode: 2 });
    assert.equal((await readStatus()).device.status.operationMode, 2);
    assert.ok(!fs.existsSync(path.join(directory, "writes.jsonl")));
  });

  await t.test("Summer corrects an IR Heat/Auto selection and preserves setpoint; stopped units remain stopped", async () => {
    const data = await setMode("summer");
    assert.equal(data.devices[0].status.operationMode, 1);
    assert.equal(data.devices[0].status.presetTemp, 23.5);
    assert.equal(data.devices[1].status.operation, false);
    for (const operationMode of [2, 0]) {
      externalChange({ operation: true, operationMode });
      assert.equal((await readStatus()).device.status.operationMode, 1);
      const attempted = await request(`/api/devices/${devices[0].id}/apply`, {
        status: { operation: true, operationMode },
      });
      assert.equal(attempted.response.status, 200);
      assert.equal(attempted.data.device.status.operationMode, 1);
    }
    await request("/api/devices/list", { devices: devices.map((d) => ({ ...d })), title: "Test title" });
    assert.equal((await request("/api/settings")).data.settings.seasonMode, "summer");
  });

  await t.test("Winter corrects cooling, but preserves Fan and Dry", async () => {
    externalChange({ operation: true, operationMode: 1 });
    assert.equal((await setMode("winter")).devices[0].status.operationMode, 2);
    for (const operationMode of [3, 4]) {
      externalChange({ operation: true, operationMode });
      assert.equal((await readStatus()).device.status.operationMode, operationMode);
    }
  });

  await t.test("Auto follows actual outside readings at both exact boundaries", async () => {
    for (const [outside, requestedMode, expectedMode] of [[17.9, 1, 2], [18, 1, 1], [18, 2, 2], [22, 2, 2], [22.1, 2, 1], [10, 0, 2]]) {
      externalChange({ operation: true, operationMode: requestedMode, outdoorTemp: outside });
      externalChange({ outdoorTemp: outside }, 1);
      const data = await setMode("auto");
      assert.equal(data.policy.outdoorTemp, outside);
      assert.equal(data.devices[0].status.operationMode, expectedMode);
    }
    externalChange({ outdoorTemp: null, operationMode: 1 });
    externalChange({ outdoorTemp: null }, 1);
    const data = await setMode("auto");
    assert.equal(data.policy.restriction, "unavailable");
    assert.equal(data.devices[0].status.operationMode, 1);
  });

  await t.test("rejected corrections remain visible as errors and recover after the device accepts writes", async () => {
    await setMode("manual");
    externalChange({ operation: true, operationMode: 2 }, 0, { failWrite: true });
    const data = await setMode("summer");
    assert.equal(data.devices[0].status.operationMode, 2);
    assert.equal(data.policy.errors.length, 1);
    externalChange({}, 0, { failWrite: false });
    const recovered = await readStatus();
    assert.equal(recovered.device.status.operationMode, 1);
    assert.equal(recovered.policy.errors.length, 0);
  });

  await t.test("a successful write acknowledgement is checked against a fresh device read", async () => {
    await setMode("manual");
    externalChange({ operation: true, operationMode: 2 }, 0, { ignoreWrite: true, echoWrite: true });
    const data = await setMode("summer");
    assert.equal(data.devices[0].status.operationMode, 2);
    assert.equal(data.policy.errors.length, 1);
    assert.match(data.policy.errors[0].message, /bestätigt/);
    externalChange({}, 0, { ignoreWrite: false, echoWrite: false });
    assert.equal((await readStatus()).device.status.operationMode, 1);
  });

  await t.test("Off cancels Sleep/Boost, blocks API starts and corrects a remote Fan start", async () => {
    await setMode("manual");
    externalChange({ operation: true, operationMode: 1 });
    await readStatus();
    assert.equal((await request(`/api/devices/${devices[0].id}/boost`, { minutes: 5 })).response.status, 200);
    assert.equal((await request(`/api/devices/${devices[0].id}/sleep`, { hours: 1 })).response.status, 200);
    const data = await setMode("off");
    assert.equal(data.devices[0].status.operation, false);
    assert.equal(data.devices[0].boostTimer, null);
    assert.equal(data.devices[0].sleepTimer, null);
    const attempted = await request(`/api/devices/${devices[0].id}/apply`, { status: { operation: true } });
    assert.equal(attempted.data.device.status.operation, false);
    assert.equal((await request(`/api/devices/${devices[0].id}/boost`, { minutes: 5 })).response.status, 409);
    assert.equal((await request(`/api/devices/${devices[0].id}/sleep`, { hours: 1 })).response.status, 409);
    externalChange({ operation: true, operationMode: 3 });
    assert.equal((await readStatus()).device.status.operation, false);
  });

  await t.test("boost from a stopped device restores Off; due restore obeys the new season mode", async () => {
    await setMode("manual");
    externalChange({ operation: false, operationMode: 1, outdoorTemp: 20 });
    await readStatus();
    const boosted = await request(`/api/devices/${devices[0].id}/boost`, { minutes: 5 });
    assert.equal(boosted.data.device.boostTimer.restoreStatus.operation, false);
    const cancelled = await request(`/api/devices/${devices[0].id}/boost`, { minutes: 0 });
    assert.equal(cancelled.data.device.status.operation, false);
    externalChange({ operation: true, operationMode: 2 });
    await readStatus();
    await request(`/api/devices/${devices[0].id}/boost`, { minutes: 5 });
    await setMode("summer");
    db.setDeviceBoostTimer(devices[0].id, new Date(Date.now() - 1000).toISOString(), { ...defaultStatus(), operation: true, operationMode: 2 });
    for (let i = 0; i < 60 && db.getDevice(devices[0].id).boostTimer; i++) await delay(50);
    assert.equal(db.getDevice(devices[0].id).boostTimer, null);
    assert.equal(db.getDevice(devices[0].id).status.operationMode, 1);
  });

  await t.test("settings survive a server restart and periodic enforcement works with no browser", async () => {
    await setMode("winter");
    await stop();
    externalChange({ operation: true, operationMode: 1 });
    await start(250);
    assert.equal((await request("/api/settings")).data.settings.seasonMode, "winter");
    let actual;
    for (let i = 0; i < 100; i++) {
      actual = JSON.parse(fs.readFileSync(fakePath, "utf8"))[addresses[0]].status;
      if (actual.operationMode === 2) break;
      await delay(50);
    }
    assert.equal(actual.operationMode, 2);
    await setMode("manual");
    externalChange({ operation: true, operationMode: 1 });
    await delay(700);
    assert.equal(JSON.parse(fs.readFileSync(fakePath, "utf8"))[addresses[0]].status.operationMode, 1);
  });
});

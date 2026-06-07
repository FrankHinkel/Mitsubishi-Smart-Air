"use strict";

const MODE_OPTIONS = [
  { value: 0, label: "Auto", icon: "sun-snow" },
  { value: 1, label: "Cool", icon: "snowflake" },
  { value: 2, label: "Heat", icon: "sun" },
  { value: 3, label: "Fan", icon: "fan" },
  { value: 4, label: "Dry", icon: "droplets" },
];
const FAN_OPTIONS = [
  { value: 0, label: "Auto", icon: "fan", badge: "A" },
  { value: 1, label: "Quiet", icon: "fan", badge: "1" },
  { value: 2, label: "Low", icon: "fan", badge: "2" },
  { value: 3, label: "High", icon: "fan", badge: "3" },
  { value: 4, label: "Powerful", icon: "fan", badge: "4" },
];
const SLEEP_OPTIONS = [
  { hours: null, label: "--" },
  { hours: 1, label: "1h" },
  { hours: 2, label: "2h" },
  { hours: 3, label: "3h" },
  { hours: 4, label: "4h" },
  { hours: 8, label: "8h" },
  { hours: 12, label: "12h" },
];
const BOOST_OPTIONS = [
  { minutes: 5, label: "5" },
  { minutes: 10, label: "10" },
  { minutes: 15, label: "15" },
  { minutes: 30, label: "30" },
];
const TEMP_MIN = 18;
const TEMP_MAX = 30;
const TEMP_STEP = 0.5;
const DEVICE_WRITE_DELAY_MS = 1400;
const STATUS_POLL_INTERVAL_MS = 60000;
const DEFAULT_APP_TITLE = "Smart Air";
const UI_SCALE_KEY = "smart-air-ui-scale";
const UI_SCALE_MIN = 0.5;
const UI_SCALE_MAX = 2;
const UI_SCALE_STEP = 0.1;

const LUCIDE_ICON_NODES = {
  "refresh-cw": [
    ["path", { d: "M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" }],
    ["path", { d: "M21 3v5h-5" }],
    ["path", { d: "M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" }],
    ["path", { d: "M8 16H3v5" }],
  ],
  pencil: [
    ["path", { d: "M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" }],
    ["path", { d: "m15 5 4 4" }],
  ],
  "log-out": [
    ["path", { d: "m16 17 5-5-5-5" }],
    ["path", { d: "M21 12H9" }],
    ["path", { d: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" }],
  ],
  "zoom-in": [
    ["circle", { cx: "11", cy: "11", r: "8" }],
    ["line", { x1: "21", x2: "16.65", y1: "21", y2: "16.65" }],
    ["line", { x1: "11", x2: "11", y1: "8", y2: "14" }],
    ["line", { x1: "8", x2: "14", y1: "11", y2: "11" }],
  ],
  "zoom-out": [
    ["circle", { cx: "11", cy: "11", r: "8" }],
    ["line", { x1: "21", x2: "16.65", y1: "21", y2: "16.65" }],
    ["line", { x1: "8", x2: "14", y1: "11", y2: "11" }],
  ],
  thermometer: [
    ["path", { d: "M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z" }],
  ],
  power: [
    ["path", { d: "M12 2v10" }],
    ["path", { d: "M18.4 6.6a9 9 0 1 1-12.77.04" }],
  ],
  "biceps-flexed": [
    ["path", { d: "M12.409 13.017A5 5 0 0 1 22 15c0 3.866-4 7-9 7-4.077 0-8.153-.82-10.371-2.462-.426-.316-.631-.832-.62-1.362C2.118 12.723 2.627 2 10 2a3 3 0 0 1 3 3 2 2 0 0 1-2 2c-1.105 0-1.64-.444-2-1" }],
    ["path", { d: "M15 14a5 5 0 0 0-7.584 2" }],
    ["path", { d: "M9.964 6.825C8.019 7.977 9.5 13 8 15" }],
  ],
  house: [
    ["path", { d: "M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" }],
    ["path", { d: "M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" }],
  ],
  "bed-single": [
    ["path", { d: "M3 20v-8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8" }],
    ["path", { d: "M5 10V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4" }],
    ["path", { d: "M3 18h18" }],
  ],
  "sun-snow": [
    ["path", { d: "M10 21v-1" }],
    ["path", { d: "M10 4V3" }],
    ["path", { d: "M10 9a3 3 0 0 0 0 6" }],
    ["path", { d: "m14 20 1.25-2.5L18 18" }],
    ["path", { d: "m14 4 1.25 2.5L18 6" }],
    ["path", { d: "m17 21-3-6 1.5-3H22" }],
    ["path", { d: "m17 3-3 6 1.5 3" }],
    ["path", { d: "M2 12h1" }],
    ["path", { d: "m20 10-1.5 2 1.5 2" }],
    ["path", { d: "m3.64 18.36.7-.7" }],
    ["path", { d: "m4.34 6.34-.7-.7" }],
  ],
  snowflake: [
    ["path", { d: "m10 20-1.25-2.5L6 18" }],
    ["path", { d: "M10 4 8.75 6.5 6 6" }],
    ["path", { d: "m14 20 1.25-2.5L18 18" }],
    ["path", { d: "m14 4 1.25 2.5L18 6" }],
    ["path", { d: "m17 21-3-6h-4" }],
    ["path", { d: "m17 3-3 6 1.5 3" }],
    ["path", { d: "M2 12h6.5L10 9" }],
    ["path", { d: "m20 10-1.5 2 1.5 2" }],
    ["path", { d: "M22 12h-6.5L14 15" }],
    ["path", { d: "m4 10 1.5 2L4 14" }],
    ["path", { d: "m7 21 3-6-1.5-3" }],
    ["path", { d: "m7 3 3 6h4" }],
  ],
  sun: [
    ["circle", { cx: "12", cy: "12", r: "4" }],
    ["path", { d: "M12 2v2" }],
    ["path", { d: "M12 20v2" }],
    ["path", { d: "m4.93 4.93 1.41 1.41" }],
    ["path", { d: "m17.66 17.66 1.41 1.41" }],
    ["path", { d: "M2 12h2" }],
    ["path", { d: "M20 12h2" }],
    ["path", { d: "m6.34 17.66-1.41 1.41" }],
    ["path", { d: "m19.07 4.93-1.41 1.41" }],
  ],
  fan: [
    ["path", { d: "M10.827 16.379a6.082 6.082 0 0 1-8.618-7.002l5.412 1.45a6.082 6.082 0 0 1 7.002-8.618l-1.45 5.412a6.082 6.082 0 0 1 8.618 7.002l-5.412-1.45a6.082 6.082 0 0 1-7.002 8.618l1.45-5.412Z" }],
    ["path", { d: "M12 12v.01" }],
  ],
  droplets: [
    ["path", { d: "M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z" }],
    ["path", { d: "M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97" }],
  ],
};

const els = {
  appTitleInput: document.querySelector("#appTitleInput"),
  appView: document.querySelector("#appView"),
  brandTitle: document.querySelector("#brandTitle"),
  closeEditButton: document.querySelector("#closeEditButton"),
  deviceList: document.querySelector("#deviceList"),
  editList: document.querySelector("#editList"),
  editListButton: document.querySelector("#editListButton"),
  editPanel: document.querySelector("#editPanel"),
  emptyManualButton: document.querySelector("#emptyManualButton"),
  emptyScanButton: document.querySelector("#emptyScanButton"),
  emptyState: document.querySelector("#emptyState"),
  globalMessage: document.querySelector("#globalMessage"),
  loginButton: document.querySelector("#loginButton"),
  loginError: document.querySelector("#loginError"),
  loginForm: document.querySelector("#loginForm"),
  loginPassword: document.querySelector("#loginPassword"),
  loginTitle: document.querySelector("#loginTitle"),
  loginUsername: document.querySelector("#loginUsername"),
  loginView: document.querySelector("#loginView"),
  logoutButton: document.querySelector("#logoutButton"),
  manualAddButton: document.querySelector("#manualAddButton"),
  manualAddForm: document.querySelector("#manualAddForm"),
  manualIpAddress: document.querySelector("#manualIpAddress"),
  manualName: document.querySelector("#manualName"),
  manualPort: document.querySelector("#manualPort"),
  manualProtocol: document.querySelector("#manualProtocol"),
  outdoorSummary: document.querySelector("#outdoorSummary"),
  refreshAllButton: document.querySelector("#refreshAllButton"),
  rescanEditButton: document.querySelector("#rescanEditButton"),
  saveListButton: document.querySelector("#saveListButton"),
  zoomInButton: document.querySelector("#zoomInButton"),
  zoomMenu: document.querySelector("#zoomMenu"),
  zoomMenuButton: document.querySelector("#zoomMenuButton"),
  zoomOutButton: document.querySelector("#zoomOutButton"),
  zoomValue: document.querySelector("#zoomValue"),
};

let devices = [];
let allDevices = [];
let editItems = [];
let editOpen = false;
let appSettings = {
  title: DEFAULT_APP_TITLE,
};
const deviceErrors = new Map();
const pendingDeviceWrites = new Map();
let statusPollTimer = null;
let countdownTimer = null;
let lastPointerScroll = {
  at: 0,
  x: 0,
  y: 0,
};
let lastScrollAt = 0;
let stableScroll = {
  x: 0,
  y: 0,
};
let stableScrollTimer = null;
let uiScale = 1;

function createElement(tag, options = {}) {
  const element = document.createElement(tag);
  if (options.className) {
    element.className = options.className;
  }
  if (options.text !== undefined) {
    element.textContent = options.text;
  }
  if (options.hidden !== undefined) {
    element.hidden = Boolean(options.hidden);
  }
  return element;
}

function createLucideIcon(name, extraClassName = "") {
  const nodes = LUCIDE_ICON_NODES[name];
  if (!nodes) {
    return createElement("span", { className: extraClassName, text: "?" });
  }

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", ["lucide-icon", extraClassName].filter(Boolean).join(" "));

  for (const [tag, attributes] of nodes) {
    const child = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [key, value] of Object.entries(attributes)) {
      child.setAttribute(key, value);
    }
    svg.append(child);
  }

  return svg;
}

function setButtonIcon(button, iconName, label) {
  if (!button) {
    return;
  }
  button.setAttribute("aria-label", label);
  button.setAttribute("title", label);
  button.replaceChildren(createLucideIcon(iconName, "button-icon"));
}

function normalizeUiScale(value) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    return 1;
  }
  const stepped = Math.round(parsed / UI_SCALE_STEP) * UI_SCALE_STEP;
  return Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, Number(stepped.toFixed(1))));
}

function readStoredUiScale() {
  try {
    return normalizeUiScale(window.localStorage.getItem(UI_SCALE_KEY));
  } catch {
    return 1;
  }
}

function updateZoomControls() {
  if (els.zoomValue) {
    els.zoomValue.textContent = `${Math.round(uiScale * 100)}%`;
  }
  if (els.zoomOutButton) {
    els.zoomOutButton.disabled = uiScale <= UI_SCALE_MIN;
  }
  if (els.zoomInButton) {
    els.zoomInButton.disabled = uiScale >= UI_SCALE_MAX;
  }
  if (els.zoomMenuButton) {
    els.zoomMenuButton.setAttribute("aria-label", `Page zoom ${Math.round(uiScale * 100)} percent`);
    els.zoomMenuButton.setAttribute("title", `Page zoom ${Math.round(uiScale * 100)}%`);
  }
}

function scaledUiFactor(weight = 1) {
  return Number((1 + (uiScale - 1) * weight).toFixed(2));
}

function applyUiScale(nextScale, options = {}) {
  uiScale = normalizeUiScale(nextScale);
  document.documentElement.style.setProperty("--ui-text-scale", String(scaledUiFactor(1)));
  document.documentElement.style.setProperty("--ui-icon-scale", String(scaledUiFactor(0.8)));
  document.documentElement.style.setProperty("--ui-control-scale", String(scaledUiFactor(0.45)));
  updateZoomControls();
  if (options.persist !== false) {
    try {
      window.localStorage.setItem(UI_SCALE_KEY, String(uiScale));
    } catch {
      // Ignore local persistence issues.
    }
  }
}

function changeUiScale(delta) {
  applyUiScale(uiScale + delta);
}

function currentStableScrollSnapshot() {
  const useStableScroll = performance.now() - lastScrollAt < 180;
  return {
    at: performance.now(),
    x: useStableScroll ? stableScroll.x : window.scrollX,
    y: useStableScroll ? stableScroll.y : window.scrollY,
  };
}

function rememberPointerScroll(element = null) {
  lastPointerScroll = currentStableScrollSnapshot();
  if (element) {
    element.scrollSnapshot = lastPointerScroll;
  }
  return lastPointerScroll;
}

document.addEventListener("pointerdown", () => {
  rememberPointerScroll();
}, { capture: true });

window.addEventListener("scroll", () => {
  lastScrollAt = performance.now();
  if (stableScrollTimer) {
    clearTimeout(stableScrollTimer);
  }
  stableScrollTimer = setTimeout(() => {
    stableScroll = {
      x: window.scrollX,
      y: window.scrollY,
    };
  }, 180);
}, { passive: true });

document.addEventListener("click", (event) => {
  if (!event.target.closest(".symbol-menu")) {
    closeOpenMenus();
  }
});

async function apiFetch(path, options = {}) {
  const init = {
    credentials: "same-origin",
    cache: "no-store",
    ...options,
  };

  if (init.body && typeof init.body !== "string") {
    init.headers = {
      "Accept": "application/json",
      "Content-Type": "application/json; charset=utf-8",
      ...(init.headers || {}),
    };
    init.body = JSON.stringify(init.body);
  } else {
    init.headers = {
      "Accept": "application/json",
      ...(init.headers || {}),
    };
  }

  const response = await fetch(path, init);
  const text = await response.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(text);
    }
  }

  if (!response.ok) {
    if (response.status === 401 && path !== "/api/login") {
      showLogin();
    }
    throw new Error(data.error || `HTTP ${response.status}`);
  }

  return data;
}

function friendlyError(error) {
  const message = String(error && error.message ? error.message : error);
  if (message.includes("maximale Zahl registrierter Remotes")) {
    return "This device has reached the maximum number of registered remotes.";
  }
  if (message.includes("Not supported this command")) {
    return "The device firmware does not support this command.";
  }
  if (message.includes("packet length too long") || message.includes("EPROTO")) {
    return "Protocol mismatch. Try scanning again or switch the device to HTTP.";
  }
  if (message.includes("Timeout") || message.includes("timed out")) {
    return "No response from the air conditioner.";
  }
  if (message.includes("Aircon ID") || message.includes("Info laden")) {
    return "The device is missing its Aircon ID. Scan or refresh it first.";
  }
  return message;
}

function setMessage(message = "", kind = "") {
  els.globalMessage.textContent = message;
  els.globalMessage.className = `message ${kind}`.trim();
  els.globalMessage.hidden = !message;
}

function setLoginError(message = "") {
  els.loginError.textContent = message;
  els.loginError.hidden = !message;
}

function showLogin() {
  els.loginView.hidden = false;
  els.appView.hidden = true;
  setMessage("");
}

function showApp() {
  els.loginView.hidden = true;
  els.appView.hidden = false;
}

function defaultStatus() {
  return {
    airFlow: 0,
    electric: 0,
    entrust: false,
    errorCode: "00",
    indoorTemp: null,
    operation: false,
    operationMode: 1,
    outdoorTemp: null,
    presetTemp: 22,
    windDirectionLR: 0,
    windDirectionUD: 0,
  };
}

function normalizeAppTitle(value) {
  const title = String(value || "").trim();
  return title || DEFAULT_APP_TITLE;
}

function applyAppSettings(settings = {}) {
  appSettings = {
    ...appSettings,
    title: normalizeAppTitle(settings.title),
  };
  document.title = appSettings.title;
  if (els.loginTitle) {
    els.loginTitle.textContent = appSettings.title;
  }
  if (els.brandTitle) {
    els.brandTitle.textContent = appSettings.title;
  }
  if (els.appTitleInput && document.activeElement !== els.appTitleInput) {
    els.appTitleInput.value = appSettings.title;
  }
}

function modeTone(status) {
  if (!status.operation) {
    return "off";
  }

  if (Number(status.operationMode) === 1) {
    return "cool";
  }
  if (Number(status.operationMode) === 2) {
    return "heat";
  }
  if (Number(status.operationMode) === 3) {
    return "fan";
  }
  if (Number(status.operationMode) === 4) {
    return "dry";
  }
  return "auto";
}

function statusOf(device) {
  return {
    ...defaultStatus(),
    ...(device && device.status ? device.status : {}),
  };
}

function clampToStep(value, min, max, step) {
  const clamped = Math.min(max, Math.max(min, value));
  return Math.round(clamped / step) * step;
}

function normalizeTemp(value) {
  return clampToStep(Number.parseFloat(value) || 22, TEMP_MIN, TEMP_MAX, TEMP_STEP);
}

function formatTemp(value) {
  return Number.isFinite(value) ? `${value.toFixed(1)} C` : "--";
}

function formatUsage(value) {
  return Number.isFinite(value) && value > 0 ? `${value.toFixed(1)} kWh` : "--";
}

function findOption(options, value) {
  return options.find((option) => Number(option.value) === Number(value)) || options[0];
}

function formatCountdown(milliseconds) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function sleepCountdownText(device) {
  const timer = device && device.sleepTimer;
  if (!timer || !timer.until) {
    return "--";
  }

  if (timer.lastError && !timer.nextAttemptAt) {
    return "Failed";
  }

  const now = Date.now();
  const untilTime = Date.parse(timer.until);
  if (Number.isFinite(untilTime) && untilTime > now) {
    return formatCountdown(untilTime - now);
  }

  const nextAttemptTime = Date.parse(timer.nextAttemptAt || "");
  if (Number.isFinite(nextAttemptTime) && nextAttemptTime > now) {
    return `Retry ${formatCountdown(nextAttemptTime - now)}`;
  }

  return "Due";
}

function sleepSummaryText(device) {
  return sleepCountdownText(device);
}

function boostModeAvailable(status) {
  return Number(status.operationMode) === 1 || Number(status.operationMode) === 2;
}

function buildBoostStatus(status) {
  if (Number(status.operationMode) === 1) {
    return {
      ...status,
      airFlow: 4,
      operation: true,
      presetTemp: TEMP_MIN,
    };
  }
  if (Number(status.operationMode) === 2) {
    return {
      ...status,
      airFlow: 4,
      operation: true,
      presetTemp: TEMP_MAX,
    };
  }
  return status;
}

function boostCountdownText(device) {
  const timer = device && device.boostTimer;
  if (!timer || !timer.until) {
    return "--";
  }

  if (timer.lastError && !timer.nextAttemptAt) {
    return "Failed";
  }

  const now = Date.now();
  const untilTime = Date.parse(timer.until);
  if (Number.isFinite(untilTime) && untilTime > now) {
    return formatCountdown(untilTime - now);
  }

  const nextAttemptTime = Date.parse(timer.nextAttemptAt || "");
  if (Number.isFinite(nextAttemptTime) && nextAttemptTime > now) {
    return `Retry ${formatCountdown(nextAttemptTime - now)}`;
  }

  return "Due";
}

function boostSummaryText(device) {
  return boostCountdownText(device);
}

function formatLastSeen(device) {
  if (!device || !device.lastSeenAt) {
    return "Not refreshed yet";
  }
  const date = new Date(device.lastSeenAt);
  if (Number.isNaN(date.getTime())) {
    return "Not refreshed yet";
  }
  return `Last seen ${date.toLocaleString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    day: "numeric",
  })}`;
}

function renderOutdoorSummary() {
  if (!els.outdoorSummary) {
    return;
  }
  const deviceWithOutdoor = devices.find((device) => Number.isFinite(statusOf(device).outdoorTemp));
  const text = deviceWithOutdoor
    ? formatTemp(statusOf(deviceWithOutdoor).outdoorTemp)
    : "--";
  els.outdoorSummary.replaceChildren(
    createLucideIcon("house", "summary-icon"),
    createElement("span", { className: "summary-label", text })
  );
}

function scrollSnapshot(element = null) {
  if (element && element.scrollSnapshot && performance.now() - element.scrollSnapshot.at < 1200) {
    return {
      x: element.scrollSnapshot.x,
      y: element.scrollSnapshot.y,
    };
  }
  if (performance.now() - lastPointerScroll.at < 1200) {
    return {
      x: lastPointerScroll.x,
      y: lastPointerScroll.y,
    };
  }
  return {
    x: window.scrollX,
    y: window.scrollY,
  };
}

function restoreScroll(snapshot) {
  window.scrollTo(snapshot.x, snapshot.y);
  requestAnimationFrame(() => window.scrollTo(snapshot.x, snapshot.y));
  setTimeout(() => window.scrollTo(snapshot.x, snapshot.y), 0);
  setTimeout(() => window.scrollTo(snapshot.x, snapshot.y), 80);
}

function guardedControlClick(element, handler) {
  return (event) => {
    event.preventDefault();
    const scroll = scrollSnapshot(element);
    element.blur();
    handler(event, scroll);
    restoreScroll(scroll);
  };
}

function preventPointerFocusScroll(element) {
  element.addEventListener("pointerdown", (event) => {
    rememberPointerScroll(element);
    event.preventDefault();
  }, { passive: false });
}

function updateButtons(isBusy) {
  [
    els.refreshAllButton,
    els.editListButton,
    els.logoutButton,
    els.emptyManualButton,
    els.emptyScanButton,
    els.manualAddButton,
    els.rescanEditButton,
    els.saveListButton,
  ].forEach((button) => {
    if (button) {
      button.disabled = Boolean(isBusy);
    }
  });
}

function replaceDevice(updatedDevice) {
  devices = devices.map((device) => device.id === updatedDevice.id ? updatedDevice : device)
    .filter((device) => !device.hidden);
  allDevices = allDevices.map((device) => device.id === updatedDevice.id ? updatedDevice : device);
  if (!devices.some((device) => device.id === updatedDevice.id) && !updatedDevice.hidden) {
    devices.push(updatedDevice);
    devices.sort(compareDevices);
  }
}

function compareDevices(left, right) {
  return (left.sortOrder || 0) - (right.sortOrder || 0)
    || String(left.name || "").localeCompare(String(right.name || ""), "en")
    || left.id - right.id;
}

function renderFact(label, value) {
  const item = createElement("div", { className: "fact" });
  item.append(
    createElement("span", { text: label }),
    createElement("strong", { text: value })
  );
  return item;
}

function closeOpenMenus(except = null) {
  document.querySelectorAll(".popup-menu").forEach((menu) => {
    if (menu !== except) {
      menu.hidden = true;
    }
  });
}

function renderOptionVisual(option, extraClassName = "") {
  const visual = createElement("span", { className: ["symbol-visual", extraClassName].filter(Boolean).join(" ") });
  if (option.icon) {
    visual.append(createLucideIcon(option.icon, "symbol-visual-icon"));
  }
  if (option.badge || option.symbol) {
    visual.append(createElement("span", {
      className: "symbol-visual-badge",
      text: option.badge || option.symbol,
    }));
  }
  return visual;
}

function renderSymbolMenu(label, value, options, onSelect) {
  const selected = findOption(options, value);
  const wrapper = createElement("div", { className: "symbol-menu" });
  const trigger = createElement("button", { className: `symbol-trigger${selected.icon || selected.badge || selected.symbol ? " has-icon" : ""}` });
  trigger.type = "button";
  trigger.setAttribute("aria-label", `${label}: ${selected.label}`);
  if (selected.icon || selected.badge || selected.symbol) {
    trigger.append(renderOptionVisual(selected, "trigger-visual"));
  } else {
    trigger.textContent = selected.symbol;
  }
  preventPointerFocusScroll(trigger);
  const menu = createElement("div", { className: "popup-menu", hidden: true });
  trigger.addEventListener("click", guardedControlClick(trigger, (event, scroll) => {
    const shouldOpen = menu.hidden;
    closeOpenMenus(menu);
    menu.hidden = !shouldOpen;
    restoreScroll(scroll);
  }));
  for (const option of options) {
    const button = createElement("button", { className: Number(option.value) === Number(value) ? "selected" : "" });
    button.type = "button";
    if (option.icon || option.badge || option.symbol) {
      const content = createElement("span", { className: "menu-option-content" });
      content.append(
        renderOptionVisual(option, "menu-option-visual"),
        createElement("span", { className: "menu-option-label", text: option.label })
      );
      button.append(content);
    } else {
      button.textContent = option.label;
    }
    preventPointerFocusScroll(button);
    button.addEventListener("click", guardedControlClick(button, () => {
      menu.hidden = true;
      onSelect(option.value);
    }));
    menu.append(button);
  }
  wrapper.append(trigger, menu);
  return wrapper;
}

function renderSleepMenu(device) {
  const wrapper = createElement("div", { className: "symbol-menu sleep-menu" });
  const trigger = createElement("button", { className: "symbol-trigger has-icon sleep-trigger" });
  trigger.type = "button";
  trigger.setAttribute("aria-label", `Sleep timer for ${device.name}: ${sleepSummaryText(device)}`);
  trigger.append(
    createLucideIcon("bed-single", "trigger-icon"),
    createElement("span", {
      className: "sleep-trigger-label",
      text: sleepSummaryText(device),
    })
  );
  trigger.querySelector(".sleep-trigger-label").dataset.sleepCountdown = String(device.id);
  preventPointerFocusScroll(trigger);
  const menu = createElement("div", { className: "popup-menu timer-options", hidden: true });
  trigger.addEventListener("click", guardedControlClick(trigger, (event, scroll) => {
    const shouldOpen = menu.hidden;
    closeOpenMenus(menu);
    menu.hidden = !shouldOpen;
    restoreScroll(scroll);
  }));
  for (const option of SLEEP_OPTIONS) {
    const button = createElement("button", { text: option.label });
    button.type = "button";
    preventPointerFocusScroll(button);
    button.addEventListener("click", guardedControlClick(button, () => {
      menu.hidden = true;
      setSleepTimer(device.id, option.hours).catch(() => {});
    }));
    menu.append(button);
  }
  wrapper.append(trigger, menu);
  return wrapper;
}

function renderBoostMenu(device) {
  const status = statusOf(device);
  const wrapper = createElement("div", { className: "symbol-menu boost-menu" });
  const trigger = createElement("button", { className: "symbol-trigger has-icon boost-trigger" });
  trigger.type = "button";
  trigger.setAttribute("aria-label", `Boost for ${device.name}: ${boostSummaryText(device)}`);
  trigger.disabled = !boostModeAvailable(status);
  trigger.append(
    createLucideIcon("biceps-flexed", "trigger-icon"),
    createElement("span", {
      className: "boost-trigger-label",
      text: boostSummaryText(device),
    })
  );
  trigger.querySelector(".boost-trigger-label").dataset.boostCountdown = String(device.id);
  preventPointerFocusScroll(trigger);
  const menu = createElement("div", { className: "popup-menu timer-options", hidden: true });
  trigger.addEventListener("click", guardedControlClick(trigger, (event, scroll) => {
    const shouldOpen = menu.hidden;
    closeOpenMenus(menu);
    menu.hidden = !shouldOpen;
    restoreScroll(scroll);
  }));
  for (const option of BOOST_OPTIONS) {
    const button = createElement("button", { text: option.label });
    button.type = "button";
    preventPointerFocusScroll(button);
    button.addEventListener("click", guardedControlClick(button, () => {
      menu.hidden = true;
      setBoostTimer(device.id, option.minutes).catch(() => {});
    }));
    menu.append(button);
  }
  wrapper.append(trigger, menu);
  return wrapper;
}

function renderDeviceCard(device) {
  const status = statusOf(device);
  const card = createElement("article", { className: "device-card" });
  card.dataset.modeTone = modeTone(status);

  const header = createElement("header", { className: "device-header" });
  const titleBlock = createElement("div", { className: "device-title" });
  const titleLine = createElement("div", { className: "device-title-line" });
  const title = createElement("h2", { text: device.name || `WF-RAC ${device.ipAddress}` });
  titleLine.append(title);
  if (Number.isFinite(status.indoorTemp)) {
    const inlineTemp = createElement("span", { className: "device-inline-temp" });
    const inlineTempValue = createElement("span", {
      className: "device-inline-temp-value",
      text: formatTemp(status.indoorTemp),
    });
    inlineTemp.append(
      createLucideIcon("thermometer", "device-inline-temp-icon"),
      inlineTempValue
    );
    titleLine.append(inlineTemp);
  }
  titleBlock.append(titleLine);

  const headerActions = createElement("div", { className: "device-header-actions" });
  const powerButton = createElement("button", {
    className: `power-button${status.operation ? " is-on" : ""}`,
  });
  powerButton.type = "button";
  powerButton.setAttribute("aria-label", `${status.operation ? "Turn off" : "Turn on"} ${device.name}`);
  powerButton.append(createLucideIcon("power", "power-button-icon"));
  preventPointerFocusScroll(powerButton);
  powerButton.addEventListener("click", guardedControlClick(powerButton, () => {
    queueDevicePatch(device.id, { operation: !status.operation });
  }));

  headerActions.append(renderBoostMenu(device), powerButton);
  header.append(titleBlock, headerActions);

  const facts = createElement("div", { className: "device-facts" });
  if (Number.isFinite(status.electric) && status.electric > 0) {
    facts.append(renderFact("Usage", formatUsage(status.electric)));
  }
  if (status.errorCode && status.errorCode !== "00") {
    facts.append(renderFact("Error", status.errorCode));
  }

  const controls = createElement("div", { className: "compact-controls" });
  const tempControl = createElement("div", { className: "temp-control" });
  const tempDown = createElement("button", { className: "step-button", text: "-" });
  tempDown.type = "button";
  preventPointerFocusScroll(tempDown);
  tempDown.setAttribute("aria-label", `Lower ${device.name} temperature`);
  tempDown.addEventListener("click", guardedControlClick(tempDown, () => {
    changeTemperature(device.id, -TEMP_STEP);
  }));
  const tempValue = createElement("output", { text: formatTemp(normalizeTemp(status.presetTemp)) });
  const tempUp = createElement("button", { className: "step-button", text: "+" });
  tempUp.type = "button";
  preventPointerFocusScroll(tempUp);
  tempUp.setAttribute("aria-label", `Raise ${device.name} temperature`);
  tempUp.addEventListener("click", guardedControlClick(tempUp, () => {
    changeTemperature(device.id, TEMP_STEP);
  }));
  tempControl.append(tempDown, tempValue, tempUp);

  controls.append(
    tempControl,
    renderSymbolMenu("Mode", status.operationMode, MODE_OPTIONS, (value) => {
      queueDevicePatch(device.id, { operationMode: value });
    }),
    renderSymbolMenu("Fan", status.airFlow, FAN_OPTIONS, (value) => {
      queueDevicePatch(device.id, { airFlow: value });
    }),
    renderSleepMenu(device)
  );

  card.append(header, facts, controls);
  const error = deviceErrors.get(device.id);
  if (error) {
    card.append(createElement("p", { className: "device-error", text: error }));
  }
  if (device.sleepTimer && device.sleepTimer.lastError && !device.sleepTimer.nextAttemptAt) {
    card.append(createElement("p", { className: "device-error", text: `Sleep timer failed: ${device.sleepTimer.lastError}` }));
  }
  if (device.boostTimer && device.boostTimer.lastError && !device.boostTimer.nextAttemptAt) {
    card.append(createElement("p", { className: "device-error", text: `Boost failed: ${device.boostTimer.lastError}` }));
  }
  return card;
}

function renderDevices() {
  const scroll = scrollSnapshot();
  devices.sort(compareDevices);
  els.deviceList.hidden = editOpen;
  els.emptyState.hidden = editOpen || devices.length > 0;
  els.deviceList.replaceChildren(...devices.map(renderDeviceCard));
  renderOutdoorSummary();
  updateCountdownDisplays();
  restoreScroll(scroll);
}

function renderEditRow(item, index) {
  const row = createElement("article", { className: item.hidden ? "edit-row is-hidden" : "edit-row" });
  const order = createElement("div", { className: "order-buttons" });
  const up = createElement("button", { className: "icon-lite", text: "Up" });
  const down = createElement("button", { className: "icon-lite", text: "Down" });
  up.type = "button";
  down.type = "button";
  up.disabled = index === 0;
  down.disabled = index === editItems.length - 1;
  up.addEventListener("click", () => moveEditItem(index, -1));
  down.addEventListener("click", () => moveEditItem(index, 1));
  order.append(up, down);

  const nameLabel = createElement("label", { className: "edit-name" });
  nameLabel.append(createElement("span", { text: "Name" }));
  const nameInput = document.createElement("input");
  nameInput.value = item.name || "";
  nameInput.addEventListener("input", () => {
    item.name = nameInput.value;
  });
  nameLabel.append(nameInput);

  const meta = createElement("p", {
    className: "edit-meta",
    text: [
      `${item.ipAddress}:${item.port || 51443}`,
      formatLastSeen(item),
      item.macAddress || "",
    ].filter(Boolean).join(" - "),
  });

  const hideLabel = createElement("label", { className: "check-row" });
  const hiddenInput = document.createElement("input");
  hiddenInput.type = "checkbox";
  hiddenInput.checked = Boolean(item.hidden);
  hiddenInput.addEventListener("change", () => {
    item.hidden = hiddenInput.checked;
    renderEditList();
  });
  hideLabel.append(hiddenInput, createElement("span", { text: "Hidden" }));

  const details = createElement("div", { className: "edit-details" });
  details.append(nameLabel, meta);
  row.append(order, details, hideLabel);
  return row;
}

function renderEditList() {
  editItems.sort(compareDevices);
  if (!editItems.length) {
    els.editList.replaceChildren(createElement("p", {
      className: "empty-copy",
      text: "No devices in the database yet. Add one manually above or use Scan below.",
    }));
    return;
  }
  els.editList.replaceChildren(...editItems.map(renderEditRow));
}

function moveEditItem(index, delta) {
  const nextIndex = index + delta;
  if (nextIndex < 0 || nextIndex >= editItems.length) {
    return;
  }
  const next = [...editItems];
  const [item] = next.splice(index, 1);
  next.splice(nextIndex, 0, item);
  editItems = next.map((device, itemIndex) => ({
    ...device,
    sortOrder: (itemIndex + 1) * 10,
  }));
  renderEditList();
}

async function loadDevices(options = {}) {
  const query = options.includeHidden ? "?includeHidden=1" : "";
  const data = await apiFetch(`/api/devices${query}`);
  const nextDevices = Array.isArray(data.devices) ? data.devices : [];
  if (options.includeHidden) {
    allDevices = nextDevices;
  } else {
    devices = nextDevices.filter((device) => !device.hidden);
  }
  renderDevices();
  return nextDevices;
}

async function scanDevices(options = {}) {
  updateButtons(true);
  setMessage("Scanning network...", "info");
  try {
    const data = await apiFetch("/api/devices/scan", {
      method: "POST",
      body: {
        wideScan: options.wideScan === true,
      },
    });
    devices = Array.isArray(data.devices) ? data.devices.filter((device) => !device.hidden) : [];
    if (!devices.length) {
      setMessage("No air conditioners were found.", "info");
    } else {
      setMessage("");
    }
    renderDevices();
    if (devices.length) {
      startStatusPolling();
    }
    if (editOpen) {
      await openEditList();
    }
  } catch (error) {
    setMessage(friendlyError(error), "error");
  } finally {
    updateButtons(false);
  }
}

function resetManualAddForm() {
  if (!els.manualAddForm) {
    return;
  }
  els.manualAddForm.reset();
  els.manualPort.value = "51443";
  els.manualProtocol.value = "auto";
}

async function addManualDevice(event) {
  event.preventDefault();
  updateButtons(true);
  setMessage("Adding device...", "info");
  try {
    const data = await apiFetch("/api/devices", {
      method: "POST",
      body: {
        name: els.manualName.value.trim(),
        ipAddress: els.manualIpAddress.value.trim(),
        port: Number.parseInt(els.manualPort.value, 10) || 51443,
        protocol: els.manualProtocol.value,
      },
    });
    await loadDevices();
    if (editOpen) {
      await openEditList();
    }
    if (devices.length) {
      startStatusPolling();
    }
    resetManualAddForm();
    setMessage(`Added ${data.device && data.device.name ? data.device.name : "device"}.`, "info");
  } catch (error) {
    setMessage(friendlyError(error), "error");
  } finally {
    updateButtons(false);
  }
}

async function refreshDevice(deviceId, options = {}) {
  try {
    const data = await apiFetch(`/api/devices/${deviceId}/status`, {
      method: "POST",
      body: {},
    });
    if (data.device) {
      applyServerDevice(data.device, pendingDeviceWrites.has(deviceId));
      deviceErrors.delete(deviceId);
    }
  } catch (error) {
    if (options.showErrors) {
      deviceErrors.set(deviceId, friendlyError(error));
    }
    throw error;
  } finally {
    renderDevices();
  }
}

async function refreshAllDevices(options = {}) {
  if (!devices.length) {
    if (options.allowScan) {
      await scanDevices({ wideScan: true });
    }
    return;
  }

  let failures = 0;
  for (const device of [...devices]) {
    try {
      await refreshDevice(device.id, {
        showErrors: Boolean(options.showErrors),
      });
    } catch {
      failures += 1;
    }
  }
  if (options.showErrors) {
    setMessage(failures ? "Some devices could not be refreshed." : "", failures ? "error" : "");
  }
}

function stopStatusPolling() {
  if (statusPollTimer) {
    clearInterval(statusPollTimer);
    statusPollTimer = null;
  }
}

function startStatusPolling() {
  stopStatusPolling();
  statusPollTimer = setInterval(() => {
    refreshAllDevices().catch(() => {});
  }, STATUS_POLL_INTERVAL_MS);
}

function hasQueuedPatch(entry) {
  return Boolean(entry && (Object.keys(entry.patch).length > 0 || entry.forceOff));
}

function applyServerDevice(updatedDevice, preserveLocalStatus = false) {
  if (!preserveLocalStatus) {
    replaceDevice(updatedDevice);
    return;
  }

  const local = devices.find((device) => device.id === updatedDevice.id);
  replaceDevice({
    ...updatedDevice,
    status: local ? statusOf(local) : updatedDevice.status,
  });
}

function queueDevicePatch(deviceId, statusPatch, options = {}) {
  const current = devices.find((device) => device.id === deviceId);
  if (!current) {
    return;
  }

  let entry = pendingDeviceWrites.get(deviceId);
  if (!entry) {
    entry = {
      forceOff: false,
      inFlight: false,
      patch: {},
      rollbackDevice: JSON.parse(JSON.stringify(current)),
      timer: null,
    };
    pendingDeviceWrites.set(deviceId, entry);
  }

  entry.patch = {
    ...entry.patch,
    ...statusPatch,
  };
  entry.forceOff = entry.forceOff || Boolean(options.forceOff);

  const optimistic = {
    ...current,
    boostTimer: current.boostTimer ? null : current.boostTimer,
    status: {
      ...statusOf(current),
      ...statusPatch,
    },
  };
  replaceDevice(optimistic);
  deviceErrors.delete(deviceId);
  if (entry.timer) {
    clearTimeout(entry.timer);
  }
  entry.timer = setTimeout(() => {
    sendQueuedDevicePatch(deviceId).catch(() => {});
  }, DEVICE_WRITE_DELAY_MS);
  renderDevices();
}

async function sendQueuedDevicePatch(deviceId) {
  const entry = pendingDeviceWrites.get(deviceId);
  if (!entry) {
    return;
  }

  if (entry.inFlight) {
    entry.timer = setTimeout(() => {
      sendQueuedDevicePatch(deviceId).catch(() => {});
    }, 250);
    return;
  }

  if (!hasQueuedPatch(entry)) {
    pendingDeviceWrites.delete(deviceId);
    renderDevices();
    return;
  }

  entry.inFlight = true;
  entry.timer = null;
  const statusPatch = { ...entry.patch };
  const forceOff = entry.forceOff;
  entry.patch = {};
  entry.forceOff = false;
  renderDevices();

  try {
    const data = await apiFetch(`/api/devices/${deviceId}/apply`, {
      method: "POST",
      body: {
        status: statusPatch,
        forceOff: Boolean(forceOff),
      },
    });
    if (data.device) {
      applyServerDevice(data.device, hasQueuedPatch(entry));
    }
    setMessage("");
  } catch (error) {
    const message = friendlyError(error);
    deviceErrors.set(deviceId, message);
    setMessage(message, "error");
    if (!hasQueuedPatch(entry)) {
      replaceDevice(entry.rollbackDevice);
    }
  } finally {
    entry.inFlight = false;
    if (hasQueuedPatch(entry)) {
      entry.timer = setTimeout(() => {
        sendQueuedDevicePatch(deviceId).catch(() => {});
      }, DEVICE_WRITE_DELAY_MS);
    } else {
      pendingDeviceWrites.delete(deviceId);
    }
    renderDevices();
  }
}

function changeTemperature(deviceId, delta) {
  const device = devices.find((item) => item.id === deviceId);
  if (!device) {
    return;
  }
  const status = statusOf(device);
  const nextTemp = clampToStep((Number.parseFloat(status.presetTemp) || 22) + delta, TEMP_MIN, TEMP_MAX, TEMP_STEP);
  queueDevicePatch(deviceId, { presetTemp: nextTemp });
}

async function setSleepTimer(deviceId, hours) {
  const current = devices.find((device) => device.id === deviceId);
  if (!current) {
    return;
  }

  const optimistic = {
    ...current,
    sleepTimer: hours
      ? {
        until: new Date(Date.now() + hours * 60 * 60 * 1000).toISOString(),
        nextAttemptAt: null,
        retryCount: 0,
        lastError: "",
      }
      : null,
  };
  replaceDevice(optimistic);
  renderDevices();

  try {
    const data = await apiFetch(`/api/devices/${deviceId}/sleep`, {
      method: "POST",
      body: {
        hours,
      },
    });
    if (data.device) {
      replaceDevice(data.device);
    }
    deviceErrors.delete(deviceId);
    setMessage("");
  } catch (error) {
    replaceDevice(current);
    const message = friendlyError(error);
    deviceErrors.set(deviceId, message);
    setMessage(message, "error");
  } finally {
    renderDevices();
  }
}

async function setBoostTimer(deviceId, minutes) {
  const current = devices.find((device) => device.id === deviceId);
  if (!current) {
    return;
  }

  const status = statusOf(current);
  const boostedStatus = buildBoostStatus(status);
  const optimistic = {
    ...current,
    boostTimer: minutes
      ? {
        until: new Date(Date.now() + minutes * 60 * 1000).toISOString(),
        nextAttemptAt: null,
        retryCount: 0,
        lastError: "",
      }
      : null,
    status: minutes ? boostedStatus : status,
  };
  replaceDevice(optimistic);
  renderDevices();

  try {
    const data = await apiFetch(`/api/devices/${deviceId}/boost`, {
      method: "POST",
      body: {
        minutes,
      },
    });
    if (data.device) {
      replaceDevice(data.device);
    }
    deviceErrors.delete(deviceId);
    setMessage("");
  } catch (error) {
    replaceDevice(current);
    const message = friendlyError(error);
    deviceErrors.set(deviceId, message);
    setMessage(message, "error");
  } finally {
    renderDevices();
  }
}

function updateCountdownDisplays() {
  document.querySelectorAll("[data-sleep-countdown]").forEach((element) => {
    const deviceId = Number.parseInt(element.dataset.sleepCountdown, 10);
    const device = devices.find((item) => item.id === deviceId);
    if (device) {
      element.textContent = sleepSummaryText(device);
      const trigger = element.closest("button");
      if (trigger) {
        trigger.setAttribute("aria-label", `Sleep timer for ${device.name}: ${sleepSummaryText(device)}`);
      }
    }
  });
  document.querySelectorAll("[data-boost-countdown]").forEach((element) => {
    const deviceId = Number.parseInt(element.dataset.boostCountdown, 10);
    const device = devices.find((item) => item.id === deviceId);
    if (device) {
      element.textContent = boostSummaryText(device);
      const trigger = element.closest("button");
      if (trigger) {
        trigger.setAttribute("aria-label", `Boost for ${device.name}: ${boostSummaryText(device)}`);
      }
    }
  });
}

function startCountdownClock() {
  if (countdownTimer) {
    return;
  }
  countdownTimer = setInterval(updateCountdownDisplays, 1000);
}

function stopCountdownClock() {
  if (!countdownTimer) {
    return;
  }
  clearInterval(countdownTimer);
  countdownTimer = null;
}

async function openEditList() {
  const data = await apiFetch("/api/devices?includeHidden=1");
  allDevices = Array.isArray(data.devices) ? data.devices : [];
  editItems = allDevices.map((device, index) => ({
    ...device,
    sortOrder: Number.isFinite(device.sortOrder) ? device.sortOrder : (index + 1) * 10,
  }));
  editOpen = true;
  els.editPanel.hidden = false;
  if (els.appTitleInput) {
    els.appTitleInput.value = appSettings.title;
  }
  renderEditList();
  renderDevices();
  if (els.appTitleInput) {
    els.appTitleInput.focus();
  }
}

function closeEditList() {
  editOpen = false;
  els.editPanel.hidden = true;
  renderDevices();
}

async function saveEditList() {
  updateButtons(true);
  try {
    const payload = editItems.map((item, index) => ({
      id: item.id,
      name: item.name,
      hidden: Boolean(item.hidden),
      sortOrder: (index + 1) * 10,
    }));
    const data = await apiFetch("/api/devices/list", {
      method: "POST",
      body: {
        devices: payload,
        title: els.appTitleInput ? els.appTitleInput.value.trim() : appSettings.title,
      },
    });
    allDevices = Array.isArray(data.devices) ? data.devices : [];
    if (data.settings) {
      applyAppSettings(data.settings);
    }
    await loadDevices();
    closeEditList();
    setMessage("");
  } catch (error) {
    setMessage(friendlyError(error), "error");
  } finally {
    updateButtons(false);
  }
}

async function login(event) {
  event.preventDefault();
  setLoginError("");
  els.loginButton.disabled = true;
  try {
    await apiFetch("/api/login", {
      method: "POST",
      body: {
        username: els.loginUsername.value,
        password: els.loginPassword.value,
      },
    });
    await bootApp();
  } catch (error) {
    setLoginError(friendlyError(error));
  } finally {
    els.loginButton.disabled = false;
  }
}

async function logout() {
  await apiFetch("/api/logout", {
    method: "POST",
    body: {},
  }).catch(() => {});
  devices = [];
  allDevices = [];
  editItems = [];
  deviceErrors.clear();
  stopStatusPolling();
  stopCountdownClock();
  for (const entry of pendingDeviceWrites.values()) {
    if (entry.timer) {
      clearTimeout(entry.timer);
    }
  }
  pendingDeviceWrites.clear();
  closeEditList();
  showLogin();
}

async function bootApp() {
  showApp();
  startCountdownClock();
  await loadDevices();
  if (!devices.length) {
    await scanDevices({ wideScan: true });
    if (devices.length) {
      startStatusPolling();
    }
  } else {
    startStatusPolling();
  }
}

async function loadSettings() {
  const data = await apiFetch("/api/settings");
  applyAppSettings(data.settings || {});
}

function bindEvents() {
  setButtonIcon(els.refreshAllButton, "refresh-cw", "Refresh all devices");
  setButtonIcon(els.editListButton, "pencil", "Edit device list");
  setButtonIcon(els.zoomMenuButton, "zoom-in", "Page zoom");
  setButtonIcon(els.zoomOutButton, "zoom-out", "Zoom out");
  setButtonIcon(els.zoomInButton, "zoom-in", "Zoom in");
  setButtonIcon(els.logoutButton, "log-out", "Logout");
  els.loginForm.addEventListener("submit", login);
  els.logoutButton.addEventListener("click", logout);
  if (els.zoomMenuButton && els.zoomMenu) {
    preventPointerFocusScroll(els.zoomMenuButton);
    els.zoomMenuButton.addEventListener("click", guardedControlClick(els.zoomMenuButton, (event, scroll) => {
      const shouldOpen = els.zoomMenu.hidden;
      closeOpenMenus(els.zoomMenu);
      els.zoomMenu.hidden = !shouldOpen;
      restoreScroll(scroll);
    }));
  }
  if (els.zoomOutButton) {
    preventPointerFocusScroll(els.zoomOutButton);
    els.zoomOutButton.addEventListener("click", guardedControlClick(els.zoomOutButton, () => {
      changeUiScale(-UI_SCALE_STEP);
    }));
  }
  if (els.zoomInButton) {
    preventPointerFocusScroll(els.zoomInButton);
    els.zoomInButton.addEventListener("click", guardedControlClick(els.zoomInButton, () => {
      changeUiScale(UI_SCALE_STEP);
    }));
  }
  els.refreshAllButton.addEventListener("click", () => {
    refreshAllDevices({ showErrors: true }).catch((error) => setMessage(friendlyError(error), "error"));
  });
  els.emptyScanButton.addEventListener("click", () => {
    scanDevices({ wideScan: true }).catch((error) => setMessage(friendlyError(error), "error"));
  });
  if (els.emptyManualButton) {
    els.emptyManualButton.addEventListener("click", () => {
      openEditList().catch((error) => setMessage(friendlyError(error), "error"));
    });
  }
  els.editListButton.addEventListener("click", () => {
    openEditList().catch((error) => setMessage(friendlyError(error), "error"));
  });
  els.closeEditButton.addEventListener("click", closeEditList);
  els.saveListButton.addEventListener("click", () => {
    saveEditList().catch((error) => setMessage(friendlyError(error), "error"));
  });
  els.rescanEditButton.addEventListener("click", () => {
    scanDevices({ wideScan: true }).catch((error) => setMessage(friendlyError(error), "error"));
  });
  if (els.manualAddForm) {
    els.manualAddForm.addEventListener("submit", addManualDevice);
  }
}

applyUiScale(readStoredUiScale(), { persist: false });
bindEvents();
loadSettings()
  .catch(() => {})
  .finally(() => {
    apiFetch("/api/me")
      .then(() => bootApp())
      .catch(() => showLogin());
  });

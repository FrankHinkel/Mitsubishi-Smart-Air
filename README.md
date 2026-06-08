# Mitsubishi Smart Air

Local web application for Mitsubishi WF-RAC / Smart M-Air air conditioners.

The browser only talks to the local Node.js server. The server handles WF-RAC HTTP/HTTPS quirks, SQLite persistence, login sessions, discovery, and device control.

## Quick start with Docker Compose

On a Raspberry Pi or another Linux host:

```sh
docker compose up -d --build
```

Open:

```text
http://<raspberry-pi-ip>:13920/
```

Default login:

```text
admin / admin
```

The application stores its SQLite database in the Docker volume `smart-air-data` at:

```text
/data/app.sqlite
```

The compose file uses `network_mode: host` so the container can reach the local LAN devices and read ARP/neighbour information for discovery.

## Local start

```sh
./start.sh
```

or:

```sh
PORT=13920 node server.js
```

Open:

```text
http://127.0.0.1:13920/
```

Local data is stored in:

```text
data/app.sqlite
```

## First run

If no visible devices exist, the UI starts a scan. Discovery looks for the known WF-RAC MAC prefix and common ports:

```text
MAC prefix: A0:43:B0
Port: 51443
Protocols: HTTP, HTTPS
```

If Docker cannot infer the LAN subnet, set `SCAN_SUBNETS` in `docker-compose.yml`, for example:

```yaml
SCAN_SUBNETS: 192.168.178.0/24
```

The provided compose file now defaults `SCAN_SUBNETS` to `192.168.178.0/24` for this setup and increases the TCP probe timeout a bit for slower Raspberry Pi scans. You can still override `SCAN_SUBNETS` from the shell when your LAN uses a different range.

If discovery still misses a unit, open `Edit list` and add the IP address manually. The server probes the address immediately and stores the device with its detected Aircon ID and protocol data.

Login sessions are persistent by default with a very long-lived HttpOnly cookie, so one login is normally enough unless you explicitly log out.

## Configuration

Useful environment variables:

```text
HOST=0.0.0.0
PORT=13920
DATA_DIR=/data
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=admin
REST_API_KEY=choose-a-long-random-secret
MAC_PREFIXES=a0:43:b0
SCAN_PORTS=51443
SCAN_PROTOCOLS=http,https
SCAN_SUBNETS=192.168.178.0/24
STATUS_POLL_INTERVAL_MS=60000
SLEEP_TIMER_CHECK_INTERVAL_MS=30000
SLEEP_TIMER_RETRY_DELAY_MS=180000
SLEEP_TIMER_MAX_RETRIES=3
```

`DEFAULT_ADMIN_USERNAME` and `DEFAULT_ADMIN_PASSWORD` are only used when the database has no users yet.

The server refreshes visible device status in the background every `STATUS_POLL_INTERVAL_MS` milliseconds. The UI renders cached SQLite values immediately and updates silently when fresh values arrive.

Sleep timers are stored in SQLite. When a timer expires, the server sends an off command. If that command fails, it retries up to `SLEEP_TIMER_MAX_RETRIES` times with `SLEEP_TIMER_RETRY_DELAY_MS` milliseconds between attempts.

## REST API for operating data

The server exposes a read-only endpoint for measurements stored in monthly SQLite files plus the current device status from `app.sqlite`.

Authentication uses an API key header (independent from browser login):

```text
x-api-key: <REST_API_KEY>
```

Set `REST_API_KEY` in your environment (for Docker Compose via `.env` or shell export before `docker compose up`).

Endpoint:

```text
GET /api/devices/{id}/measurements
GET /api/devices/measurements
```

Query parameters:

- `from` ISO timestamp (optional, default: `to - 24h`)
- `to` ISO timestamp (optional, default: now)
- `temperatureKind` one of `indoor`, `outdoor`, `all` (optional, default: `all`)
- `limit` integer `1..5000` (optional, default: `500`)
- `offset` integer `>=0` (optional, default: `0`)

Example:

```sh
curl -s \
	-H "x-api-key: $REST_API_KEY" \
	"http://127.0.0.1:13920/api/devices/1/measurements?from=2026-06-01T00:00:00Z&to=2026-06-08T00:00:00Z&temperatureKind=indoor&limit=200&offset=0"
```

Example (all devices):

```sh
curl -s \
	-H "x-api-key: $REST_API_KEY" \
	"http://127.0.0.1:13920/api/devices/measurements?from=2026-06-01T00:00:00Z&to=2026-06-08T00:00:00Z&temperatureKind=all&limit=500&offset=0"
```

Response fields (`/api/devices/{id}/measurements`):

- `device`: basic device info and current cached status from `app.sqlite`
- `measurements`: list of rows from monthly measurement SQLite files
- `pagination`: `limit`, `offset`, `returned`, `total`, `hasMore`
- `range`: normalized `from`/`to`

Response fields (`/api/devices/measurements`):

- `devices`: visible device list with current cached status from `app.sqlite`
- `measurements`: list of rows from monthly measurement SQLite files across all devices
- `pagination`: `limit`, `offset`, `returned`, `total`, `hasMore`
- `range`: normalized `from`/`to`

Error codes:

- `400` invalid range or invalid `temperatureKind`
- `401` missing or invalid API key
- `404` unknown device id
- `503` `REST_API_KEY` not configured on server

## Current features

- Temporary Boost mode for Cool and Heat with automatic restore after the selected countdown

## WF-RAC notes

Known local devices from the prototype:

```text

Boost mode is implemented on top of the same write path. The server temporarily applies maximum airflow plus the extreme target temperature for the current mode and restores the previous status after the selected timer expires.
192.168.178.84   a0:43:b0:5a:df:c7   a043b05adfc7   1st floor hallway
192.168.178.100  a0:43:b0:5a:e3:4d   a043b05ae34d   2nd floor bedroom
192.168.178.122  a0:43:b0:5a:e0:78   a043b05ae078
```

In the tested setup the devices respond over HTTP on port `51443`:

```text
http://<device-ip>:51443/beaver/command/...
```

## Device protocol

The low-level device communication lives in [device-api.js](device-api.js). The server never talks to the WF-RAC through browser fetch. Instead it calls `curl` locally and sends JSON commands to:

```text
http(s)://<device-ip>:51443/beaver/command/<command>
```

Every request uses these headers:

```text
Accept: */*
Connection: close
Content-Type: application/json; charset=utf-8
User-Agent: smartmair_app[1.4.005]
```

Every request body starts with the same envelope:

```json
{
	"apiVer": "1.0",
	"command": "getAirconStat",
	"deviceId": "Living Room",
	"operatorId": "web-...",
	"timestamp": 1717790000
}
```

`deviceId` is the visible room name. `operatorId` is the local remote identifier. When old UUID-style IDs cause `HTTP 501: Not supported this command`, the implementation automatically retries once with a shorter freshly generated operator ID.

## Commands sent by the app

The application currently sends exactly these WF-RAC commands:

| Command | When sent | Request `contents` | Important response fields |
| --- | --- | --- | --- |
| `getDeviceInfo` | Manual add, scan, initial identification | none | `contents.airconId`, `contents.macAddress`, `contents.apMode` |
| `getAirconStat` | Refresh, polling, fallback for `getDeviceInfo` | usually `{ "airconId": "..." }`, fallback also without `contents` | `contents.airconId`, `contents.airconStat`, `contents.firmType`, `contents.wireless`, `contents.mcu`, `contents.remoteList`, `contents.numOfAccount` |
| `updateAccountInfo` | Register this web app as a writable remote | `{ "accountId": operatorId, "airconId": airconId, "remote": 0, "timezone": "Europe/Berlin" }` | mainly `result`; `2` means remote limit reached |
| `setAirconStat` | Apply power/mode/temperature/fan changes | `{ "airconId": airconId, "airconStat": "<base64 frame>" }` | updated `contents.airconStat` for the confirmed state |

There are no extra hidden write commands in the app. Everything writable goes through `setAirconStat`.

## Responses the app expects

The server handles these reply shapes:

| Response source | Relevant fields |
| --- | --- |
| `getDeviceInfo` | `result`, `contents.airconId`, `contents.macAddress`, `contents.apMode` |
| `getAirconStat` | `result`, `contents.airconId`, `contents.airconStat`, `contents.firmType`, `contents.wireless`, `contents.mcu`, `contents.remoteList`, `contents.numOfAccount` |
| `updateAccountInfo` | `result` only is usually enough |
| `setAirconStat` | `result`, `contents.airconId`, `contents.airconStat` |

The implementation is intentionally tolerant:

- `getDeviceInfo` falls back to `getAirconStat` if the firmware rejects it.
- `getAirconStat` is accepted as long as `contents.airconStat` exists, even when the device returns a non-zero `result` on some firmwares.
- `setAirconStat` is considered successful when the response contains a valid `airconStat`, otherwise `result` must be `0`.

## Internal status model

The server converts the Mitsubishi binary status into this normalized model:

```json
{
	"operation": false,
	"operationMode": 1,
	"presetTemp": 22,
	"airFlow": 0,
	"windDirectionUD": 0,
	"windDirectionLR": 0,
	"entrust": false,
	"coolHotJudge": true,
	"modelNo": 0,
	"isVacantProperty": 0,
	"isSelfCleanOperation": false,
	"isSelfCleanReset": false,
	"indoorTemp": null,
	"outdoorTemp": null,
	"electric": 0,
	"errorCode": "00"
}
```

## `airconStat` encoding and decoding

`airconStat` is a base64-encoded Mitsubishi payload. The app decodes it in `DeviceStatus.fromBase64()` and re-encodes it in `DeviceStatus.toBase64()`.

Implementation steps:

1. Base64 is decoded into bytes.
2. `dataStart = bytes[18] * 4 + 21` locates the status payload.
3. The payload bytes are mapped into the normalized model.
4. For writes, the app creates two 18-byte blocks:
	 `commandToBytes(status)`
	 `receiveToBytes(status)`
5. Each block is framed with `1,255,255,255,255` plus CRC16-CCITT.
6. Both frames are concatenated and base64-encoded again.

## Value mappings used by the app

### Power

- Decode: `(data[2] & 3) === 1`
- Encode command block: `3` means on, `2` means off
- Encode receive block: `1` means on, `0` means off

### Operation mode

Normalized values:

| Value | Meaning |
| --- | --- |
| `0` | Auto |
| `1` | Cool |
| `2` | Heat |
| `3` | Fan |
| `4` | Dry |

Decode from receive bits:

| Bits | Mode |
| --- | --- |
| `0` | Auto |
| `8` | Cool |
| `16` | Heat |
| `12` | Fan |
| `4` | Dry |

Encode to command bits:

| Mode | Bits |
| --- | --- |
| Auto | `32` |
| Cool | `40` |
| Heat | `48` |
| Fan | `44` |
| Dry | `36` |

### Fan speed

Normalized values:

| Value | Meaning |
| --- | --- |
| `0` | Auto |
| `1` | Quiet |
| `2` | Low |
| `3` | High |
| `4` | Powerful |

Decode from `data[3] & 15` using `[7, 0, 1, 2, 6]`.

Encode command bits:

| Value | Bits |
| --- | --- |
| 0 | `15` |
| 1 | `8` |
| 2 | `9` |
| 3 | `10` |
| 4 | `14` |

### Vertical swing

Normalized values:

| Value | Meaning |
| --- | --- |
| `0` | Auto |
| `1` | Top |
| `2` | Mid |
| `3` | Normal |
| `4` | Bottom |

Decode:

- if `(data[2] & 192) === 64` then Auto
- otherwise `data[3] & 240` mapped from `[0, 16, 32, 48]` with offset `1`

### Horizontal swing

Normalized values:

| Value | Meaning |
| --- | --- |
| `0` | Auto |
| `1..7` | Fixed positions / sweep modes |

Decode:

- if `(data[12] & 3) === 1` then Auto
- otherwise `data[11] & 31` mapped from `[0,1,2,3,4,5,6]` with offset `1`

### Set temperature

- Decode: `data[4] / 2`
- Encode: `Math.floor(presetTemp / 0.5)`
- In the command block the encoded value is offset by `128`
- In fan-only mode the app writes `25.0` as fallback because the device does not use a meaningful target temperature there

Examples:

| Target | Encoded receive byte | Encoded command byte |
| --- | --- | --- |
| `18.0` | `36` | `164` |
| `22.0` | `44` | `172` |
| `25.0` | `50` | `178` |

### Error code conversion

- `data[6] & 127` gives the numeric code
- `0` becomes `00`
- if bit `128` is not set: `Mxx`
- if bit `128` is set: `Exx`

### Energy usage

The app scans the telemetry blocks after the status bytes.

- marker `148`, kind `16`
- raw value is little-endian: `(value2 << 8) | value`
- final value is `raw * 0.25`

### Indoor and outdoor temperature tables

The device does not send temperatures as plain Celsius values. It sends table indexes.

- marker `128`, kind `16` -> outdoor temperature index into `OUTDOOR_TEMP`
- marker `128`, kind `32` -> indoor temperature index into `INDOOR_TEMP`

Both lookup tables are implemented directly in [device-api.js](device-api.js). They are not a simple linear formula.

Examples from the implementation:

| Table | Example index | Celsius |
| --- | --- | --- |
| `OUTDOOR_TEMP` | `90` | `0.0` |
| `OUTDOOR_TEMP` | `176` | `20.0` |
| `INDOOR_TEMP` | `69` | `0.0` |
| `INDOOR_TEMP` | `144` | `20.0` |

That is why the app must use the hardcoded tables instead of a quick formula.

## Registration and writable control

Writable commands are only reliable after `updateAccountInfo` has registered the current `operatorId` as a remote. The app then also inspects `remoteList` from `getAirconStat` and prefers a confirmed remote ID when applying writes.

## Protocol fallback logic

The technical fallback order is:

1. Use remembered protocol for the device when known.
2. In `auto` mode try HTTPS first, then HTTP.
3. Retry with a shorter operator ID if the firmware rejects the legacy one.
4. Fall back from `getDeviceInfo` to `getAirconStat` if necessary.

## References

- Homebridge WF-RAC protocol implementation: https://github.com/JobDoesburg/homebridge-mhi-wfrac
- NPM package: https://www.npmjs.com/package/homebridge-mhi-wfrac

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

## Configuration

Useful environment variables:

```text
HOST=0.0.0.0
PORT=13920
DATA_DIR=/data
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=admin
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

## Current features

- Docker Compose installation for Raspberry Pi style hosts
- Local login with HttpOnly cookie sessions
- Mobile-friendly English UI
- Compact device list as the main screen
- Immediate power, mode, temperature, and fan controls
- Persistent sleep timer with countdown and retry-on-failure shutdown
- Inline error messages instead of success popups
- SQLite device database
- Automatic scan when no devices are configured
- Edit list view for names, ordering, and hidden devices

## WF-RAC notes

Known local devices from the prototype:

```text
192.168.178.84   a0:43:b0:5a:df:c7   a043b05adfc7   1st floor hallway
192.168.178.100  a0:43:b0:5a:e3:4d   a043b05ae34d   2nd floor bedroom
192.168.178.122  a0:43:b0:5a:e0:78   a043b05ae078
```

In the tested setup the devices respond over HTTP on port `51443`:

```text
http://<device-ip>:51443/beaver/command/...
```

## References

- Homebridge WF-RAC protocol implementation: https://github.com/JobDoesburg/homebridge-mhi-wfrac
- NPM package: https://www.npmjs.com/package/homebridge-mhi-wfrac

# MQTT Home Automation Dashboard

React (Vite) frontend that connects directly to an MQTT broker over
WebSocket (using `mqtt.js` in the browser — no backend needed) and gives
you a connect screen + a live control dashboard.

## Setup

```bash
npm install
npm run dev
```

Then open the printed local URL (usually `http://localhost:5173`).

## How it works

1. **Connect screen** (`src/MqttConnect.jsx`) — enter your broker's
   WebSocket URL, client ID, and optional username/password. On success
   it hands the live connection up to `App.jsx`.
2. **Dashboard** (`src/MqttDashboard.jsx`) — once connected, subscribes
   to each device's `stateTopic` and renders a control card:
   - `switch` — toggle, publishes `"ON"` / `"OFF"` to `commandTopic`
   - `slider` — range input, publishes the numeric value to `commandTopic`
   - `sensor` — read-only, just displays whatever value is published

## Configure your devices

Edit `src/devices.js` — add/remove entries to match your actual topics:

```js
{
  id: "livingroom-light",
  name: "Living Room Light",
  type: "switch",
  stateTopic: "home/livingroom/light/state",
  commandTopic: "home/livingroom/light/set",
}
```

## Broker notes (mqtt.enqi.io)

The connect screen defaults to `wss://mqtt.enqi.io:8084/mqtt` — this is
a best guess at the standard TLS WebSocket port/path. **Confirm the
exact port and path from Enqi's own docs/dashboard** — a wrong port
will just time out silently rather than give a clear error.

If your broker requires auth, fill in the username/password fields on
the connect screen.

## Notes

- No data is stored anywhere (no localStorage) — you'll need to
  reconnect each time you reload, or wire up your own persistence if
  you want the broker details remembered.
- If you deploy this over HTTPS, you must use `wss://` (not `ws://`) —
  browsers block insecure WebSocket connections from a secure page.

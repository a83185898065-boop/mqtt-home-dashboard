import { useState, useEffect, useRef, useCallback } from "react";
import mqtt from "mqtt";
import "./MqttDashboard.css";

/*
=========================================================
MQTT DASHBOARD

Features:
- Connect
- Disconnect
- Reconnect
- Relay ON/OFF
- Temperature
- Humidity
- Responsive UI

MQTT Topics:

Relay 1 Command:
aditya11/home/relay/1/cmd

Relay 1 State:
aditya11/home/relay/1/state

Relay 2 Command:
aditya11/home/relay/2/cmd

Relay 2 State:
aditya11/home/relay/2/state

Relay 3 Command:
aditya11/home/relay/3/cmd

Relay 3 State:
aditya11/home/relay/3/state

Relay 4 Command:
aditya11/home/relay/4/cmd

Relay 4 State:
aditya11/home/relay/4/state

Temperature:
aditya11/home/sensor/temperature

Humidity:
aditya11/home/sensor/humidity
=========================================================
*/

export default function MqttDashboard({
  brokerUrl,
  devices = [],
  options = {},
}) {
  /* =====================================================
     MQTT CLIENT
  ===================================================== */

  const clientRef = useRef(null);

  const manualDisconnectRef = useRef(false);

  /* =====================================================
     CONNECTION STATE

     disconnected
     connecting
     connected
     offline
     error
  ===================================================== */

  const [connStatus, setConnStatus] =
    useState("disconnected");

  /* =====================================================
     DEVICE VALUES
  ===================================================== */

  const [values, setValues] = useState({});

  const [lastUpdated, setLastUpdated] =
    useState({});

  /* =====================================================
     MQTT CONNECT FUNCTION
  ===================================================== */

  const connectMQTT = useCallback(() => {
    /*
    Already connected
    */

    if (
      clientRef.current &&
      clientRef.current.connected
    ) {
      console.log(
        "MQTT already connected"
      );

      return;
    }

    /*
    Stop manual disconnect mode
    */

    manualDisconnectRef.current = false;

    /*
    Remove old client if any
    */

    if (clientRef.current) {
      try {
        clientRef.current.end(true);
      } catch (error) {
        console.log(
          "Old client close error:",
          error
        );
      }

      clientRef.current = null;
    }

    /*
    Update UI
    */

    setConnStatus("connecting");

    console.log(
      "Connecting to MQTT:",
      brokerUrl
    );

    /*
    MQTT OPTIONS
    */

    const mqttOptions = {
      clean: true,

      connectTimeout: 10000,

      reconnectPeriod: 3000,

      ...options,
    };

    /*
    CREATE MQTT CLIENT
    */

    const client = mqtt.connect(
      brokerUrl,
      mqttOptions
    );

    clientRef.current = client;

    /* ===================================================
       CONNECT EVENT
    =================================================== */

    client.on("connect", () => {
      /*
      If user manually disconnected,
      don't continue.
      */

      if (
        manualDisconnectRef.current
      ) {
        return;
      }

      console.log(
        "MQTT Connected Successfully"
      );

      setConnStatus("connected");

      /*
      GET ALL STATE TOPICS
      */

      const topics = devices
        .map(
          (device) =>
            device.stateTopic
        )
        .filter(Boolean);

      /*
      SUBSCRIBE
      */

      if (topics.length > 0) {
        client.subscribe(
          topics,
          {
            qos: 0,
          },
          (error) => {
            if (error) {
              console.error(
                "MQTT Subscribe Error:",
                error
              );
            } else {
              console.log(
                "MQTT Subscribed:",
                topics
              );
            }
          }
        );
      }
    });

    /* ===================================================
       RECONNECT EVENT
    =================================================== */

    client.on("reconnect", () => {
      if (
        manualDisconnectRef.current
      ) {
        return;
      }

      console.log(
        "MQTT Reconnecting..."
      );

      setConnStatus("connecting");
    });

    /* ===================================================
       OFFLINE EVENT
    =================================================== */

    client.on("offline", () => {
      if (
        manualDisconnectRef.current
      ) {
        return;
      }

      console.log(
        "MQTT Offline"
      );

      setConnStatus("offline");
    });

    /* ===================================================
       CLOSE EVENT
    =================================================== */

    client.on("close", () => {
      if (
        manualDisconnectRef.current
      ) {
        return;
      }

      console.log(
        "MQTT Connection Closed"
      );

      setConnStatus("offline");
    });

    /* ===================================================
       ERROR EVENT
    =================================================== */

    client.on("error", (error) => {
      if (
        manualDisconnectRef.current
      ) {
        return;
      }

      console.error(
        "MQTT Error:",
        error
      );

      setConnStatus("error");
    });

    /* ===================================================
       MESSAGE EVENT
    =================================================== */

    client.on(
      "message",
      (topic, payload) => {
        if (
          manualDisconnectRef.current
        ) {
          return;
        }

        const message =
          payload
            .toString()
            .trim();

        console.log(
          "MQTT MESSAGE:",
          topic,
          message
        );

        /*
        SAVE VALUE
        */

        setValues(
          (previous) => ({
            ...previous,
            [topic]: message,
          })
        );

        /*
        SAVE UPDATE TIME
        */

        setLastUpdated(
          (previous) => ({
            ...previous,
            [topic]: Date.now(),
          })
        );
      }
    );
  }, [
    brokerUrl,
    devices,
    options,
  ]);

  /* =====================================================
     AUTO CONNECT ON PAGE LOAD
  ===================================================== */

  useEffect(() => {
    connectMQTT();

    /*
    CLEANUP
    */

    return () => {
      manualDisconnectRef.current =
        true;

      if (clientRef.current) {
        try {
          clientRef.current.end(
            true
          );
        } catch (error) {
          console.log(
            "MQTT cleanup error:",
            error
          );
        }

        clientRef.current = null;
      }
    };
  }, [connectMQTT]);

  /* =====================================================
     DISCONNECT FUNCTION
  ===================================================== */

  const disconnectMQTT =
    useCallback(() => {
      console.log(
        "Manual MQTT Disconnect"
      );

      /*
      STOP AUTO RECONNECT
      */

      manualDisconnectRef.current =
        true;

      /*
      GET CLIENT
      */

      const client =
        clientRef.current;

      /*
      CLOSE CLIENT
      */

      if (client) {
        try {
          client.end(true);
        } catch (error) {
          console.log(
            "Disconnect error:",
            error
          );
        }
      }

      /*
      REMOVE CLIENT
      */

      clientRef.current = null;

      /*
      UPDATE STATUS
      */

      setConnStatus(
        "disconnected"
      );
    }, []);

  /* =====================================================
     PUBLISH FUNCTION
  ===================================================== */

  const publish = useCallback(
    (topic, message) => {
      const client =
        clientRef.current;

      /*
      CHECK CLIENT
      */

      if (!client) {
        console.error(
          "MQTT client not available"
        );

        return;
      }

      /*
      CHECK CONNECTION
      */

      if (!client.connected) {
        console.error(
          "MQTT is not connected"
        );

        return;
      }

      /*
      CHECK TOPIC
      */

      if (!topic) {
        console.error(
          "MQTT topic is missing"
        );

        return;
      }

      /*
      MESSAGE
      */

      const payload =
        String(message);

      console.log(
        "MQTT PUBLISH:",
        topic,
        payload
      );

      /*
      PUBLISH
      */

      client.publish(
        topic,
        payload,
        {
          qos: 0,
          retain: false,
        },
        (error) => {
          if (error) {
            console.error(
              "Publish Error:",
              error
            );
          } else {
            console.log(
              "Published Successfully:",
              topic,
              payload
            );
          }
        }
      );
    },
    []
  );

  /* =====================================================
     RETURN
  ===================================================== */

  return (
    <div className="mqtt-dashboard">

      {/* =================================================
          HEADER
      ================================================= */}

      <header className="mqtt-dashboard__header">

        {/* TITLE */}

        <div className="mqtt-dashboard__heading">

          <h1>
            Home Control
          </h1>

          <p>
            MQTT Home Automation Dashboard
          </p>

        </div>

        {/* ACTIONS */}

        <div className="mqtt-dashboard__actions">

          {/* STATUS */}

          <StatusBadge
            status={connStatus}
          />

          {/* CONNECT / DISCONNECT */}

          {connStatus ===
          "connected" ? (
            <button
              type="button"
              className="mqtt-disconnect"
              onClick={
                disconnectMQTT
              }
            >
              Disconnect
            </button>
          ) : (
            <button
              type="button"
              className="mqtt-connect-button"
              onClick={
                connectMQTT
              }
              disabled={
                connStatus ===
                "connecting"
              }
            >
              {connStatus ===
              "connecting"
                ? "Connecting..."
                : "Connect"}
            </button>
          )}

        </div>

      </header>

      {/* =================================================
          DEVICE GRID
      ================================================= */}

      <div className="mqtt-dashboard__grid">

        {devices.map(
          (device) => (
            <DeviceCard
              key={device.id}
              device={device}
              value={
                values[
                  device.stateTopic
                ]
              }
              updatedAt={
                lastUpdated[
                  device.stateTopic
                ]
              }
              connected={
                connStatus ===
                "connected"
              }
              onCommand={(
                payload
              ) =>
                publish(
                  device.commandTopic,
                  payload
                )
              }
            />
          )
        )}

      </div>

    </div>
  );
}

/* =========================================================
   STATUS BADGE
========================================================= */

function StatusBadge({
  status,
}) {
  const labels = {
    connected:
      "Connected",

    connecting:
      "Connecting...",

    disconnected:
      "Disconnected",

    offline:
      "Offline",

    error:
      "Connection Error",
  };

  return (
    <span
      className={`status-badge status-badge--${status}`}
    >
      {labels[status] ||
        "Unknown"}
    </span>
  );
}

/* =========================================================
   DEVICE CARD
========================================================= */

function DeviceCard({
  device,
  value,
  updatedAt,
  connected,
  onCommand,
}) {
  /*
  SWITCH
  */

  if (
    device.type ===
    "switch"
  ) {
    return (
      <SwitchCard
        device={device}
        value={value}
        updatedAt={
          updatedAt
        }
        connected={
          connected
        }
        onCommand={
          onCommand
        }
      />
    );
  }

  /*
  SLIDER
  */

  if (
    device.type ===
    "slider"
  ) {
    return (
      <SliderCard
        device={device}
        value={value}
        updatedAt={
          updatedAt
        }
        connected={
          connected
        }
        onCommand={
          onCommand
        }
      />
    );
  }

  /*
  SENSOR
  */

  return (
    <SensorCard
      device={device}
      value={value}
      updatedAt={
        updatedAt
      }
    />
  );
}

/* =========================================================
   SWITCH CARD
========================================================= */

function SwitchCard({
  device,
  value,
  updatedAt,
  connected,
  onCommand,
}) {
  /*
  CHECK ON/OFF
  */

  const isOn =
    value === "ON" ||
    value === "1" ||
    value === "true" ||
    value === "on";

  return (
    <div className="device-card">

      {/* TOP */}

      <div className="device-card__top">

        <span className="device-card__name">
          {device.name}
        </span>

        <FreshnessDot
          updatedAt={
            updatedAt
          }
        />

      </div>

      {/* TOGGLE */}

      <button
        type="button"
        className={`toggle ${
          isOn
            ? "toggle--on"
            : ""
        }`}
        disabled={!connected}
        onClick={() =>
          onCommand(
            isOn
              ? "OFF"
              : "ON"
          )
        }
        aria-pressed={
          isOn
        }
      >
        <span className="toggle__knob" />
      </button>

      {/* STATE */}

      <span className="device-card__state">
        {isOn
          ? "On"
          : "Off"}
      </span>

    </div>
  );
}

/* =========================================================
   SLIDER CARD
========================================================= */

function SliderCard({
  device,
  value,
  updatedAt,
  connected,
  onCommand,
}) {
  const min =
    device.min ?? 0;

  const max =
    device.max ?? 100;

  let numeric = min;

  if (
    value !== undefined &&
    value !== null &&
    value !== ""
  ) {
    const parsed =
      Number(value);

    if (
      !Number.isNaN(
        parsed
      )
    ) {
      numeric = parsed;
    }
  }

  return (
    <div className="device-card">

      {/* TOP */}

      <div className="device-card__top">

        <span className="device-card__name">
          {device.name}
        </span>

        <FreshnessDot
          updatedAt={
            updatedAt
          }
        />

      </div>

      {/* SLIDER */}

      <input
        type="range"
        min={min}
        max={max}
        value={numeric}
        disabled={!connected}
        onChange={(
          event
        ) =>
          onCommand(
            event.target.value
          )
        }
        className="slider"
      />

      {/* VALUE */}

      <span className="device-card__state">

        {value !==
        undefined
          ? numeric
          : "--"}

        {device.unit ||
          ""}

      </span>

    </div>
  );
}

/* =========================================================
   SENSOR CARD
========================================================= */

function SensorCard({
  device,
  value,
  updatedAt,
}) {
  return (
    <div className="device-card device-card--sensor">

      {/* TOP */}

      <div className="device-card__top">

        <span className="device-card__name">
          {device.name}
        </span>

        <FreshnessDot
          updatedAt={
            updatedAt
          }
        />

      </div>

      {/* VALUE */}

      <span className="device-card__reading">

        {value !==
        undefined
          ? value
          : "--"}

        <span className="device-card__unit">
          {device.unit ||
            ""}
        </span>

      </span>

    </div>
  );
}

/* =========================================================
   FRESHNESS DOT
========================================================= */

function FreshnessDot({
  updatedAt,
}) {
  const stale =
    !updatedAt ||
    Date.now() -
      updatedAt >
      60000;

  return (
    <span
      className={`freshness-dot ${
        stale
          ? "freshness-dot--stale"
          : "freshness-dot--live"
      }`}
      title={
        updatedAt
          ? new Date(
              updatedAt
            ).toLocaleTimeString()
          : "No data yet"
      }
    />
  );
}
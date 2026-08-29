import { useEffect, useRef, useState } from "react";
import mqtt from "mqtt";
import "./MqttConnect.css";

export default function MqttConnectPage({
  onConnected,
  onClientChange,
}) {
  const clientRef = useRef(null);
  const timeoutRef = useRef(null);

  const [form, setForm] = useState({
    brokerUrl: "wss://broker.emqx.io:8084/mqtt",
    clientId: `web_${Math.random()
      .toString(16)
      .slice(2, 10)}`,
    username: "",
    password: "",
  });

  const [status, setStatus] = useState("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const connectedCallback =
    onConnected || onClientChange;

  // =====================================================
  // CLEANUP
  // =====================================================

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      if (clientRef.current) {
        clientRef.current.end(true);
        clientRef.current = null;
      }
    };
  }, []);

  // =====================================================
  // INPUT CHANGE
  // =====================================================

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  // =====================================================
  // MQTT CONNECT
  // =====================================================

  const handleConnect = (e) => {
    e.preventDefault();

    // Already connecting/connected
    if (
      status === "testing" ||
      status === "success"
    ) {
      return;
    }

    // Close previous client
    if (clientRef.current) {
      clientRef.current.end(true);
      clientRef.current = null;
    }

    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    setStatus("testing");
    setErrorMsg("");

    // ===================================================
    // BROKER URL
    // ===================================================

    const brokerUrl =
      form.brokerUrl.trim();

    // ===================================================
    // MQTT OPTIONS
    // ===================================================

    const options = {
      clientId:
        form.clientId.trim() ||
        `web_${Math.random()
          .toString(16)
          .slice(2, 10)}`,

      clean: true,

      connectTimeout: 10000,

      reconnectPeriod: 0,

      keepalive: 30,

      username:
        form.username.trim() ||
        undefined,

      password:
        form.password ||
        undefined,
    };

    console.log(
      "Connecting to MQTT:",
      brokerUrl
    );

    let connected = false;

    // ===================================================
    // CREATE MQTT CLIENT
    // ===================================================

    const client = mqtt.connect(
      brokerUrl,
      options
    );

    clientRef.current = client;

    // ===================================================
    // CLEANUP TIMEOUT
    // ===================================================

    const cleanupTimeout = () => {
      if (timeoutRef.current) {
        clearTimeout(
          timeoutRef.current
        );

        timeoutRef.current = null;
      }
    };

    // ===================================================
    // CONNECT SUCCESS
    // ===================================================

    const onConnect = () => {
      connected = true;

      cleanupTimeout();

      console.log(
        "MQTT Connected:",
        brokerUrl
      );

      setStatus("success");

      setErrorMsg("");

      // Remove error listener after success
      client.removeListener(
        "error",
        onError
      );

      // Send client to dashboard
      if (connectedCallback) {
        if (onClientChange) {
          connectedCallback(client);
        } else {
          connectedCallback({
            brokerUrl,
            options,
            client,
          });
        }
      }
    };

    // ===================================================
    // CONNECTION ERROR
    // ===================================================

    const onError = (error) => {
      console.error(
        "MQTT Error:",
        error
      );

      // Ignore errors after successful connection
      if (connected) {
        return;
      }

      cleanupTimeout();

      setStatus("error");

      setErrorMsg(
        error?.message ||
          "Could not connect to MQTT broker."
      );

      client.end(true);

      clientRef.current = null;
    };

    // ===================================================
    // CONNECTION CLOSE
    // ===================================================

    const onClose = () => {
      console.log(
        "MQTT connection closed."
      );

      if (!connected) {
        setStatus("error");
      }
    };

    // ===================================================
    // EVENT LISTENERS
    // ===================================================

    client.once(
      "connect",
      onConnect
    );

    client.once(
      "error",
      onError
    );

    client.on(
      "close",
      onClose
    );

    // ===================================================
    // CONNECTION TIMEOUT
    // ===================================================

    timeoutRef.current =
      setTimeout(() => {
        if (
          !connected &&
          clientRef.current === client
        ) {
          console.error(
            "MQTT connection timeout."
          );

          setStatus("error");

          setErrorMsg(
            "Connection timed out. Check the broker URL, port and network."
          );

          client.removeListener(
            "connect",
            onConnect
          );

          client.removeListener(
            "error",
            onError
          );

          client.removeListener(
            "close",
            onClose
          );

          client.end(true);

          clientRef.current = null;

          timeoutRef.current = null;
        }
      }, 12000);
  };

  // =====================================================
  // UI
  // =====================================================

  return (
    <div className="mqtt-connect">
      <form
        className="mqtt-connect__card"
        onSubmit={handleConnect}
      >
        {/* =================================================
            TITLE
        ================================================= */}

        <h1 className="mqtt-connect__title">
          Connect to broker
        </h1>

        <p className="mqtt-connect__subtitle">
          Enter your MQTT broker's WebSocket
          details to link this dashboard.
        </p>

        {/* =================================================
            BROKER URL
        ================================================= */}

        <label className="mqtt-connect__field">
          <span>
            Broker URL
          </span>

          <input
            type="text"
            name="brokerUrl"
            value={form.brokerUrl}
            onChange={handleChange}
            placeholder="wss://broker.emqx.io:8084/mqtt"
            disabled={
              status === "testing"
            }
          />
        </label>

        {/* =================================================
            CLIENT ID
        ================================================= */}

        <label className="mqtt-connect__field">
          <span>
            Client ID
          </span>

          <input
            type="text"
            name="clientId"
            value={form.clientId}
            onChange={handleChange}
            disabled={
              status === "testing"
            }
          />
        </label>

        {/* =================================================
            USERNAME + PASSWORD
        ================================================= */}

        <div className="mqtt-connect__row">
          <label className="mqtt-connect__field">
            <span>
              Username
            </span>

            <input
              type="text"
              name="username"
              value={form.username}
              onChange={handleChange}
              placeholder="optional"
              disabled={
                status === "testing"
              }
            />
          </label>

          <label className="mqtt-connect__field">
            <span>
              Password
            </span>

            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="optional"
              disabled={
                status === "testing"
              }
            />
          </label>
        </div>

        {/* =================================================
            ERROR MESSAGE
        ================================================= */}

        {status === "error" && (
          <div className="mqtt-connect__error">
            {errorMsg}
          </div>
        )}

        {/* =================================================
            SUCCESS MESSAGE
        ================================================= */}

        {status === "success" && (
          <div className="mqtt-connect__success">
            Connected successfully to MQTT
            broker.
          </div>
        )}

        {/* =================================================
            CONNECT BUTTON
        ================================================= */}

        <button
          type="submit"
          className="mqtt-connect__submit"
          disabled={
            status === "testing"
          }
        >
          {status === "testing"
            ? "Connecting..."
            : status === "success"
            ? "Connected"
            : "Connect"}
        </button>
      </form>
    </div>
  );
}
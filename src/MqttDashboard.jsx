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
     JARVIS VOICE + COMMAND LOADER
  ===================================================== */

  const [voiceListening, setVoiceListening] =
    useState(false);

  const [loader, setLoader] = useState({
    visible: false,
    message: "Sending command...",
    progress: 0,
    type: "command",
  });

  const recognitionRef = useRef(null);
  const loaderTimerRef = useRef(null);

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
      return new Promise((resolve, reject) => {
        const client =
          clientRef.current;

        if (!client) {
          console.error(
            "MQTT client not available"
          );
          reject(new Error("MQTT client not available"));
          return;
        }

        if (!client.connected) {
          console.error(
            "MQTT is not connected"
          );
          reject(new Error("MQTT is not connected"));
          return;
        }

        if (!topic) {
          console.error(
            "MQTT topic is missing"
          );
          reject(new Error("MQTT topic is missing"));
          return;
        }

        const payload =
          String(message);

        console.log(
          "MQTT PUBLISH:",
          topic,
          payload
        );

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
              reject(error);
            } else {
              console.log(
                "Published Successfully:",
                topic,
                payload
              );
              resolve();
            }
          }
        );
      });
    },
    []
  );

  /* =====================================================
     COMMAND LOADER
  ===================================================== */

  const hideLoader = useCallback(() => {
    clearInterval(loaderTimerRef.current);

    setLoader((previous) => ({
      ...previous,
      progress: 100,
    }));

    window.setTimeout(() => {
      setLoader({
        visible: false,
        message: "Sending command...",
        progress: 0,
        type: "command",
      });
    }, 220);
  }, []);

  const showLoader = useCallback((message, type = "command") => {
    clearInterval(loaderTimerRef.current);

    setLoader({
      visible: true,
      message,
      progress: 0,
      type,
    });

    let progress = 0;

    loaderTimerRef.current = window.setInterval(() => {
      progress += Math.random() * 11;

      if (progress > 92) {
        progress = 92;
      }

      setLoader((previous) => ({
        ...previous,
        progress,
      }));
    }, 160);
  }, []);

  const runCommand = useCallback(
    async (device, payload) => {
      if (!device?.commandTopic) {
        console.error(
          "Command topic is missing",
          device
        );
        return false;
      }

      const message =
        payload === "ON"
          ? `Turning ON ${device.name}...`
          : payload === "OFF"
            ? `Turning OFF ${device.name}...`
            : `Updating ${device.name}...`;

      showLoader(message);

      try {
        await publish(
          device.commandTopic,
          payload
        );

        return true;
      } catch (error) {
        console.error(
          "Command failed:",
          error
        );
        return false;
      } finally {
        hideLoader();
      }
    },
    [publish, showLoader, hideLoader]
  );

  /* =====================================================
     JARVIS VOICE
  ===================================================== */

  const speak = useCallback((message) => {
    if (!("speechSynthesis" in window)) {
      return;
    }

    window.speechSynthesis.cancel();

    const utterance =
      new SpeechSynthesisUtterance(message);

    utterance.lang = "en-IN";
    utterance.rate = 0.95;
    utterance.pitch = 0.85;
    utterance.volume = 1;

    window.speechSynthesis.speak(utterance);
  }, []);

  const numberWords = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    ek: 1,
    eka: 1,
    do: 2,
    teen: 3,
    tin: 3,
    char: 4,
    chaar: 4,
    paanch: 5,
    panch: 5,
    cheh: 6,
    chhah: 6,
    chhe: 6,
    saat: 7,
    sat: 7,
    aath: 8,
    ath: 8,
  };

  const getRelayNumbers = useCallback((command) => {
    const text = command.toLowerCase();
    const numbers = new Set();

    const digitMatches = text.match(/\b[1-8]\b/g) || [];
    digitMatches.forEach((value) => numbers.add(Number(value)));

    Object.entries(numberWords).forEach(([word, number]) => {
      const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`\\b${escaped}\\b`, "i");
      if (re.test(text)) numbers.add(number);
    });

    return [...numbers].sort((a, b) => a - b);
  }, []);

  const findVoiceDevices = useCallback(
    (command) => {
      const relayNumbers = getRelayNumbers(command);

      if (relayNumbers.length > 0) {
        return relayNumbers
          .map((number) =>
            devices.find(
              (device) =>
                device.type === "switch" &&
                (
                  String(device.id).toLowerCase() ===
                    `relay-${number}` ||
                  String(device.name)
                    .toLowerCase()
                    .includes(`relay ${number}`)
                )
            )
          )
          .filter(Boolean);
      }

      const text = command.toLowerCase();
      const keyword =
        text.includes("light")
          ? "light"
          : text.includes("fan")
            ? "fan"
            : text.includes("switch")
              ? "switch"
              : text.includes("relay")
                ? "relay"
                : null;

      if (keyword) {
        return devices.filter((device) =>
          String(device.name).toLowerCase().includes(keyword)
        );
      }

      return [];
    },
    [devices, getRelayNumbers]
  );

  const handleVoiceCommand = useCallback(
    async (command) => {
      const text = command
        .toLowerCase()
        .trim()
        .replace(/[.,!?]/g, " ");

      if (!text) return;

      const isOn =
        /\b(turn\s+on|switch\s+on|activate|enable|on|chala do|chala|jala do|jala|jalaa|jla do|on karo|on kr do|on kar do|chalu karo|chalao|chala do)\b/.test(
          text
        );

      const isOff =
        /\b(turn\s+off|switch\s+off|deactivate|disable|off|band karo|band kr do|band kar do|bujha do|bujha|bnd karo|bnd kr do)\b/.test(
          text
        );

      if (
        text.includes("hello") ||
        text.includes("hi jarvis") ||
        text.includes("hey jarvis")
      ) {
        speak("Hello boss. I am ready.");
        return;
      }

      if (
        text.includes("status") ||
        text.includes("system status") ||
        text.includes("system check")
      ) {
        speak(
          connStatus === "connected"
            ? "All systems are online, boss."
            : "MQTT is currently disconnected, boss."
        );
        return;
      }

      /*
       * ALL RELAYS
       * English: all relay(s), all switches, everything
       * Hinglish: saare relay, sare relay, sabhi relay, sab relay,
       *           saare switch, sab switch
       */
      const allRelays =
        /\ball\s+(?:the\s+)?relays?\b/.test(text) ||
        /\ball\s+(?:the\s+)?switch(?:es)?\b/.test(text) ||
        /\b(?:saare|sare|sabhi|sab)\s+(?:the\s+)?relays?\b/.test(text) ||
        /\b(?:saare|sare|sabhi|sab)\s+(?:the\s+)?switch(?:es)?\b/.test(text) ||
        /\beverything\b/.test(text);

      if (allRelays && (isOn || isOff)) {
        const payload = isOn ? "ON" : "OFF";
        const switchDevices = devices.filter(
          (device) => device.type === "switch" && device.commandTopic
        );

        if (!switchDevices.length) {
          speak("I could not find any relays, boss.");
          return;
        }

        showLoader(
          payload === "ON"
            ? "Turning ON all relays..."
            : "Turning OFF all relays..."
        );

        const results = await Promise.all(
          switchDevices.map((device) =>
            publish(device.commandTopic, payload)
              .then(() => true)
              .catch(() => false)
          )
        );

        hideLoader();

        const successCount = results.filter(Boolean).length;

        if (successCount === switchDevices.length) {
          speak(
            payload === "ON"
              ? "All relays turned on, boss."
              : "All relays turned off, boss."
          );
        } else {
          speak(
            `Boss, ${successCount} of ${switchDevices.length} relays responded.`
          );
        }

        return;
      }

      if (!isOn && !isOff) {
        speak(
          "This command was not recognised, boss Aditya."
        );
        return;
      }

      const matchedDevices = findVoiceDevices(text);

      if (!matchedDevices.length) {
        speak("I could not find that device, boss.");
        return;
      }

      const payload = isOn ? "ON" : "OFF";

      /*
       * Supports:
       * "Turn on relay 1 and relay 3"
       * "Relay one aur relay three on karo"
       */
      showLoader(
        matchedDevices.length > 1
          ? `${isOn ? "Turning ON" : "Turning OFF"} ${matchedDevices.length} relays...`
          : `${isOn ? "Turning ON" : "Turning OFF"} ${matchedDevices[0].name}...`
      );

      const results = await Promise.all(
        matchedDevices.map((device) =>
          publish(device.commandTopic, payload)
            .then(() => true)
            .catch((error) => {
              console.error("Voice command failed:", error);
              return false;
            })
        )
      );

      hideLoader();

      const successCount = results.filter(Boolean).length;

      if (successCount === matchedDevices.length) {
        if (matchedDevices.length === 1) {
          speak(
            `${matchedDevices[0].name} turned ${
              isOn ? "on" : "off"
            }, boss.`
          );
        } else {
          speak(
            `${successCount} relays turned ${
              isOn ? "on" : "off"
            }, boss.`
          );
        }
      } else {
        speak(
          `Sorry boss, I could control ${successCount} of ${matchedDevices.length} relays.`
        );
      }
    },
    [
      connStatus,
      devices,
      findVoiceDevices,
      hideLoader,
      publish,
      showLoader,
      speak,
    ]
  );

  const startVoiceRecognition =
    useCallback(() => {
      const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;

      if (!SpeechRecognition) {
        speak(
          "Voice recognition is not supported in this browser, boss."
        );
        return;
      }

      if (voiceListening) {
        recognitionRef.current?.stop();
        return;
      }

      const recognition =
        new SpeechRecognition();

      recognition.lang = "en-IN";
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setVoiceListening(true);
        showLoader("Listening to your command...", "voice");
      };

      recognition.onresult = (event) => {
        let transcript = "";

        for (
          let index = event.resultIndex;
          index < event.results.length;
          index += 1
        ) {
          transcript +=
            event.results[index][0].transcript;
        }

        setVoiceListening(true);

        setLoader((previous) => ({
          ...previous,
          message: transcript || "Listening...",
          progress: Math.min(
            previous.progress + 3,
            90
          ),
        }));

        if (
          event.results[
            event.results.length - 1
          ].isFinal
        ) {
          hideLoader();

          const cleanTranscript =
            transcript.trim();

          /*
           * Empty speech is NOT a command.
           * Stop quietly instead of generating a
           * "Sorry boss..." response.
           */
          if (!cleanTranscript) {
            return;
          }

          handleVoiceCommand(cleanTranscript);
        }
      };

      recognition.onerror = (event) => {
        console.error(
          "Voice recognition error:",
          event.error
        );

        setVoiceListening(false);
        hideLoader();

        /*
         * IMPORTANT:
         * Do NOT speak "Sorry boss..." when the user simply
         * presses the mic and does not say anything.
         *
         * Browser errors such as no-speech, aborted and
         * audio-capture are handled silently.
         */
        if (
          event.error === "no-speech" ||
          event.error === "aborted" ||
          event.error === "audio-capture"
        ) {
          return;
        }

        if (event.error === "not-allowed") {
          speak(
            "Boss, please allow microphone permission."
          );
        }
      };

      recognition.onend = () => {
        setVoiceListening(false);
        recognitionRef.current = null;
      };

      recognitionRef.current =
        recognition;

      try {
        recognition.start();
      } catch (error) {
        console.error(
          "Voice start error:",
          error
        );
        setVoiceListening(false);
        hideLoader();
      }
    },
    [
      voiceListening,
      showLoader,
      hideLoader,
      handleVoiceCommand,
      speak,
    ]
  );

  useEffect(() => {
    return () => {
      clearInterval(
        loaderTimerRef.current
      );

      recognitionRef.current?.abort();

      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

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

        {/* ACTIONS + COMPACT JARVIS VOICE */}

        <div className="mqtt-dashboard__actions">

          <JarvisVoiceButton
            listening={voiceListening}
            onClick={startVoiceRecognition}
          />

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
              onCommand={(payload) =>
                runCommand(
                  device,
                  payload
                )
              }
            />
          )
        )}

      </div>

      {loader.visible && (
        <CommandLoader
          message={loader.message}
          progress={loader.progress}
          type={loader.type}
        />
      )}

    </div>
  );
}


/* =========================================================
   COMPACT JARVIS VOICE BUTTON
========================================================= */

function JarvisVoiceButton({
  listening,
  onClick,
}) {
  return (
    <>
      <style>{`
        .jarvis-voice {
          position: relative;
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 190px;
          height: 58px;
          padding: 6px 10px 6px 8px;
          border: 1px solid rgba(0, 234, 255, .38);
          border-radius: 16px;
          background:
            linear-gradient(
              135deg,
              rgba(0, 234, 255, .08),
              rgba(4, 11, 18, .88)
            );
          color: #dffcff;
          cursor: pointer;
          overflow: hidden;
          box-shadow:
            0 0 18px rgba(0, 234, 255, .08),
            inset 0 0 20px rgba(0, 234, 255, .04);
          transition: .25s ease;
        }

        .jarvis-voice:hover {
          border-color: rgba(0, 234, 255, .8);
          box-shadow:
            0 0 24px rgba(0, 234, 255, .18),
            inset 0 0 20px rgba(0, 234, 255, .06);
        }

        .jarvis-voice--listening {
          border-color: #00eaff;
          box-shadow:
            0 0 22px rgba(0, 234, 255, .3),
            inset 0 0 25px rgba(0, 234, 255, .08);
        }

        .jarvis-voice__hud {
          width: 44px;
          height: 44px;
          flex: 0 0 44px;
          position: relative;
          display: grid;
          place-items: center;
          border: 1px solid rgba(0, 234, 255, .65);
          border-radius: 50%;
        }

        .jarvis-voice__hud::before,
        .jarvis-voice__hud::after {
          content: "";
          position: absolute;
          inset: 5px;
          border: 1px dashed rgba(0, 234, 255, .5);
          border-radius: 50%;
          animation: jarvisSpin 7s linear infinite;
        }

        .jarvis-voice__hud::after {
          inset: 11px;
          border-style: solid;
          border-left-color: transparent;
          border-bottom-color: transparent;
          animation-duration: 2.5s;
        }

        .jarvis-voice__mic {
          position: relative;
          z-index: 2;
          font-size: 20px;
          filter: drop-shadow(0 0 7px #00eaff);
        }

        .jarvis-voice__info {
          min-width: 0;
          text-align: left;
          line-height: 1.15;
        }

        .jarvis-voice__title {
          display: block;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1px;
          color: #00eaff;
          margin-bottom: 4px;
        }

        .jarvis-voice__text {
          display: block;
          font-size: 10px;
          color: #91a8b5;
          white-space: nowrap;
        }

        .jarvis-voice__wave {
          display: flex;
          align-items: center;
          gap: 2px;
          height: 20px;
          margin-left: auto;
        }

        .jarvis-voice__wave span {
          width: 2px;
          height: 6px;
          border-radius: 2px;
          background: #00eaff;
          box-shadow: 0 0 6px #00eaff;
        }

        .jarvis-voice--listening
          .jarvis-voice__wave span {
          animation: jarvisWave .55s ease-in-out infinite alternate;
        }

        .jarvis-voice__wave span:nth-child(2) {
          animation-delay: .08s;
        }

        .jarvis-voice__wave span:nth-child(3) {
          animation-delay: .16s;
        }

        .jarvis-voice__wave span:nth-child(4) {
          animation-delay: .24s;
        }

        .jarvis-voice__wave span:nth-child(5) {
          animation-delay: .32s;
        }

        @keyframes jarvisSpin {
          to { transform: rotate(360deg); }
        }

        @keyframes jarvisWave {
          from { height: 5px; opacity: .35; }
          to { height: 18px; opacity: 1; }
        }

        @media (max-width: 900px) {
          .jarvis-voice {
            min-width: 150px;
          }

          .jarvis-voice__info {
            display: none;
          }
        }

        @media (max-width: 600px) {
          .jarvis-voice {
            min-width: 48px;
            width: 48px;
            padding: 2px;
            justify-content: center;
          }

          .jarvis-voice__wave {
            display: none;
          }
        }
      `}</style>

      <button
        type="button"
        className={`jarvis-voice ${
          listening
            ? "jarvis-voice--listening"
            : ""
        }`}
        onClick={onClick}
        aria-label={
          listening
            ? "Stop voice recognition"
            : "Start JARVIS voice command"
        }
      >
        <span className="jarvis-voice__hud">
          <span className="jarvis-voice__mic">
            🎙
          </span>
        </span>

        <span className="jarvis-voice__info">
          <span className="jarvis-voice__title">
            {listening
              ? "LISTENING..."
              : "VOICE COMMAND"}
          </span>

          <span className="jarvis-voice__text">
            {listening
              ? "Speak your command"
              : "Click mic and speak"}
          </span>
        </span>

        <span className="jarvis-voice__wave">
          <span />
          <span />
          <span />
          <span />
          <span />
        </span>
      </button>
    </>
  );
}


/* =========================================================
   MOVING HEXAGON COMMAND LOADER
========================================================= */

function CommandLoader({
  message,
  progress,
  type = "command",
}) {
  return (
    <>
      <style>{`
        /* MIC-STYLE VOICE LOADER */
        .voice-loader-animation {
          width: 185px;
          height: 185px;
          position: relative;
          display: grid;
          place-items: center;
        }

        .voice-loader-ring {
          position: absolute;
          border-radius: 50%;
          border: 1px solid rgba(0, 234, 255, .35);
          animation: voiceLoaderSpin 5s linear infinite;
        }

        .voice-loader-ring--one {
          width: 174px;
          height: 174px;
          border-top: 2px solid #00eaff;
          border-bottom: 2px solid #00eaff;
        }

        .voice-loader-ring--two {
          width: 140px;
          height: 140px;
          border-left: 2px solid #00eaff;
          border-right: 2px solid #00eaff;
          animation-duration: 3s;
          animation-direction: reverse;
        }

        .voice-loader-ring--three {
          width: 112px;
          height: 112px;
          border-top: 1px dashed #00eaff;
          border-bottom: 1px dashed #00eaff;
          animation-duration: 2s;
        }

        .voice-loader-mic {
          position: relative;
          width: 62px;
          height: 88px;
          border: 3px solid #00eaff;
          border-radius: 34px;
          display: flex;
          justify-content: center;
          align-items: center;
          color: #00eaff;
          font-size: 30px;
          background: rgba(0, 234, 255, .035);
          box-shadow:
            0 0 16px #00eaff,
            0 0 42px rgba(0, 234, 255, .45),
            inset 0 0 22px rgba(0, 234, 255, .14);
          animation: voiceMicPulse .75s ease-in-out infinite alternate;
        }

        .voice-loader-mic::after {
          content: "";
          position: absolute;
          width: 96px;
          height: 65px;
          bottom: -46px;
          left: 50%;
          transform: translateX(-50%);
          border: 3px solid #00eaff;
          border-top: 0;
          border-radius: 0 0 52px 52px;
          box-shadow: 0 0 12px rgba(0, 234, 255, .7);
        }

        .voice-loader-wave {
          position: absolute;
          bottom: 17px;
          display: flex;
          align-items: center;
          gap: 4px;
          z-index: 3;
        }

        .voice-loader-wave span {
          width: 3px;
          height: 8px;
          border-radius: 4px;
          background: #00eaff;
          box-shadow: 0 0 8px #00eaff;
          animation: voiceLoaderWave .45s ease-in-out infinite alternate;
        }

        .voice-loader-wave span:nth-child(2) { animation-delay: .08s; }
        .voice-loader-wave span:nth-child(3) { animation-delay: .16s; }
        .voice-loader-wave span:nth-child(4) { animation-delay: .24s; }
        .voice-loader-wave span:nth-child(5) { animation-delay: .32s; }

        @keyframes voiceLoaderSpin {
          to { transform: rotate(360deg); }
        }

        @keyframes voiceMicPulse {
          from {
            transform: scale(.86);
            box-shadow:
              0 0 12px #00eaff,
              0 0 28px rgba(0, 234, 255, .35);
          }
          to {
            transform: scale(1.08);
            box-shadow:
              0 0 20px #00eaff,
              0 0 55px rgba(0, 234, 255, .65);
          }
        }

        @keyframes voiceLoaderWave {
          from { height: 7px; opacity: .4; }
          to { height: 28px; opacity: 1; }
        }

        .command-loader-overlay {
          position: fixed;
          inset: 0;
          z-index: 99999;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, .48);
          backdrop-filter: blur(5px);
          animation: loaderFade .2s ease;
        }

        .command-loader-popup {
          width: min(330px, 88vw);
          min-height: 320px;
          padding: 25px 22px 23px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(225, 0, 255, .4);
          border-radius: 22px;
          background:
            radial-gradient(
              circle at center,
              rgba(225, 0, 255, .11),
              rgba(8, 9, 16, .97) 67%
            );
          box-shadow:
            0 0 40px rgba(225, 0, 255, .2),
            inset 0 0 35px rgba(225, 0, 255, .05);
        }

        .command-loader-animation {
          width: 185px;
          height: 185px;
          position: relative;
          display: grid;
          place-items: center;
        }

        .loader-orbit {
          position: absolute;
          border-radius: 50%;
          border: 2px solid transparent;
          border-top-color: #e100ff;
          border-right-color: rgba(225, 0, 255, .28);
          animation: loaderOrbit 2.2s linear infinite;
        }

        .loader-orbit--one {
          width: 165px;
          height: 165px;
        }

        .loader-orbit--two {
          width: 132px;
          height: 132px;
          border-top-color: #ff36ff;
          border-left-color: rgba(225, 0, 255, .3);
          animation:
            loaderOrbitReverse 1.65s linear infinite;
        }

        .loader-orbit--three {
          width: 102px;
          height: 102px;
          border-bottom-color: rgba(225, 0, 255, .75);
          border-left-color: transparent;
          animation: loaderOrbit 1.25s linear infinite;
        }

        .loader-hex-ring {
          position: absolute;
          width: 116px;
          height: 116px;
          animation: loaderHexSpin 4s linear infinite;
        }

        .loader-hex {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 15px;
          height: 17px;
          margin-left: -7.5px;
          margin-top: -8.5px;
          background: #e100ff;
          clip-path: polygon(
            25% 0%,
            75% 0%,
            100% 50%,
            75% 100%,
            25% 100%,
            0% 50%
          );
          box-shadow:
            0 0 8px #e100ff,
            0 0 18px #e100ff;
          animation: loaderHexPulse .8s ease-in-out infinite alternate;
        }

        .loader-hex:nth-child(1)  { transform: rotate(0deg) translateY(-56px); }
        .loader-hex:nth-child(2)  { transform: rotate(30deg) translateY(-56px); animation-delay: .08s; }
        .loader-hex:nth-child(3)  { transform: rotate(60deg) translateY(-56px); animation-delay: .16s; }
        .loader-hex:nth-child(4)  { transform: rotate(90deg) translateY(-56px); animation-delay: .24s; }
        .loader-hex:nth-child(5)  { transform: rotate(120deg) translateY(-56px); animation-delay: .32s; }
        .loader-hex:nth-child(6)  { transform: rotate(150deg) translateY(-56px); animation-delay: .40s; }
        .loader-hex:nth-child(7)  { transform: rotate(180deg) translateY(-56px); animation-delay: .48s; }
        .loader-hex:nth-child(8)  { transform: rotate(210deg) translateY(-56px); animation-delay: .56s; }
        .loader-hex:nth-child(9)  { transform: rotate(240deg) translateY(-56px); animation-delay: .64s; }
        .loader-hex:nth-child(10) { transform: rotate(270deg) translateY(-56px); animation-delay: .72s; }
        .loader-hex:nth-child(11) { transform: rotate(300deg) translateY(-56px); animation-delay: .80s; }
        .loader-hex:nth-child(12) { transform: rotate(330deg) translateY(-56px); animation-delay: .88s; }

        .loader-center {
          width: 30px;
          height: 30px;
          background: #e100ff;
          clip-path: polygon(
            25% 0%,
            75% 0%,
            100% 50%,
            75% 100%,
            25% 100%,
            0% 50%
          );
          box-shadow:
            0 0 12px #e100ff,
            0 0 35px #e100ff,
            0 0 60px rgba(225, 0, 255, .8);
          animation: loaderCenterPulse .75s ease-in-out infinite alternate;
        }

        .loader-title {
          margin-top: 5px;
          font-size: 23px;
          font-weight: 700;
          color: #fff;
          text-shadow: 0 0 12px #e100ff;
        }

        .loader-message {
          width: 100%;
          margin-top: 7px;
          text-align: center;
          font-size: 13px;
          color: #c3c4d1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .loader-progress {
          width: 215px;
          height: 4px;
          margin-top: 18px;
          overflow: hidden;
          border-radius: 10px;
          background: rgba(255,255,255,.08);
        }

        .loader-progress__bar {
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(
            90deg,
            #8500ff,
            #e100ff,
            #ff52ff
          );
          box-shadow: 0 0 12px #e100ff;
          transition: width .18s linear;
        }

        @keyframes loaderFade {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes loaderOrbit {
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes loaderOrbitReverse {
          to {
            transform: rotate(-360deg);
          }
        }

        @keyframes loaderHexSpin {
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes loaderHexPulse {
          from {
            opacity: .35;
            filter: brightness(.8);
          }
          to {
            opacity: 1;
            filter: brightness(1.5);
          }
        }

        @keyframes loaderCenterPulse {
          from {
            transform: scale(.65);
            opacity: .55;
          }
          to {
            transform: scale(1.35);
            opacity: 1;
          }
        }

        @media (max-width: 500px) {
          .command-loader-popup {
            min-height: 290px;
          }

          .command-loader-animation {
            transform: scale(.86);
            margin-top: -8px;
          }
        }
      `}</style>

      <div className="command-loader-overlay">
        <div className="command-loader-popup">

          {type === "voice" ? (
            <div className="voice-loader-animation">
              <div className="voice-loader-ring voice-loader-ring--one" />
              <div className="voice-loader-ring voice-loader-ring--two" />
              <div className="voice-loader-ring voice-loader-ring--three" />

              <div className="voice-loader-mic">
                🎙
              </div>

              <div className="voice-loader-wave">
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
            </div>
          ) : (
            <div className="command-loader-animation">

              <div className="loader-orbit loader-orbit--one" />
              <div className="loader-orbit loader-orbit--two" />
              <div className="loader-orbit loader-orbit--three" />

              <div className="loader-hex-ring">
                {Array.from(
                  { length: 12 },
                  (_, index) => (
                    <span
                      key={index}
                      className="loader-hex"
                    />
                  )
                )}
              </div>

              <div className="loader-center" />

            </div>
          )}

          <div className="loader-title">
            Processing...
          </div>

          <div className="loader-message">
            {message}
          </div>

          <div className="loader-progress">
            <div
              className="loader-progress__bar"
              style={{
                width: `${progress}%`,
              }}
            />
          </div>

        </div>
      </div>
    </>
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
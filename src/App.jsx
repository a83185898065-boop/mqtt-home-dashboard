import { useState } from "react";
import MqttConnectPage from "./MqttConnect.jsx";
import MqttDashboard from "./MqttDashboard.jsx";
import devices from "./devices.js";

export default function App() {
  // conn = { brokerUrl, options, client } once connected, else null
  const [conn, setConn] = useState(null);

  if (!conn) {
    return <MqttConnectPage onConnected={setConn} />;
  }

  return (
    <MqttDashboard
      brokerUrl={conn.brokerUrl}
      options={conn.options}
      devices={devices}
    />
  );
}

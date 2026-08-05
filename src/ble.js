import { BleClient } from "@capacitor-community/bluetooth-le";

const HEART_RATE_SERVICE = "0000180d-0000-1000-8000-00805f9b34fb";
const HEART_RATE_MEASUREMENT = "00002a37-0000-1000-8000-00805f9b34fb";

// Parses a standard Bluetooth SIG Heart Rate Measurement characteristic value.
// Spec: first byte is flags; bit0 tells us whether the HR value is 8-bit or 16-bit.
function parseHeartRate(dataView) {
  const flags = dataView.getUint8(0);
  const is16Bit = (flags & 0x1) === 1;
  const hr = is16Bit ? dataView.getUint16(1, true) : dataView.getUint8(1);
  return hr;
}

let connectedDeviceId = null;

async function pickDevice(onStatus) {
  // First try: filtered scan for the standard Heart Rate Service. Cleanest
  // UX when it works, but some watches don't include the service UUID in
  // their advertisement packet even though they support it post-connection -
  // in that case this filtered picker would show nothing at all.
  try {
    onStatus && onStatus("scanning", "Recherche d'un appareil compatible FC...");
    return await BleClient.requestDevice({ services: [HEART_RATE_SERVICE] });
  } catch (e) {
    // Fallback: show every nearby BLE device so the watch can be picked by
    // name even if it didn't advertise the HR service directly. We still
    // request the HR service as optional so we can access it post-connect.
    onStatus && onStatus("scanning", "Rien trouv\u00E9 directement \u2014 affichage de tous les appareils \u00E0 proximit\u00E9...");
    try {
      return await BleClient.requestDevice({
        acceptAllDevices: true,
        optionalServices: [HEART_RATE_SERVICE],
      });
    } catch (e2) {
      throw e2;
    }
  }
}

export async function scanAndConnectHrMonitor(onReading, onStatus) {
  try {
    await BleClient.initialize();
  } catch (e) {
    onStatus && onStatus("error", "Le Bluetooth n'est pas disponible sur cet appareil.");
    return;
  }

  const enabled = await BleClient.isEnabled().catch(() => true);
  if (!enabled) {
    onStatus && onStatus("error", "Active le Bluetooth du t\u00E9l\u00E9phone puis r\u00E9essaie.");
    return;
  }

  let device;
  try {
    device = await pickDevice(onStatus);
  } catch (e) {
    const msg = (e && e.message) || "";
    if (/cancel/i.test(msg)) {
      onStatus && onStatus("error", "Aucun appareil s\u00E9lectionn\u00E9. V\u00E9rifie que le broadcast FC est activ\u00E9 sur la montre, puis r\u00E9essaie.");
    } else {
      onStatus && onStatus("error", "Rien trouv\u00E9 \u00E0 proximit\u00E9. V\u00E9rifie que la montre est \u00E0 port\u00E9e et que le broadcast FC est activ\u00E9.");
    }
    return;
  }

  try {
    onStatus && onStatus("connecting", `Connexion \u00E0 ${device.name || "l'appareil"}...`);
    await BleClient.connect(device.deviceId, () => {
      connectedDeviceId = null;
      onStatus && onStatus("disconnected", "Appareil FC d\u00E9connect\u00E9.");
    });

    connectedDeviceId = device.deviceId;
    onStatus && onStatus("connected", device.name || "Connect\u00E9");

    await BleClient.startNotifications(
      device.deviceId,
      HEART_RATE_SERVICE,
      HEART_RATE_MEASUREMENT,
      (value) => {
        const hr = parseHeartRate(value);
        if (hr > 0) onReading(hr);
      }
    );
  } catch (e) {
    connectedDeviceId = null;
    onStatus && onStatus("error", "Connect\u00E9 mais impossible de lire la FC \u2014 cet appareil n'expose peut-\u00EAtre pas le service standard.");
  }
}

export async function disconnectHrMonitor() {
  if (connectedDeviceId) {
    try {
      await BleClient.stopNotifications(connectedDeviceId, HEART_RATE_SERVICE, HEART_RATE_MEASUREMENT);
      await BleClient.disconnect(connectedDeviceId);
    } catch (e) {}
    connectedDeviceId = null;
  }
}

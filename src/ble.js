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

export async function scanAndConnectHrMonitor(onReading, onStatus) {
  try {
    await BleClient.initialize();
  } catch (e) {
    onStatus && onStatus("error", "Bluetooth isn't available on this device.");
    return;
  }

  try {
    onStatus && onStatus("scanning", "Looking for nearby heart rate broadcasts...");
    const device = await BleClient.requestDevice({
      services: [HEART_RATE_SERVICE],
    });

    onStatus && onStatus("connecting", `Connecting to ${device.name || "device"}...`);
    await BleClient.connect(device.deviceId, () => {
      connectedDeviceId = null;
      onStatus && onStatus("disconnected", "Heart rate device disconnected.");
    });

    connectedDeviceId = device.deviceId;
    onStatus && onStatus("connected", device.name || "Connected");

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
    onStatus && onStatus("error", e && e.message ? e.message : "Couldn't connect to a heart rate device.");
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

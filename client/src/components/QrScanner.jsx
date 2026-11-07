// Provides camera and image QR scanning without performing verification itself.
import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

const READER_ID = "certificate-qr-reader";

async function stopAndClear(scanner) {
  if (scanner.isScanning) await scanner.stop();
  await scanner.clear();
}

function getCameraErrorMessage(error) {
  const message = String(error);
  if (/NotAllowedError|permission|denied/i.test(message)) {
    return "Camera permission was denied. Allow camera access in your browser and try again.";
  }
  if (/NotFoundError|DevicesNotFoundError|no camera|camera.*not found/i.test(message)) {
    return "No camera was found on this device.";
  }
  return "The camera could not be started. Check browser permissions and try again.";
}

export default function QrScanner({ onDecoded }) {
  const scannerRef = useRef(null);
  const decodedRef = useRef(false);
  const mountedRef = useRef(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [scanningImage, setScanningImage] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const scanner = scannerRef.current;
      if (scanner) {
        void stopAndClear(scanner).catch(() => {
          // The component is unmounting, so there is no UI left to report cleanup errors.
        });
      }
    };
  }, []);

  function createScanner() {
    const scanner = new Html5Qrcode(READER_ID);
    scannerRef.current = scanner;
    return scanner;
  }

  async function stopCamera() {
    const scanner = scannerRef.current;
    if (!scanner) {
      setCameraActive(false);
      return;
    }

    try {
      await stopAndClear(scanner);
      scannerRef.current = null;
      setCameraActive(false);
    } catch {
      setMessage("The camera could not be stopped. Close this page to end camera access.");
    }
  }

  async function handleDecoded(text) {
    if (decodedRef.current) return;
    decodedRef.current = true;
    const scanner = scannerRef.current;
    if (scanner) {
      try {
        await stopAndClear(scanner);
        scannerRef.current = null;
        if (mountedRef.current) setCameraActive(false);
      } catch {
        if (mountedRef.current) {
          setMessage("The QR code was read, but the camera could not be stopped.");
        }
      }
    }
    if (mountedRef.current) onDecoded(text);
  }

  async function startCamera() {
    setMessage("");
    decodedRef.current = false;

    try {
      const scanner = createScanner();
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (text) => void handleDecoded(text),
        () => {},
      );
      if (mountedRef.current) setCameraActive(true);
    } catch (error) {
      const scanner = scannerRef.current;
      if (scanner) {
        try {
          await stopAndClear(scanner);
        } catch {
          // Report the camera start failure below; cleanup is best effort.
        }
        scannerRef.current = null;
      }
      if (mountedRef.current) setMessage(getCameraErrorMessage(error));
    }
  }

  async function handleImageChange(event) {
    const image = event.target.files?.[0];
    event.target.value = "";
    if (!image) return;

    setMessage("");
    setScanningImage(true);
    decodedRef.current = false;
    try {
      const scanner = createScanner();
      const decodedText = await scanner.scanFile(image, true);
      await stopAndClear(scanner);
      scannerRef.current = null;
      if (mountedRef.current) onDecoded(decodedText);
    } catch {
      const scanner = scannerRef.current;
      if (scanner) {
        try {
          await stopAndClear(scanner);
        } catch {
          // Keep the user-facing scan result focused on the image.
        }
        scannerRef.current = null;
      }
      if (mountedRef.current) setMessage("No QR code found in the image.");
    } finally {
      if (mountedRef.current) setScanningImage(false);
    }
  }

  return (
    <div className="qr-scanner qr-scanner-shell">
      <p className="qr-instruction">
        Scan a certificate QR code or choose a photo. The result is checked against the blockchain.
      </p>
      <div id={READER_ID} className="qr-camera-area qr-camera-frame" aria-label="QR camera preview" />
      <div className="qr-scanner-actions">
        {!cameraActive ? (
          <button
            className="button button-primary"
            type="button"
            onClick={() => void startCamera()}
            disabled={scanningImage}
          >
            Scan with camera
          </button>
        ) : (
          <button
            className="button button-secondary"
            type="button"
            onClick={() => void stopCamera()}
          >
            Stop camera
          </button>
        )}
        <input
          id="qr-image-upload"
          className="qr-image-input"
          type="file"
          accept="image/*"
          aria-label="Upload an image containing a QR code"
          onChange={(event) => void handleImageChange(event)}
          disabled={scanningImage || cameraActive}
        />
        <label className="button button-secondary qr-upload-button" htmlFor="qr-image-upload">
          {scanningImage ? "Reading image…" : "Upload QR image"}
        </label>
      </div>
      <p className="qr-message" aria-live="polite">{message}</p>
    </div>
  );
}

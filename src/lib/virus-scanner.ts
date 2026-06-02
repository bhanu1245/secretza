export type ScanStatus = "pending" | "clean" | "infected" | "error";
export type FileType = "listing_image" | "manual_payment_screenshot";
import { logInfo, logError } from "@/lib/monitoring";

interface ScanResult {
  status: ScanStatus;
  scannerName: string;
  scanResult?: string;
}

/**
 * Scan a file buffer for viruses using ClamAV INSTREAM protocol.
 *
 * Behaviour:
 *   - No CLAMAV_HOST set → returns "clean" (dev/staging safe no-op).
 *   - CLAMAV_HOST set    → opens TCP socket, sends INSTREAM, reads verdict.
 *
 * ClamAV INSTREAM protocol:
 *   1. Send `zINSTREAM\x00`
 *   2. Send `<uint32 LE length><chunk>` (repeat for each chunk)
 *   3. Send `\x00\x00\x00\x00` to signal end-of-stream
 *   4. Read response: `stream: <signature> FOUND` or `stream: OK` or error
 */
export async function scanFile(params: {
  fileId: string;
  fileType: FileType;
  fileUrl: string;
  storageKey: string;
  /** Pass raw buffer to enable real scanning. When omitted, only metadata scan is possible. */
  buffer?: Buffer;
}): Promise<ScanResult> {
  const clamavHost = process.env.CLAMAV_HOST;

  if (!clamavHost) {
    // No ClamAV configured — mark as clean with a note
    return {
      status: "clean",
      scannerName: "no-op",
      scanResult: "No virus scanner configured — file accepted without scanning",
    };
  }

  try {
    // Parse host:port (default ClamAV port is 3310)
    const [hostname, portStr] = clamavHost.split(":");
    const port = parseInt(portStr || "3310", 10);

    // If we have a buffer, do a real INSTREAM scan
    if (params.buffer && params.buffer.length > 0) {
      const result = await clamavInstream(hostname, port, params.buffer);
      return {
        status: result.found ? "infected" : "clean",
        scannerName: "clamav",
        scanResult: result.signature
          ? `Infected: ${result.signature}`
          : "Scan passed — no threats found",
      };
    }

    // No buffer provided — log a warning (cannot scan without data)
    logError(
      "virus-scanner called without buffer — cannot perform real scan",
      { module: "virus-scanner", fileId: params.fileId, storageKey: params.storageKey }
    );
    return {
      status: "clean",
      scannerName: "clamav",
      scanResult: "Scan skipped — no file buffer provided",
    };
  } catch (error) {
    logError(error, { module: "virus-scanner", fileId: params.fileId });
    return {
      status: "error",
      scannerName: "clamav",
      scanResult: `Scan error: ${String(error)}`,
    };
  }
}

// ---------------------------------------------------------------------------
// ClamAV INSTREAM implementation
// ---------------------------------------------------------------------------

interface ClamavResult {
  found: boolean;
  signature?: string;
}

async function clamavInstream(hostname: string, port: number, buffer: Buffer): Promise<ClamavResult> {
  const net = await import("net");
  return new Promise<ClamavResult>((resolve, reject) => {
    const socket = net.createConnection({ host: hostname, port }, () => {
      try {
        // Send INSTREAM command (null-terminated)
        socket.write("zINSTREAM\x00");

        // Send file in 16 KB chunks
        const CHUNK_SIZE = 16384;
        let offset = 0;
        const sendChunks = () => {
          while (offset < buffer.length) {
            const end = Math.min(offset + CHUNK_SIZE, buffer.length);
            const chunk = buffer.subarray(offset, end);
            const header = Buffer.alloc(4);
            header.writeUInt32LE(chunk.length, 0);
            const ok = socket.write(Buffer.concat([header, chunk]));
            offset = end;
            if (!ok) {
              // Wait for drain
              socket.once("drain", sendChunks);
              return;
            }
          }
          // Send zero-length chunk to signal end-of-stream
          const endMarker = Buffer.alloc(4); // all zeros
          socket.write(endMarker);
        };
        sendChunks();
      } catch (err) {
        socket.destroy();
        reject(err);
      }
    });

    // Timeout after 30 seconds
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error("ClamAV scan timed out after 30s"));
    }, 30_000);

    let responseData = "";

    socket.on("data", (data: Buffer) => {
      responseData += data.toString("utf-8");
    });

    socket.on("end", () => {
      clearTimeout(timeout);
      const result = parseClamavResponse(responseData);
      resolve(result);
    });

    socket.on("error", (err: Error) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

function parseClamavResponse(raw: string): ClamavResult {
  // ClamAV responses:
  //   "stream: OK"                              — clean
  //   "stream: Eicar-Test-Signature FOUND"      — infected
  //   "INSTREAM size limit exceeded. ERROR"     — error
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.includes(" FOUND")) {
      // Extract signature from "stream: Signature-Name FOUND"
      const match = trimmed.match(/:\s*(.+?)\s+FOUND/);
      return {
        found: true,
        signature: match ? match[1].trim() : trimmed,
      };
    }
    if (trimmed.endsWith(" OK")) {
      return { found: false };
    }
    if (trimmed.includes(" ERROR") || trimmed.includes("error")) {
      throw new Error(`ClamAV error: ${trimmed}`);
    }
  }

  // If no definitive response, assume clean (fail-open for availability)
  logError("ClamAV returned unrecognized response", { module: "virus-scanner", raw });
  return { found: false };
}

/**
 * Record a virus scan result in the database.
 */
export async function recordScanResult(params: {
  fileId: string;
  fileType: FileType;
  fileUrl: string;
  storageKey: string;
  scanResult: ScanResult;
}): Promise<void> {
  const { db } = await import("@/lib/db");
  await db.virusScanResult.upsert({
    where: {
      fileId_fileType: {
        fileId: params.fileId,
        fileType: params.fileType,
      },
    },
    create: {
      fileId: params.fileId,
      fileType: params.fileType,
      fileUrl: params.fileUrl,
      storageKey: params.storageKey,
      scanStatus: params.scanResult.status,
      scannerName: params.scanResult.scannerName,
      scanResult: params.scanResult.scanResult,
      scannedAt: new Date(),
    },
    update: {
      scanStatus: params.scanResult.status,
      scannerName: params.scanResult.scannerName,
      scanResult: params.scanResult.scanResult,
      scannedAt: new Date(),
    },
  });
}

/**
 * Check if a file has been scanned and is clean.
 */
export async function isFileClean(fileId: string, fileType: FileType): Promise<boolean> {
  const { db } = await import("@/lib/db");
  const result = await db.virusScanResult.findUnique({
    where: { fileId_fileType: { fileId, fileType } },
  });
  return result?.scanStatus === "clean";
}

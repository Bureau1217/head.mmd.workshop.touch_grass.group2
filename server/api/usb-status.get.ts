import { execFile } from 'node:child_process';
import fs from 'node:fs';
import type { UsbDevice, UsbStatusResponse } from '~/types/usb';

let cachedStatus: UsbStatusResponse = {
  connected: false,
  count: 0,
  devices: []
};

let lastCheckTime = 0;
let isCheckRunning = false;
const CACHE_TTL_MS = 2000;

interface RawWinLogicalDisk {
  DeviceID?: string;
  VolumeName?: string;
  Size?: number;
}

interface RawWinDiskDrive {
  Model?: string;
  DeviceID?: string;
  Size?: number;
}

interface RawWinUsbResult {
  logical?: RawWinLogicalDisk | RawWinLogicalDisk[];
  physical?: RawWinDiskDrive | RawWinDiskDrive[];
}

function detectUsbWindows(): Promise<UsbStatusResponse> {
  return new Promise((resolve) => {
    const psScript = `
      try {
        $logical = @(Get-CimInstance Win32_LogicalDisk -Filter "DriveType = 2" -ErrorAction SilentlyContinue | Select-Object DeviceID, VolumeName, Size);
        $physical = @(Get-CimInstance Win32_DiskDrive -Filter "InterfaceType = 'USB'" -ErrorAction SilentlyContinue | Select-Object Model, DeviceID, Size);
        @{ logical = $logical; physical = $physical } | ConvertTo-Json -Compress
      } catch {
        '{"logical":[],"physical":[]}'
      }
    `;

    execFile(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psScript],
      { timeout: 4000 },
      (err, stdout) => {
        if (err || !stdout || !stdout.trim()) {
          resolve({ connected: false, count: 0, devices: [] });
          return;
        }

        try {
          const parsed = JSON.parse(stdout.trim()) as RawWinUsbResult;
          const devices: UsbDevice[] = [];

          const logicalList = Array.isArray(parsed.logical)
            ? parsed.logical
            : parsed.logical
              ? [parsed.logical]
              : [];

          for (const disk of logicalList) {
            if (disk?.DeviceID) {
              const name = disk.VolumeName
                ? `${disk.VolumeName} (${disk.DeviceID})`
                : `Disque amovible (${disk.DeviceID})`;
              devices.push({
                name,
                deviceId: disk.DeviceID,
                type: 'removable',
                mountPoint: disk.DeviceID
              });
            }
          }

          const physicalList = Array.isArray(parsed.physical)
            ? parsed.physical
            : parsed.physical
              ? [parsed.physical]
              : [];

          for (const drive of physicalList) {
            if (drive?.DeviceID) {
              const alreadyListed = devices.some((d) => d.deviceId === drive.DeviceID);
              if (!alreadyListed) {
                devices.push({
                  name: drive.Model?.trim() || 'Clé USB',
                  deviceId: drive.DeviceID,
                  type: 'usb-drive'
                });
              }
            }
          }

          resolve({
            connected: devices.length > 0,
            count: devices.length,
            devices
          });
        } catch {
          resolve({ connected: false, count: 0, devices: [] });
        }
      }
    );
  });
}

function detectUsbDarwin(): Promise<UsbStatusResponse> {
  return new Promise((resolve) => {
    try {
      const volumesPath = '/Volumes';
      if (!fs.existsSync(volumesPath)) {
        resolve({ connected: false, count: 0, devices: [] });
        return;
      }

      const entries = fs.readdirSync(volumesPath);
      // Ignore root volume (Macintosh HD) and hidden volumes
      const usbVolumes = entries.filter((name) => {
        if (name.startsWith('.')) return false;
        if (name.toLowerCase().includes('macintosh hd')) return false;
        return true;
      });

      const devices: UsbDevice[] = usbVolumes.map((vol) => ({
        name: vol,
        type: 'removable',
        mountPoint: `/Volumes/${vol}`
      }));

      resolve({
        connected: devices.length > 0,
        count: devices.length,
        devices
      });
    } catch {
      resolve({ connected: false, count: 0, devices: [] });
    }
  });
}

function detectUsbLinux(): Promise<UsbStatusResponse> {
  return new Promise((resolve) => {
    try {
      const devices: UsbDevice[] = [];
      const mediaPaths = ['/media', '/run/media'];

      for (const base of mediaPaths) {
        if (!fs.existsSync(base)) continue;
        const users = fs.readdirSync(base);
        for (const user of users) {
          const userDir = `${base}/${user}`;
          try {
            if (fs.statSync(userDir).isDirectory()) {
              const drives = fs.readdirSync(userDir);
              for (const drive of drives) {
                devices.push({
                  name: drive,
                  type: 'removable',
                  mountPoint: `${userDir}/${drive}`
                });
              }
            }
          } catch {
            // Ignore permission / stat errors
          }
        }
      }

      resolve({
        connected: devices.length > 0,
        count: devices.length,
        devices
      });
    } catch {
      resolve({ connected: false, count: 0, devices: [] });
    }
  });
}

async function performDetection(): Promise<UsbStatusResponse> {
  switch (process.platform) {
    case 'win32':
      return await detectUsbWindows();
    case 'darwin':
      return await detectUsbDarwin();
    case 'linux':
      return await detectUsbLinux();
    default:
      return { connected: false, count: 0, devices: [] };
  }
}

export default defineEventHandler(async (): Promise<UsbStatusResponse> => {
  const now = Date.now();

  // If initial run (never checked before)
  if (lastCheckTime === 0) {
    lastCheckTime = now;
    cachedStatus = await performDetection();
    return cachedStatus;
  }

  // Refresh in the background if cache is stale and no check is currently running
  if (now - lastCheckTime > CACHE_TTL_MS && !isCheckRunning) {
    isCheckRunning = true;
    performDetection()
      .then((res) => {
        cachedStatus = res;
        lastCheckTime = Date.now();
      })
      .finally(() => {
        isCheckRunning = false;
      });
  }

  return cachedStatus;
});

import { ref, computed, onMounted, onUnmounted } from 'vue';
import type { UsbDevice, UsbStatusResponse } from '~/types/usb';

interface NavigatorWithHardware extends Navigator {
  usb?: {
    addEventListener: (type: string, listener: (event: Event) => void) => void;
    removeEventListener: (type: string, listener: (event: Event) => void) => void;
    getDevices?: () => Promise<Array<{ productName?: string }>>;
  };
  hid?: {
    addEventListener: (type: string, listener: (event: Event) => void) => void;
    removeEventListener: (type: string, listener: (event: Event) => void) => void;
  };
  serial?: {
    addEventListener: (type: string, listener: (event: Event) => void) => void;
    removeEventListener: (type: string, listener: (event: Event) => void) => void;
  };
}

export const useUsbDetection = () => {
  const serverDevices = ref<UsbDevice[]>([]);
  const isServerDetected = ref<boolean>(false);
  const webUsbDevices = ref<UsbDevice[]>([]);
  // Simulated USB count: 0 = none, 1 = first stick, 2 = second stick (Starlink override)
  const simulatedCount = ref<number>(0);

  let pollTimer: ReturnType<typeof setInterval> | null = null;

  const usbDevices = computed<UsbDevice[]>(() => {
    const list: UsbDevice[] = [...serverDevices.value, ...webUsbDevices.value];

    // Add simulated devices if simulation is active and hardware hasn't already provided them
    if (simulatedCount.value >= 1 && list.length < 1) {
      list.push({
        name: 'Clé USB #1 (Alpha)',
        type: 'simulated',
        deviceId: 'SIM-USB-01'
      });
    }

    if (simulatedCount.value >= 2 && list.length < 2) {
      list.push({
        name: 'Clé USB #2 (Sauvegarde & Pause)',
        type: 'simulated',
        deviceId: 'SIM-USB-02'
      });
    }

    return list;
  });

  const usbCount = computed<number>(() => {
    const realCount = serverDevices.value.length + webUsbDevices.value.length;
    return Math.max(realCount, simulatedCount.value);
  });

  // At least 1 USB stick plugged in (triggers red dot at top of page)
  const isUsbConnected = computed<boolean>(() => {
    return usbCount.value >= 1;
  });

  // Second USB stick plugged in (triggers Starlink iframe + space cats + markdown download)
  const isSecondUsbConnected = computed<boolean>(() => {
    return usbCount.value >= 2;
  });

  const pollServerUsbStatus = async () => {
    try {
      const data = await $fetch<UsbStatusResponse>('/api/usb-status');
      if (data) {
        isServerDetected.value = data.connected;
        serverDevices.value = data.devices;
      }
    } catch (err) {
      console.warn('[useUsbDetection] Impossible de récupérer l’état USB du serveur:', err);
    }
  };

  /**
   * Cycle simulation through 0 -> 1 -> 2 -> 0
   */
  const cycleUsbSimulation = () => {
    simulatedCount.value = (simulatedCount.value + 1) % 3;
  };

  const setSimulatedCount = (count: number) => {
    simulatedCount.value = Math.max(0, Math.min(2, count));
  };

  // Keyboard shortcut listener ('u' or 'U' when not focused in an input)
  const handleKeyDown = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      return;
    }

    if (e.key === 'u' || e.key === 'U') {
      cycleUsbSimulation();
    }
  };

  // WebUSB / WebHID / WebSerial event handling
  const handleHardwareConnect = (e: Event) => {
    const customEvt = e as CustomEvent<{ device?: { productName?: string } }>;
    const name = customEvt.detail?.device?.productName || 'Périphérique USB Web';
    if (!webUsbDevices.value.some((d) => d.name === name)) {
      webUsbDevices.value.push({
        name,
        type: 'webusb'
      });
    }
  };

  const handleHardwareDisconnect = () => {
    webUsbDevices.value = [];
  };

  onMounted(() => {
    // Initial fetch and periodic polling (every 2.5s)
    pollServerUsbStatus();
    pollTimer = setInterval(pollServerUsbStatus, 2500);

    // Keyboard shortcut
    window.addEventListener('keydown', handleKeyDown);

    // Web hardware listeners if supported by browser
    if (typeof navigator !== 'undefined') {
      const nav = navigator as NavigatorWithHardware;
      if (nav.usb) {
        nav.usb.addEventListener('connect', handleHardwareConnect);
        nav.usb.addEventListener('disconnect', handleHardwareDisconnect);
      }
      if (nav.hid) {
        nav.hid.addEventListener('connect', handleHardwareConnect);
        nav.hid.addEventListener('disconnect', handleHardwareDisconnect);
      }
      if (nav.serial) {
        nav.serial.addEventListener('connect', handleHardwareConnect);
        nav.serial.addEventListener('disconnect', handleHardwareDisconnect);
      }
    }
  });

  onUnmounted(() => {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }

    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', handleKeyDown);
    }

    if (typeof navigator !== 'undefined') {
      const nav = navigator as NavigatorWithHardware;
      if (nav.usb) {
        nav.usb.removeEventListener('connect', handleHardwareConnect);
        nav.usb.removeEventListener('disconnect', handleHardwareDisconnect);
      }
      if (nav.hid) {
        nav.hid.removeEventListener('connect', handleHardwareConnect);
        nav.hid.removeEventListener('disconnect', handleHardwareDisconnect);
      }
      if (nav.serial) {
        nav.serial.removeEventListener('connect', handleHardwareConnect);
        nav.serial.removeEventListener('disconnect', handleHardwareDisconnect);
      }
    }
  });

  return {
    isUsbConnected,
    isSecondUsbConnected,
    usbCount,
    usbDevices,
    simulatedCount,
    toggleUsbSimulation: cycleUsbSimulation,
    cycleUsbSimulation,
    setSimulatedCount,
    checkNow: pollServerUsbStatus
  };
};

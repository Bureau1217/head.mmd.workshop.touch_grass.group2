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
  const isSimulated = ref<boolean>(false);

  let pollTimer: ReturnType<typeof setInterval> | null = null;

  const usbDevices = computed<UsbDevice[]>(() => {
    const list: UsbDevice[] = [...serverDevices.value, ...webUsbDevices.value];
    if (isSimulated.value) {
      list.push({
        name: 'Clé USB de test (Simulée)',
        type: 'simulated',
        deviceId: 'SIM-USB-01'
      });
    }
    return list;
  });

  const isUsbConnected = computed<boolean>(() => {
    return isServerDetected.value || webUsbDevices.value.length > 0 || isSimulated.value;
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

  const toggleUsbSimulation = () => {
    isSimulated.value = !isSimulated.value;
  };

  // Keyboard shortcut listener ('u' or 'U' when not focused in an input)
  const handleKeyDown = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      return;
    }

    if (e.key === 'u' || e.key === 'U') {
      toggleUsbSimulation();
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
    usbDevices,
    isSimulated,
    toggleUsbSimulation,
    checkNow: pollServerUsbStatus
  };
};

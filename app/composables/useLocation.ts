import { ref, onMounted, onUnmounted } from 'vue';

// Custom interface for iOS DeviceOrientationEvent with webkitCompassHeading
interface ExtendedDeviceOrientationEvent extends DeviceOrientationEvent {
  webkitCompassHeading?: number;
}

export const useLocation = () => {
  // Store the phone's compass direction (0 to 360 degrees)
  const deviceAzimuth = ref<number>(0);

  // Store the user's physical GPS coordinates (Default to Geneva, Switzerland)
  const userLat = ref<number>(46.2044);
  const userLon = ref<number>(6.1432);
  const isGpsActive = ref<boolean>(false);
  const gpsError = ref<string | null>(null);

  // Handle the phone compass orientation
  const handleOrientation = (event: DeviceOrientationEvent) => {
    const extEvent = event as ExtendedDeviceOrientationEvent;

    // iOS provides webkitCompassHeading (0 = North, 90 = East, etc.)
    if (typeof extEvent.webkitCompassHeading === 'number') {
      deviceAzimuth.value = Math.round(extEvent.webkitCompassHeading);
    } else if (event.alpha !== null) {
      // Android / Standard: alpha is 0-360 degrees
      // On Android compass heading is often 360 - alpha
      const heading = (360 - event.alpha) % 360;
      deviceAzimuth.value = Math.round(heading);
    }
  };

  const requestGps = () => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          userLat.value = Number(position.coords.latitude.toFixed(4));
          userLon.value = Number(position.coords.longitude.toFixed(4));
          isGpsActive.value = true;
          gpsError.value = null;
        },
        (error) => {
          console.warn('[useLocation] GPS retrieval error or permission denied:', error.message);
          gpsError.value = error.message;
          // Coordinates remain at default Geneva
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    }
  };

  const setManualLocation = (lat: number, lon: number) => {
    userLat.value = Number(lat.toFixed(4));
    userLon.value = Number(lon.toFixed(4));
    isGpsActive.value = false;
  };

  // Request orientation permission on iOS if needed
  const requestOrientationPermission = async (): Promise<boolean> => {
    if (typeof window === 'undefined') return false;

    const deviceOrientation = window.DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };

    if (typeof deviceOrientation?.requestPermission === 'function') {
      try {
        const response = await deviceOrientation.requestPermission();
        if (response === 'granted') {
          window.addEventListener('deviceorientation', handleOrientation);
          return true;
        }
      } catch (err) {
        console.warn('[useLocation] DeviceOrientation permission error:', err);
      }
      return false;
    }

    return true;
  };

  onMounted(() => {
    requestGps();

    if (typeof window !== 'undefined') {
      window.addEventListener('deviceorientation', handleOrientation);
    }
  });

  onUnmounted(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('deviceorientation', handleOrientation);
    }
  });

  return {
    deviceAzimuth,
    userLat,
    userLon,
    isGpsActive,
    gpsError,
    requestGps,
    setManualLocation,
    requestOrientationPermission
  };
};
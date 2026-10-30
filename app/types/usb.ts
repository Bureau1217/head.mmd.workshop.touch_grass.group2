export interface UsbDevice {
  name: string;
  deviceId?: string;
  type?: 'removable' | 'usb-drive' | 'webusb' | 'webhid' | 'webserial' | 'simulated';
  size?: string;
  mountPoint?: string;
}

export interface UsbStatusResponse {
  connected: boolean;
  count: number;
  devices: UsbDevice[];
}

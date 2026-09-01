import {
  registerPlugin,
  type PluginListenerHandle,
} from "@capacitor/core";

import type { BluetoothDevice } from "../types";

export interface AudioOutputState {
  devices: BluetoothDevice[];
  activeDevice: BluetoothDevice | null;
}

export interface AudioOutputPlugin {
  getOutputDevices(): Promise<AudioOutputState>;

  requestBluetoothPermission(): Promise<{
    granted: boolean;
  }>;

  addListener(
    eventName: "outputDevicesChanged",
    listener: (state: AudioOutputState) => void
  ): Promise<PluginListenerHandle>;
}

export const AudioOutput =
  registerPlugin<AudioOutputPlugin>("AudioOutput");

import {
  BluetoothIcon,
  CarIcon,
  HeadphonesIcon,
  MonitorSpeakerIcon,
  SmartphoneIcon,
  SpeakerIcon,
  UsbIcon,
} from "lucide-react";

export type OutputDeviceLike = {
  name?: string;
  type?: string;
};

export function getOutputDeviceIcon(
  device: OutputDeviceLike | null
) {
  if (!device) {
    return BluetoothIcon;
  }

  const name =
    device.name
      ?.trim()
      .toLocaleLowerCase() ?? "";

  /*
   * Android can expose some classic Bluetooth A2DP
   * products under a generic/headphones route.
   *
   * Keep the existing name-based refinement so
   * speakers and headphones retain the same icons.
   */
  const looksLikeSpeaker =
    /speaker|soundbar|partybox|boombox/.test(
      name
    );

  const looksLikeHeadphones =
    /headphone|headset|earbud|earbuds|buds|airpods|neckband/.test(
      name
    );

  if (looksLikeSpeaker) {
    return SpeakerIcon;
  }

  if (looksLikeHeadphones) {
    return HeadphonesIcon;
  }

  switch (device.type) {
    case "headphones":
    case "wired":
      return HeadphonesIcon;

    case "speaker":
    case "bluetooth":
      return SpeakerIcon;

    case "car":
      return CarIcon;

    case "usb":
      return UsbIcon;

    case "hdmi":
      return MonitorSpeakerIcon;

    default:
      return SmartphoneIcon;
  }
}
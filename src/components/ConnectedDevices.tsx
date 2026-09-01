import React, {
  useEffect,
} from "react";

import {
  AnimatePresence,
  motion,
} from "framer-motion";

import {
  CarIcon,
  CheckIcon,
  HeadphonesIcon,
  MonitorSpeakerIcon,
  SpeakerIcon,
  SmartphoneIcon,
  UsbIcon,
  XIcon,
} from "lucide-react";

import { usePlayer } from "../context/PlayerContext";
import type { BluetoothDevice } from "../types";

const CLOSE_EVENT =
  "audio-beat-close-connected-devices";

let openOverlayCount = 0;

export function isConnectedDevicesOverlayOpen():
  boolean {
  return openOverlayCount > 0;
}

export function closeConnectedDevicesOverlay():
  void {
  window.dispatchEvent(
    new Event(
      CLOSE_EVENT
    )
  );
}

const iconFor = (
  type: BluetoothDevice["type"]
) => {
  switch (type) {
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
};

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ConnectedDevices({
  open,
  onClose,
}: Props) {
  const {
    devices,
    connectedDevice,
  } = usePlayer();

  useEffect(() => {
    if (!open) {
      return;
    }

    openOverlayCount +=
      1;

    const handleGlobalClose =
      () => {
        onClose();
      };

    window.addEventListener(
      CLOSE_EVENT,
      handleGlobalClose
    );

    return () => {
      openOverlayCount =
        Math.max(
          0,
          openOverlayCount - 1
        );

      window.removeEventListener(
        CLOSE_EVENT,
        handleGlobalClose
      );
    };
  }, [
    open,
    onClose,
  ]);

  const orderedDevices =
    [...devices].sort(
      (
        first,
        second
      ) => {
        const firstActive =
          first.id ===
          connectedDevice?.id;

        const secondActive =
          second.id ===
          connectedDevice?.id;

        if (
          firstActive !==
          secondActive
        ) {
          return firstActive
            ? -1
            : 1;
        }

        return first.name.localeCompare(
          second.name,
          undefined,
          {
            sensitivity:
              "base",
          }
        );
      }
    );

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[90] flex items-end justify-center"
          initial={{
            opacity: 0,
          }}
          animate={{
            opacity: 1,
          }}
          exit={{
            opacity: 0,
          }}
          transition={{
            duration: 0.16,
          }}
          role="presentation"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/[0.68] backdrop-blur-[2px]"
            aria-label="Close audio output"
            onClick={
              onClose
            }
          />

          <motion.div
            className="relative z-10 w-full max-w-[430px] overflow-hidden rounded-t-[28px] border-t border-white/[0.10] bg-neutral-950 shadow-[0_-20px_60px_rgba(0,0,0,0.55)]"
            initial={{
              y: "100%",
            }}
            animate={{
              y: 0,
            }}
            exit={{
              y: "100%",
            }}
            transition={{
              type: "spring",
              damping: 30,
              stiffness: 320,
            }}
            drag="y"
            dragDirectionLock
            dragConstraints={{
              top: 0,
              bottom: 0,
            }}
            dragElastic={{
              top: 0,
              bottom: 0.38,
            }}
            onDragEnd={(
              _,
              info
            ) => {
              if (
                info.offset.y >
                  80 ||
                info.velocity.y >
                  650
              ) {
                onClose();
              }
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="devices-title"
          >
            <div className="flex justify-center pb-1 pt-3">
              <div className="h-1.5 w-11 rounded-full bg-white/[0.28]" />
            </div>

            <div className="flex items-center justify-between px-5 pb-4 pt-2">
              <div className="min-w-0">
                <h2
                  id="devices-title"
                  className="text-lg font-bold text-white"
                >
                  Audio output
                </h2>

                <p className="mt-0.5 truncate text-xs text-white/45">
                  {connectedDevice
                    ? connectedDevice.name
                    : "This phone"}
                </p>
              </div>

              <button
                type="button"
                onClick={
                  onClose
                }
                className="ml-4 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-white/75 transition active:scale-95"
                aria-label="Close audio output"
              >
                <XIcon
                  size={19}
                />
              </button>
            </div>

            <div className="max-h-[56vh] overflow-y-auto px-4 pb-[max(22px,env(safe-area-inset-bottom))] no-scrollbar">
              {orderedDevices.length ===
              0 ? (
                <div className="flex min-h-32 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.035] px-6 text-center">
                  <div>
                    <SpeakerIcon
                      size={28}
                      className="mx-auto text-neutral-500"
                    />

                    <p className="mt-3 text-sm font-semibold text-white">
                      No audio output detected
                    </p>
                  </div>
                </div>
              ) : (
                <ul className="space-y-2">
                  {orderedDevices.map(
                    (
                      device:
                        BluetoothDevice
                    ) => {
                      const Icon =
                        iconFor(
                          device.type
                        );

                      const isActive =
                        device.id ===
                        connectedDevice?.id;

                      return (
                        <li
                          key={
                            device.id
                          }
                        >
                          <div
                            className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left ${
                              isActive
                                ? "border-[#1DB954]/[0.35] bg-[#1DB954]/[0.10]"
                                : "border-white/[0.08] bg-white/[0.045]"
                            }`}
                          >
                            <span
                              className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full ${
                                isActive
                                  ? "bg-[#1DB954]/[0.16] text-[#1DB954]"
                                  : "bg-white/[0.08] text-white/70"
                              }`}
                            >
                              <Icon
                                size={21}
                              />
                            </span>

                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold text-white">
                                {
                                  device.name
                                }
                              </span>

                              <span
                                className={`mt-0.5 block truncate text-xs ${
                                  isActive
                                    ? "text-[#1DB954]/[0.85]"
                                    : "text-white/40"
                                }`}
                              >
                                {isActive
                                  ? device.connection ||
                                    "Current output"
                                  : device.connection ||
                                    "Available"}
                              </span>
                            </span>

                            {isActive ? (
                              <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#1DB954] text-black">
                                <CheckIcon
                                  size={16}
                                  strokeWidth={
                                    3
                                  }
                                />
                              </span>
                            ) : null}
                          </div>
                        </li>
                      );
                    }
                  )}
                </ul>
              )}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
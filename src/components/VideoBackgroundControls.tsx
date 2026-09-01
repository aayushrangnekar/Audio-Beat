import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  LinkIcon,
  RefreshCwIcon,
  Trash2Icon,
  VideoIcon,
} from "lucide-react";

import { toast } from "sonner";

import { usePlayer } from "../context/PlayerContext";
import type { Song } from "../types";
import { VideoStorage } from "../plugins/VideoStorage";

interface Props {
  song: Song;
}

function normalizeUrl(value: string): string {
  return value.trim();
}

function isCloudinaryVideoUrl(value: string): boolean {
  try {
    const url = new URL(value);

    return (
      url.protocol === "https:" &&
      url.hostname === "res.cloudinary.com" &&
      url.pathname.includes("/video/upload/")
    );
  } catch {
    return false;
  }
}

export function VideoBackgroundControls({ song }: Props) {
  const {
    getVideoForSong,
    setSongVideo,
    removeSongVideo,
  } = usePlayer();

  const savedVideo = getVideoForSong(song);

  const [urlInput, setUrlInput] =
    useState<string>(savedVideo || "");

  const [isSaving, setIsSaving] =
    useState<boolean>(false);

  const [isRemoving, setIsRemoving] =
    useState<boolean>(false);

  useEffect(() => {
    setUrlInput(savedVideo || "");
  }, [savedVideo, song.id]);

  const normalizedUrl = useMemo(
    () => normalizeUrl(urlInput),
    [urlInput]
  );

  const validCloudinaryUrl =
    isCloudinaryVideoUrl(normalizedUrl);

  const canSave =
    validCloudinaryUrl &&
    normalizedUrl !== savedVideo &&
    !isSaving;

  async function handleSave(): Promise<void> {
    if (!normalizedUrl) {
      toast.error("Paste a Cloudinary video link.");
      return;
    }

    if (!validCloudinaryUrl) {
      toast.error(
        "Use a secure Cloudinary video delivery URL."
      );
      return;
    }

    setIsSaving(true);

    try {
      const result = await VideoStorage.saveVideo({
        songId: song.id,
        url: normalizedUrl,
      });

      setSongVideo(song.id, result.url);

      toast.success(
        `Video linked to "${song.title}"`
      );
    } catch (error) {
      console.error(error);
      toast.error("Unable to save the video link.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRemove(): Promise<void> {
    setIsRemoving(true);

    try {
      await VideoStorage.removeVideo({
        songId: song.id,
      });

      removeSongVideo(song.id);
      setUrlInput("");

      toast.success("Video removed");
    } catch (error) {
      console.error(error);
      toast.error("Unable to remove video.");
    } finally {
      setIsRemoving(false);
    }
  }

  return (
    <div className="no-scrollbar flex h-full w-full flex-col items-center justify-center gap-4 overflow-y-auto px-2 py-4 text-center">
      <VideoIcon
        size={38}
        className="flex-shrink-0 text-white/55"
      />

      <div className="flex-shrink-0">
        <p className="text-sm font-semibold text-white">
          Cloudinary video background
        </p>

        <p className="mt-1 max-w-xs text-xs leading-5 text-white/60">
          Paste the secure Cloudinary video link.
          After saving, swipe left on the album
          artwork to play it silently in a loop.
        </p>
      </div>

      <div className="w-full max-w-sm flex-shrink-0">
        <div className="relative">
          <LinkIcon
            size={17}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/45"
          />

          <input
            type="url"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={urlInput}
            onChange={(event) =>
              setUrlInput(event.target.value)
            }
            placeholder="https://res.cloudinary.com/..."
            className="w-full rounded-xl border border-white/10 bg-black/30 py-3 pl-10 pr-3 text-xs text-white outline-none placeholder:text-white/30 focus:border-white/30"
          />
        </div>

        {normalizedUrl &&
        !validCloudinaryUrl ? (
          <p className="mt-2 text-left text-[11px] text-red-300">
            Paste a Cloudinary HTTPS video URL
            containing /video/upload/.
          </p>
        ) : null}
      </div>

      <div className="flex flex-shrink-0 flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => {
            void handleSave();
          }}
          disabled={!canSave}
          className="flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-black transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-35"
        >
          {savedVideo ? (
            <RefreshCwIcon size={16} />
          ) : (
            <LinkIcon size={16} />
          )}

          {isSaving
            ? "Saving..."
            : savedVideo
              ? "Change link"
              : "Use video"}
        </button>

        {savedVideo ? (
          <button
            type="button"
            onClick={() => {
              void handleRemove();
            }}
            disabled={isRemoving}
            className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition active:scale-95 disabled:opacity-40"
          >
            <Trash2Icon size={16} />

            {isRemoving
              ? "Removing..."
              : "Remove"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
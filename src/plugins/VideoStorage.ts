import {
  Capacitor,
  registerPlugin,
} from "@capacitor/core";

interface NativeVideoStoragePlugin {
  saveVideo(options: {
    songId: string;
    url: string;
  }): Promise<{
    url: string;
  }>;

  getVideo(options: {
    songId: string;
  }): Promise<{
    url: string | null;
  }>;

  removeVideo(options: {
    songId: string;
  }): Promise<void>;

  getAllVideos(): Promise<{
    videos: Record<string, string>;
  }>;

  cacheVideo(options: {
    songId: string;
    url: string;
  }): Promise<{
    url: string;
  }>;
}

const NativeVideoStorage =
  registerPlugin<NativeVideoStoragePlugin>(
    "VideoStorage"
  );

function isCloudinaryVideoUrl(
  value: string
): boolean {
  return (
    value.startsWith(
      "https://res.cloudinary.com/"
    ) &&
    value.includes(
      "/video/upload/"
    )
  );
}

export const VideoStorage = {
  saveVideo(options: {
    songId: string;
    url: string;
  }): Promise<{ url: string }> {
    return NativeVideoStorage.saveVideo(options);
  },

  getVideo(options: {
    songId: string;
  }): Promise<{ url: string | null }> {
    return NativeVideoStorage.getVideo(options);
  },

  async removeVideo(options: {
    songId: string;
  }): Promise<void> {
    await NativeVideoStorage.removeVideo(options);
  },

  async getAllVideos(): Promise<Record<string, string>> {
    const result =
      await NativeVideoStorage.getAllVideos();

    return result.videos;
  },

  async cacheVideo(options: {
    songId: string;
    url: string;
  }): Promise<{ url: string }> {
    const cleanedUrl =
      options.url.trim();

    if (
      !isCloudinaryVideoUrl(
        cleanedUrl
      )
    ) {
      return {
        url: cleanedUrl,
      };
    }

    const result =
      await NativeVideoStorage.cacheVideo({
        songId: options.songId,
        url: cleanedUrl,
      });

    return {
      url: Capacitor.convertFileSrc(
        result.url
      ),
    };
  },
};
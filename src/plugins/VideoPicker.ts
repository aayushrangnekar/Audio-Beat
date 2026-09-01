import {
  FilePicker,
} from "@capawesome/capacitor-file-picker";

export async function pickVideo() {
  const result =
    await FilePicker.pickVideos({
      limit: 1,
      readData: false,
    });

  if (
    !result.files ||
    result.files.length === 0
  ) {
    return null;
  }

  return result.files[0];
}
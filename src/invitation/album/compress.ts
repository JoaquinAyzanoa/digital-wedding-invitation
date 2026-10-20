import imageCompression from 'browser-image-compression';
import type { AlbumPhotoUpload } from '@/shared/api';

// Loaded on demand (dynamic import) when the guest picks photos: the compression library is
// not part of the invitation's first load.

let webpSupport: boolean | undefined;

/** Safari (iPhone) cannot encode WebP on a canvas: it gets JPEG instead. */
function canEncodeWebp(): boolean {
  if (webpSupport === undefined) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    webpSupport = canvas.toDataURL('image/webp').startsWith('data:image/webp');
  }
  return webpSupport;
}

const EXTENSIONS: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

async function dimensions(blob: Blob): Promise<{ width: number; height: number } | null> {
  try {
    const bitmap = await createImageBitmap(blob);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return null; // only metadata: the photo still goes up
  }
}

/** The photo (longest side 2000 px, ~500 KB) and a 480 px thumbnail for the admin gallery. */
export async function preparePhoto(file: File): Promise<AlbumPhotoUpload> {
  const fileType = canEncodeWebp() ? 'image/webp' : 'image/jpeg';
  const photo = await imageCompression(file, {
    maxWidthOrHeight: 2000,
    maxSizeMB: 0.6,
    fileType,
    initialQuality: 0.82,
    useWebWorker: true,
  });
  const thumb = await imageCompression(photo, {
    maxWidthOrHeight: 480,
    fileType: photo.type,
    initialQuality: 0.72,
    useWebWorker: true,
  });
  // The library may fall back to another format; name the files after what came out.
  const ext = EXTENSIONS[photo.type];
  if (!ext || thumb.type !== photo.type) throw new Error('unsupported_format');
  const size = await dimensions(photo);
  return { photo, thumb, ext, width: size?.width ?? null, height: size?.height ?? null };
}

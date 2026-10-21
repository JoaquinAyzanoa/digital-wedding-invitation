import imageCompression from 'browser-image-compression';
import { supabase } from '@/admin/supabase';

const BUCKET = 'site';

function randomName() {
  return crypto.randomUUID();
}

async function upload(path: string, file: Blob, contentType: string): Promise<string> {
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType,
    cacheControl: '31536000',
    upsert: false,
  });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

function compress(file: File, maxSide: number, quality = 0.82): Promise<File> {
  return imageCompression(file, {
    maxWidthOrHeight: maxSide,
    fileType: 'image/webp',
    initialQuality: quality,
    useWebWorker: true,
  });
}

/**
 * Photos: resized in the browser to 2000 px and 1000 px WebP. The 2000 URL is stored;
 * the invitation derives the 1000 one from the name (`-2000.webp` → `-1000.webp`).
 */
export async function uploadPhoto(file: File): Promise<string> {
  const name = randomName();
  const [large, small] = await Promise.all([compress(file, 2000), compress(file, 1000)]);
  const [url] = await Promise.all([
    upload(`photos/${name}-2000.webp`, large, 'image/webp'),
    upload(`photos/${name}-1000.webp`, small, 'image/webp'),
  ]);
  return url;
}

/** Watercolor flowers: transparency matters, WebP keeps it. */
export async function uploadDecoration(file: File): Promise<string> {
  const image = await compress(file, 1200, 0.9);
  return upload(`decorations/${randomName()}.webp`, image, 'image/webp');
}

export const MAX_MUSIC_BYTES = 15 * 1024 * 1024;

export async function uploadMusic(file: File): Promise<string> {
  if (file.size > MAX_MUSIC_BYTES) throw new Error('La canción pesa más de 15 MB.');
  return upload(`music/${randomName()}.mp3`, file, 'audio/mpeg');
}

export const MAX_FONT_BYTES = 2 * 1024 * 1024;

export async function uploadFont(file: File): Promise<string> {
  if (file.size > MAX_FONT_BYTES) throw new Error('La fuente pesa más de 2 MB.');
  const extension = file.name.toLowerCase().endsWith('.otf') ? 'otf' : 'ttf';
  return upload(`fonts/${randomName()}.${extension}`, file, `font/${extension}`);
}

export const MAX_VIDEO_BYTES = 20 * 1024 * 1024;

/**
 * A frame of the video as a JPEG (about 0.4 s in, past any fade from black), to show while
 * the video loads or when the phone does not autoplay. Null if this browser cannot decode it.
 */
async function posterFrame(file: File): Promise<Blob | null> {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = url;
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error('cannot decode'));
    });
    video.currentTime = Math.min(0.4, video.duration / 2);
    await new Promise<void>((resolve) => (video.onseeked = () => resolve()));
    const scale = Math.min(1, 1080 / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** The cover video (MP4, so every phone plays it) and its poster frame next to it. */
export async function uploadVideo(file: File): Promise<string> {
  if (file.size > MAX_VIDEO_BYTES) throw new Error('El video pesa más de 20 MB.');
  if (file.type && file.type !== 'video/mp4') {
    throw new Error('Sube el video en MP4 (los .mov de iPhone no se ven en todos los celulares).');
  }
  const name = randomName();
  const poster = await posterFrame(file);
  if (poster) await upload(`videos/${name}-poster.jpg`, poster, 'image/jpeg');
  return upload(`videos/${name}.mp4`, file, 'video/mp4');
}

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

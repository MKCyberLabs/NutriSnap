import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'path';
import { getSessionUser } from '@/lib/session';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const imageTypes = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
} as const;

function hasImageSignature(buffer: Buffer, extension: keyof typeof imageTypes): boolean {
  if (extension === '.jpg' || extension === '.jpeg') {
    return buffer.length >= 3 && buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  }
  if (extension === '.png') {
    return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  }
  if (extension === '.webp') {
    return buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
  }
  return buffer.toString('ascii', 0, 6) === 'GIF87a' || buffer.toString('ascii', 0, 6) === 'GIF89a';
}

/**
 * API Route to handle local file uploads for meal photos.
 * Saves files to public/uploads/ with unique timestamps.
 */
export async function POST(request: NextRequest) {
  try {
    // 🛡️ Sentinel: Enforce Authentication for File Uploads
    const user = await getSessionUser();
    if (!user || user.requiresPasswordReset) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const extension = path.extname(file.name).toLowerCase();
    if (!(extension in imageTypes)) {
      return NextResponse.json({ error: 'Unsupported image type' }, { status: 400 });
    }
    const imageExtension = extension as keyof typeof imageTypes;
    if (file.type !== imageTypes[imageExtension] || file.size === 0 || file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: 'Invalid image type or size' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (!hasImageSignature(buffer, imageExtension)) {
      return NextResponse.json({ error: 'Invalid image content' }, { status: 400 });
    }
    
    // Ensure the upload directory exists
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    await mkdir(uploadDir, { recursive: true });
    const uniqueFilename = `${randomUUID()}${imageExtension}`;
    const filePath = path.join(uploadDir, uniqueFilename);

    // Save to disk
    await writeFile(filePath, buffer);

    // Return the public URL
    const publicUrl = `/uploads/${uniqueFilename}`;
    return NextResponse.json({ url: publicUrl });
  } catch (error) {
    console.error('Upload API Error:', error);
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
  }
}

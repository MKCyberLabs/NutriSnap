
import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { prisma } from '@/lib/prisma';

/**
 * API Route to handle local file uploads for meal photos.
 * Saves files to public/uploads/ with unique timestamps.
 */
export async function POST(request: NextRequest) {
  try {
    // 🛡️ Sentinel: Enforce Authentication for File Uploads
    const sessionId = request.cookies.get('nutrisnap_session_id')?.value;
    if (!sessionId) {
      return NextResponse.json({ error: 'Unauthorized: Missing session token' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: sessionId },
      select: { id: true }, // Only fetch ID to minimize payload
    });

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Invalid session token' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Ensure the upload directory exists
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    try {
      await mkdir(uploadDir, { recursive: true });
    } catch (e) {
      // Directory might already exist
    }

    // Generate a unique filename: timestamp_random.extension
    const fileExtension = path.extname(file.name).toLowerCase() || '.png';

    // Security Enhancement: Validate file extension
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.svg', '.gif'];
    if (!allowedExtensions.includes(fileExtension)) {
      return NextResponse.json({ error: 'Unsupported file type. Only images are allowed.' }, { status: 400 });
    }

    const uniqueFilename = `${Date.now()}_${Math.floor(Math.random() * 100000)}${fileExtension}`;
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

import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const resolvedParams = await params;
    // Sanitize the filename to prevent directory traversal attacks
    const filename = path.basename(resolvedParams.filename);

    // Ensure filename is not empty after basename extraction
    if (!filename) {
      return new NextResponse('Invalid filename', { status: 400 });
    }
    const filePath = path.join(process.cwd(), 'public', 'uploads', filename);

    // Verify the resolved path is actually within the uploads directory
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    if (!filePath.startsWith(uploadsDir)) {
      return new NextResponse('Invalid path', { status: 400 });
    }

    const fileBuffer = await readFile(filePath);
    
    // Determine content type based on extension
    const ext = path.extname(filename).toLowerCase();
    let contentType = 'image/jpeg';
    if (ext === '.png') contentType = 'image/png';
    else if (ext === '.gif') contentType = 'image/gif';
    else if (ext === '.webp') contentType = 'image/webp';
    else if (ext === '.svg') contentType = 'image/svg+xml';

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error) {
    console.error('File serve error:', error);
    return new NextResponse('File not found', { status: 404 });
  }
}

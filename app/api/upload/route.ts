// app/api/upload/route.ts
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // For Web3.Storage/Storacha
    const storageToken = process.env.NEXT_PUBLIC_WEB3_STORAGE_TOKEN;
    
    if (!storageToken) {
      return NextResponse.json({ error: 'Storage token not configured' }, { status: 500 });
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Create a simple fetch to Web3.Storage
    const uploadFormData = new FormData();
    uploadFormData.append('file', new Blob([buffer], { type: file.type }), file.name);

    const response = await fetch('https://api.web3.storage/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${storageToken}`,
      },
      body: uploadFormData,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    const result = await response.json();
    const ipfsUrl = `https://dweb.link/ipfs/${result.cid}/${file.name}`;

    return NextResponse.json({ ipfsUrl, cid: result.cid });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 }
    );
  }
}
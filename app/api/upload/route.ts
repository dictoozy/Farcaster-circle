// Upload image to IPFS via NFT.Storage
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { image, metadata } = await request.json();
    
    if (!image) {
      return NextResponse.json({ error: 'Image required' }, { status: 400 });
    }

    // Convert base64 to blob
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');
    
    // Upload to NFT.Storage (free IPFS pinning)
    const NFT_STORAGE_KEY = process.env.NFT_STORAGE_KEY;
    
    if (NFT_STORAGE_KEY) {
      // Use NFT.Storage if key available
      const formData = new FormData();
      const blob = new Blob([imageBuffer], { type: 'image/png' });
      formData.append('file', blob, 'circle.png');
      
      const uploadRes = await fetch('https://api.nft.storage/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NFT_STORAGE_KEY}`,
        },
        body: formData,
      });
      
      if (uploadRes.ok) {
        const { value } = await uploadRes.json();
        const imageUrl = `https://ipfs.io/ipfs/${value.cid}`;
        
        // Create full metadata
        const fullMetadata = {
          ...metadata,
          image: imageUrl,
        };
        
        return NextResponse.json({ 
          imageUrl,
          metadataUri: `data:application/json;base64,${Buffer.from(JSON.stringify(fullMetadata)).toString('base64')}`,
        });
      }
    }
    
    // Fallback: return data URL as metadata (works but not ideal for NFTs)
    const fullMetadata = {
      ...metadata,
      image: image, // data URL
    };
    
    return NextResponse.json({
      imageUrl: image,
      metadataUri: `data:application/json;base64,${Buffer.from(JSON.stringify(fullMetadata)).toString('base64')}`,
    });
    
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}

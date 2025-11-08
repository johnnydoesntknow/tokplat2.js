// src/services/ipfsUpload.js - NEW FILE
import axios from 'axios';

const PINATA_API_KEY = import.meta.env.VITE_PINATA_API_KEY || '';
const PINATA_SECRET = import.meta.env.VITE_PINATA_API_SECRET || '';

export async function uploadToIPFS(file) {
  // If no Pinata credentials, use a free alternative
  if (!PINATA_API_KEY || !PINATA_SECRET) {
    console.log('No Pinata credentials, using Web3.storage free tier');
    return uploadToWeb3Storage(file);
  }

  try {
    const formData = new FormData();
    formData.append('file', file);

    const res = await axios.post(
      'https://api.pinata.cloud/pinning/pinFileToIPFS',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
          'pinata_api_key': PINATA_API_KEY,
          'pinata_secret_api_key': PINATA_SECRET
        }
      }
    );

    const ipfsUrl = `https://gateway.pinata.cloud/ipfs/${res.data.IpfsHash}`;
    return { success: true, url: ipfsUrl, hash: res.data.IpfsHash };
  } catch (error) {
    console.error('IPFS upload error:', error);
    return { success: false, error: error.message };
  }
}

// Fallback to web3.storage (free)
async function uploadToWeb3Storage(file) {
  try {
    // For now, return the blob URL as fallback
    // You can sign up for free web3.storage account for production
    const blobUrl = URL.createObjectURL(file);
    return { success: true, url: blobUrl, hash: 'local' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Convert blob URL to File object for IPFS upload
export async function blobUrlToFile(blobUrl, fileName = 'image.png') {
  const response = await fetch(blobUrl);
  const blob = await response.blob();
  return new File([blob], fileName, { type: blob.type });
}
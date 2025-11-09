// src/services/ipfsService.js
import axios from 'axios';

/**
 * IPFS Upload Service
 * Supports multiple providers: Pinata (preferred), Web3.Storage (free), and NFT.Storage (free)
 */

class IPFSService {
  constructor() {
    // Pinata configuration (recommended - fast and reliable)
    this.pinataApiKey = import.meta.env.VITE_PINATA_API_KEY || '';
    this.pinataSecret = import.meta.env.VITE_PINATA_API_SECRET || '';
    
    // Web3.Storage configuration (free alternative)
    this.web3StorageToken = import.meta.env.VITE_WEB3_STORAGE_TOKEN || '';
    
    // NFT.Storage configuration (free alternative)
    this.nftStorageToken = import.meta.env.VITE_NFT_STORAGE_TOKEN || '';
    
    this.provider = this.detectProvider();
    
    console.log('🌐 IPFS Service initialized with provider:', this.provider);
  }

  /**
   * Detect which IPFS provider to use based on available credentials
   */
  detectProvider() {
    if (this.pinataApiKey && this.pinataSecret) {
      return 'pinata';
    } else if (this.web3StorageToken) {
      return 'web3storage';
    } else if (this.nftStorageToken) {
      return 'nftstorage';
    } else {
      console.warn('⚠️ No IPFS provider configured. Images will use temporary URLs.');
      return 'none';
    }
  }

  /**
   * Main upload function - automatically selects best provider
   */
  async uploadImage(file, onProgress = null) {
    if (this.provider === 'none') {
      console.warn('⚠️ No IPFS provider available. Using temporary blob URL.');
      return {
        success: true,
        url: URL.createObjectURL(file),
        hash: 'temporary',
        provider: 'blob'
      };
    }

    try {
      switch (this.provider) {
        case 'pinata':
          return await this.uploadToPinata(file, onProgress);
        case 'web3storage':
          return await this.uploadToWeb3Storage(file, onProgress);
        case 'nftstorage':
          return await this.uploadToNFTStorage(file, onProgress);
        default:
          throw new Error('No IPFS provider configured');
      }
    } catch (error) {
      console.error('❌ IPFS upload failed:', error);
      return {
        success: false,
        error: error.message,
        provider: this.provider
      };
    }
  }

  /**
   * Upload to Pinata (Premium service - recommended)
   */
  async uploadToPinata(file, onProgress) {
    console.log('📤 Uploading to Pinata...');
    
    const formData = new FormData();
    formData.append('file', file);
    
    // Optional: Add metadata
    const metadata = JSON.stringify({
      name: file.name,
      keyvalues: {
        uploadedBy: 'OPN Fractionalization Platform',
        timestamp: new Date().toISOString()
      }
    });
    formData.append('pinataMetadata', metadata);

    const response = await axios.post(
      'https://api.pinata.cloud/pinning/pinFileToIPFS',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
          'pinata_api_key': this.pinataApiKey,
          'pinata_secret_api_key': this.pinataSecret
        },
        onUploadProgress: (progressEvent) => {
          if (onProgress) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onProgress(percentCompleted);
          }
        }
      }
    );

    const ipfsHash = response.data.IpfsHash;
    const ipfsUrl = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;

    console.log('✅ Pinata upload successful:', ipfsHash);

    return {
      success: true,
      url: ipfsUrl,
      hash: ipfsHash,
      provider: 'pinata',
      gateway: 'https://gateway.pinata.cloud/ipfs/'
    };
  }

  /**
   * Upload to Web3.Storage (Free service)
   * Sign up at: https://web3.storage
   */
  async uploadToWeb3Storage(file, onProgress) {
    console.log('📤 Uploading to Web3.Storage...');

    const formData = new FormData();
    formData.append('file', file);

    const response = await axios.post(
      'https://api.web3.storage/upload',
      formData,
      {
        headers: {
          'Authorization': `Bearer ${this.web3StorageToken}`,
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          if (onProgress) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onProgress(percentCompleted);
          }
        }
      }
    );

    const cid = response.data.cid;
    const ipfsUrl = `https://w3s.link/ipfs/${cid}`;

    console.log('✅ Web3.Storage upload successful:', cid);

    return {
      success: true,
      url: ipfsUrl,
      hash: cid,
      provider: 'web3storage',
      gateway: 'https://w3s.link/ipfs/'
    };
  }

  /**
   * Upload to NFT.Storage (Free service)
   * Sign up at: https://nft.storage
   */
  async uploadToNFTStorage(file, onProgress) {
    console.log('📤 Uploading to NFT.Storage...');

    const formData = new FormData();
    formData.append('file', file);

    const response = await axios.post(
      'https://api.nft.storage/upload',
      formData,
      {
        headers: {
          'Authorization': `Bearer ${this.nftStorageToken}`,
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          if (onProgress) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onProgress(percentCompleted);
          }
        }
      }
    );

    const cid = response.data.value.cid;
    const ipfsUrl = `https://nftstorage.link/ipfs/${cid}`;

    console.log('✅ NFT.Storage upload successful:', cid);

    return {
      success: true,
      url: ipfsUrl,
      hash: cid,
      provider: 'nftstorage',
      gateway: 'https://nftstorage.link/ipfs/'
    };
  }

  /**
   * Upload multiple images with progress tracking
   */
  async uploadMultipleImages(files, onProgress = null) {
    console.log(`📤 Uploading ${files.length} images to IPFS...`);
    
    const results = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Update progress for current file
      const fileProgress = (percent) => {
        if (onProgress) {
          const totalProgress = Math.round(((i + percent / 100) / files.length) * 100);
          onProgress(totalProgress, i + 1, files.length);
        }
      };

      const result = await this.uploadImage(file, fileProgress);
      results.push(result);
      
      if (!result.success) {
        console.error(`❌ Failed to upload image ${i + 1}:`, result.error);
      }
    }

    const successful = results.filter(r => r.success);
    console.log(`✅ Uploaded ${successful.length}/${files.length} images successfully`);

    return {
      success: successful.length === files.length,
      results,
      successCount: successful.length,
      totalCount: files.length
    };
  }

  /**
   * Convert blob URL to File object for upload
   */
  async blobUrlToFile(blobUrl, fileName = 'image.png') {
    try {
      const response = await fetch(blobUrl);
      const blob = await response.blob();
      return new File([blob], fileName, { type: blob.type || 'image/png' });
    } catch (error) {
      console.error('❌ Failed to convert blob URL to file:', error);
      throw error;
    }
  }

  /**
   * Get gateway URL for an IPFS hash
   */
  getGatewayUrl(hash) {
    switch (this.provider) {
      case 'pinata':
        return `https://gateway.pinata.cloud/ipfs/${hash}`;
      case 'web3storage':
        return `https://w3s.link/ipfs/${hash}`;
      case 'nftstorage':
        return `https://nftstorage.link/ipfs/${hash}`;
      default:
        return `https://ipfs.io/ipfs/${hash}`; // Public gateway as fallback
    }
  }
}

// Create singleton instance
const ipfsService = new IPFSService();

// Export both the instance and the class
export default ipfsService;
export { IPFSService };
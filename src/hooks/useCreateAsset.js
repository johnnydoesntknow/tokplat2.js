// src/hooks/useCreateAsset.js - FINAL VERSION
import { useState } from 'react';
import { ethers } from 'ethers';
import { useContract } from './useContract';
import { useWeb3 } from '../contexts/Web3Context';
import { ShareType } from '../utils/contracts';

let alphaModeCached = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 60000;

export const useCreateAsset = () => {
  const { fractionalization } = useContract();
  const { address } = useWeb3();
  const [loading, setLoading] = useState(false);

  const checkAlphaMode = async () => {
    const now = Date.now();
    if (alphaModeCached !== null && (now - cacheTimestamp) < CACHE_DURATION) {
      return alphaModeCached;
    }

    if (!fractionalization) return false;
    
    try {
      const mode = await fractionalization.isAlphaMode();
      alphaModeCached = mode;
      cacheTimestamp = now;
      console.log('🔍 Alpha mode (fresh check):', mode);
      return mode;
    } catch (error) {
      console.error('Error checking alpha mode:', error);
      return false;
    }
  };

  const createAsset = async (formData) => {
    if (!fractionalization) throw new Error('Contract not connected');

    try {
      setLoading(true);

      console.log('🚀 Creating asset...');
      console.log('📝 Asset details:', formData);

      // Convert values
      const totalShares = formData.totalShares;
      const pricePerShare = ethers.utils.parseEther(formData.pricePerShare.toString());
      const minPurchase = formData.minPurchaseAmount;
      const maxPurchase = formData.maxPurchaseAmount || 0;

      // ✅ CORRECT: Use WeightedShares and EqualShares from contracts.js
      const shareTypeEnum = formData.shareType === 'weighted' 
        ? ShareType.WeightedShares    // 0
        : ShareType.EqualShares;      // 1

      console.log('📊 Share type:', formData.shareType, '→', shareTypeEnum);
      console.log('📈 Min purchase:', minPurchase);
      console.log('📉 Max purchase:', maxPurchase);
      console.log('💰 Price per share:', ethers.utils.formatEther(pricePerShare), 'OPN');

      // ✅ ADD MULTIPLE IMAGES TO DESCRIPTION
      let fullDescription = formData.assetDescription;

      if (formData.additionalImages && formData.additionalImages.length > 0) {
        fullDescription += '\n\nAdditional Images:';
        formData.additionalImages.forEach((url, index) => {
          fullDescription += `\nImage ${index + 2}: ${url}`;
        });
      }

      console.log('📝 Full description with images:', fullDescription);

      // ✅ CORRECT CONTRACT CALL - MATCHES YOUR ABI EXACTLY!
      // ABI: createFractionalizationRequest(
      //   string _assetType,           // 1
      //   string _assetName,           // 2
      //   string _assetDescription,    // 3
      //   string _assetImageUrl,       // 4
      //   uint256 _totalFractions,     // 5
      //   uint256 _pricePerFraction,   // 6
      //   uint256 _minPurchaseAmount,  // 7
      //   uint256 _maxPurchaseAmount,  // 8
      //   uint8 _shareType             // 9
      // )
      const tx = await fractionalization.createFractionalizationRequest(
        formData.assetType,              // 1. string
        formData.assetName,              // 2. string
        fullDescription,                 // 3. string (with all images!)
        formData.assetImageUrl,          // 4. string
        totalShares,                     // 5. uint256
        pricePerShare,                   // 6. uint256
        minPurchase,                     // 7. uint256
        maxPurchase,                     // 8. uint256
        shareTypeEnum,                   // 9. uint8 (0 or 1)
        { value: 0 }
      );

      console.log('⏳ Transaction sent:', tx.hash);

      const receipt = await tx.wait();
      
      console.log('✅ Transaction confirmed!');
      console.log('📦 Receipt:', receipt);

      let requestId = null;
      let assetId = null;

      const requestCreatedEvent = receipt.events?.find(e => e.event === 'RequestCreated');
      if (requestCreatedEvent) {
        requestId = requestCreatedEvent.args.requestId.toString();
        console.log('📝 Request ID:', requestId);
      }

      const autoApprovedEvent = receipt.events?.find(e => e.event === 'RequestAutoApproved');
      if (autoApprovedEvent) {
        requestId = autoApprovedEvent.args.requestId.toString();
        assetId = autoApprovedEvent.args.assetId.toString();
        console.log('✅ Auto-approved! Asset ID:', assetId);
      }
      
      return { 
        tx, 
        receipt,
        requestId, 
        assetId,
        isAutoApproved: !!autoApprovedEvent
      };
    } catch (err) {
      console.error('❌ Create asset error:', err);
      
      let errorMessage = 'Failed to create asset';
      
      if (err.message.includes('user rejected')) {
        errorMessage = 'Transaction was cancelled';
      } else if (err.message.includes('insufficient funds')) {
        errorMessage = 'Insufficient funds for gas';
      } else if (err.reason) {
        errorMessage = err.reason;
      } else if (err.data?.message) {
        errorMessage = err.data.message;
      }
      
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return { 
    createAsset, 
    checkAlphaMode,
    loading 
  };
};
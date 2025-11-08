// src/hooks/useCreateAsset.js
import { useState } from 'react';
import { ethers } from 'ethers';
import { useContract } from './useContract';
import { useWeb3 } from '../contexts/Web3Context';
import { ShareType } from '../utils/contracts';

export const useCreateAsset = () => {
  const { fractionalization } = useContract();
  const { address } = useWeb3();
  const [loading, setLoading] = useState(false);

  // Check if alpha mode is enabled (NO KYC mode)
  const checkAlphaMode = async () => {
    if (!fractionalization) return false;
    
    try {
      const isAlpha = await fractionalization.isAlphaMode();
      console.log('🔍 Alpha mode check:', isAlpha);
      return isAlpha;
    } catch (error) {
      console.error('❌ Error checking alpha mode:', error);
      return false;
    }
  };

  // Create a new fractionalized asset (NO KYC, ALL PARAMETERS)
  const createAsset = async (formData) => {
    if (!fractionalization) throw new Error('Contract not connected');

    try {
      setLoading(true);

      console.log('🚀 Creating asset (NO KYC, with weighted shares)...');
      console.log('📝 Asset details:', formData);

      // Convert price to wei (with 18 decimals)
      const priceInWei = ethers.utils.parseEther(formData.pricePerShare.toString());

      // ✅ FIX: Convert shareType from string to enum (CORRECT NAMES)
      const shareTypeEnum = formData.shareType === 'weighted' 
        ? ShareType.WeightedShares   // ✅ FIXED: Was ShareType.Weighted
        : ShareType.EqualShares;     // ✅ FIXED: Was ShareType.Equal

      console.log('📊 Share type:', formData.shareType, '→', shareTypeEnum);
      console.log('📈 Min purchase:', formData.minPurchaseAmount);
      console.log('📉 Max purchase:', formData.maxPurchaseAmount);
      console.log('💰 Price per share:', ethers.utils.formatEther(priceInWei), 'OPN');

      // ✅ CALL CONTRACT WITH ALL 9 PARAMETERS (INCLUDING WEIGHTED SHARES)
      const tx = await fractionalization.createFractionalizationRequest(
        formData.assetType || 'Real Estate',
        formData.assetName,
        formData.assetDescription,
        formData.assetImageUrl,
        formData.totalShares,
        priceInWei,
        formData.minPurchaseAmount || 1,        // ✅ Parameter 7
        formData.maxPurchaseAmount || 0,        // ✅ Parameter 8 (0 = unlimited)
        shareTypeEnum                            // ✅ Parameter 9
      );

      console.log('⏳ Transaction sent:', tx.hash);

      const receipt = await tx.wait();
      
      console.log('✅ Transaction confirmed!');
      console.log('📦 Receipt:', receipt);

      // Extract request ID from events
      let requestId = null;
      let assetId = null;

      // Check for RequestCreated event
      const requestCreatedEvent = receipt.events?.find(e => e.event === 'RequestCreated');
      if (requestCreatedEvent) {
        requestId = requestCreatedEvent.args.requestId.toString();
        console.log('📝 Request ID:', requestId);
      }

      // Check for RequestAutoApproved event (should always happen with alpha mode)
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
      
      // Better error messages
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
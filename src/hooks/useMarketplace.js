// src/hooks/useMarketplace.js
import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useContract } from './useContract';
import { useWeb3 } from '../contexts/Web3Context';

export const useMarketplace = () => {
  const { fractionalization, kyc } = useContract();
  const { isConnected, address } = useWeb3();
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch all active assets with new contract structure
  const fetchAssets = useCallback(async () => {
    if (!fractionalization || !isConnected) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log('🔍 Fetching active assets...');

      // ✅ FIX: Get active assets (no pagination parameters)
      const assetIds = await fractionalization.getActiveAssets();
      
      console.log('📊 Found', assetIds.length, 'active assets:', assetIds.map(id => id.toString()));

      // Fetch details for each asset
      const assetPromises = assetIds.map(async (assetId) => {
        try {
          const asset = await fractionalization.assetDetails(assetId);
          const request = await fractionalization.requests(asset.requestId);
          
          console.log('📦 Asset', assetId.toString(), 'details:', {
            tokenId: asset.tokenId.toString(),
            totalSupply: asset.totalSupply.toString(),
            availableSupply: asset.availableSupply.toString(),
            pricePerFraction: ethers.utils.formatEther(asset.pricePerFraction),
            minPurchaseAmount: asset.minPurchaseAmount.toString(),
            maxPurchaseAmount: asset.maxPurchaseAmount.toString(),
            shareType: asset.shareType,
            isActive: asset.isActive
          });
          
          return {
            // Core identifiers
            assetId: assetId.toString(),
            requestId: asset.requestId.toString(),
            tokenId: asset.tokenId.toString(),
            
            // Asset info from request
            proposer: request.proposer,
            assetType: request.assetType,
            assetName: request.assetName,
            assetDescription: request.assetDescription,
            assetImageUrl: request.assetImageUrl,
            
            // ✅ FIX: Read actual values from contract instead of hardcoding
            totalShares: asset.totalSupply.toString(),
            availableShares: asset.availableSupply.toString(),
            pricePerShare: ethers.utils.formatEther(asset.pricePerFraction),
            minPurchaseAmount: asset.minPurchaseAmount.toString(),  // ✅ FIXED: Was hardcoded '1'
            maxPurchaseAmount: asset.maxPurchaseAmount.toString(),  // ✅ FIXED: Was hardcoded '0'
            shareType: asset.shareType,                              // ✅ FIXED: Was hardcoded 0
            
            // Settings
            // ✅ FIX: Remove requiresPurchaserKYC (doesn't exist in NO KYC contract)
            isActive: asset.isActive,
            
            // Metrics
            totalRevenue: ethers.utils.formatEther(asset.totalRevenue || 0),
            
            // Timestamps (not in contract, use current time)
            createdAt: new Date().toISOString(),
            lastActivityAt: new Date().toISOString()
          };
        } catch (err) {
          console.error('❌ Error fetching asset', assetId.toString(), ':', err);
          return null;
        }
      });

      const fetchedAssets = (await Promise.all(assetPromises)).filter(a => a !== null);
      
      console.log('✅ Successfully fetched', fetchedAssets.length, 'assets');
      
      setAssets(fetchedAssets);
    } catch (err) {
      console.error('❌ Error fetching assets:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [fractionalization, isConnected]);

  // ✅ NUCLEAR FIX: Manually encode transaction to bypass ethers cache
const purchaseShares = async (assetId, shareAmount) => {
  if (!fractionalization) throw new Error('Contract not connected');

  try {
    console.log('💰 Purchasing shares:', { assetId, shareAmount });

    const asset = assets.find(a => a.assetId === assetId.toString());
    if (!asset) {
      console.error('❌ Asset not found. Available assets:', assets.map(a => a.assetId));
      throw new Error('Asset not found');
    }

    console.log('📦 Asset found:', {
      assetId: asset.assetId,
      pricePerShare: asset.pricePerShare,
      availableShares: asset.availableShares,
      totalShares: asset.totalShares
    });

    if (!asset.pricePerShare || asset.pricePerShare === '0' || asset.pricePerShare === '0.0') {
      console.error('❌ Invalid price per share:', asset.pricePerShare);
      throw new Error('Asset has invalid price - cannot proceed with purchase');
    }

    console.log('📊 Calculating purchase cost from contract...');
    const result = await fractionalization.calculatePurchaseCost(assetId, shareAmount);
    const totalCost = result.totalCost;
    const maxPrice = ethers.utils.parseEther(asset.pricePerShare.toString());

    if (!maxPrice || maxPrice.isZero()) {
      console.error('❌ maxPrice is zero or undefined:', maxPrice);
      throw new Error('Invalid max price calculated - cannot proceed');
    }

    console.log('💵 Purchase details:', {
      totalCost: ethers.utils.formatEther(totalCost) + ' OPN',
      maxPrice: ethers.utils.formatEther(maxPrice) + ' OPN per share',
      shareAmount: shareAmount.toString(),
      pricePerShare: asset.pricePerShare
    });

    // ✅ NUCLEAR FIX: Manually encode the transaction data
    const iface = new ethers.utils.Interface([
      "function purchaseShares(uint256 _assetId, uint256 _shareAmount, uint256 _maxPricePerShare) payable"
    ]);
    
    const data = iface.encodeFunctionData("purchaseShares", [
      assetId,
      shareAmount,
      maxPrice
    ]);

    console.log('🔥 MANUAL ENCODING:');
    console.log('   Function selector:', data.substring(0, 10));
    console.log('   Full data:', data);
    console.log('   AssetId:', assetId);
    console.log('   ShareAmount:', shareAmount.toString());
    console.log('   MaxPrice:', maxPrice.toString());

    // Get signer from contract
    const signer = fractionalization.signer;
    
    // Send raw transaction
    const tx = await signer.sendTransaction({
      to: fractionalization.address,
      data: data,
      value: totalCost,
      gasLimit: 500000
    });

    console.log('⏳ Purchase transaction sent:', tx.hash);

    await tx.wait();
    
    console.log('✅ Purchase confirmed!');
    
    await fetchAssets();
    
    return tx;
  } catch (err) {
    console.error('❌ Purchase error:', err);
    console.error('Error details:', {
      message: err.message,
      code: err.code,
      data: err.data,
      reason: err.reason
    });
    throw err;
  }
};

  // Transfer shares to another address (NEW)
  const transferShares = async (to, assetId, amount) => {
    if (!fractionalization) throw new Error('Contract not connected');
    
    try {
      console.log('📤 Transferring shares:', { to, assetId, amount });
      
      const tx = await fractionalization.transferShares(to, assetId, amount);
      
      console.log('⏳ Transfer transaction sent:', tx.hash);
      
      await tx.wait();
      
      console.log('✅ Transfer confirmed!');
      
      await fetchAssets();
      return tx;
    } catch (err) {
      console.error('❌ Transfer error:', err);
      throw err;
    }
  };

  // Get user's shares for a specific asset
  const getUserShares = async (userAddress, assetId) => {
    if (!fractionalization || !userAddress) return '0';
    
    try {
      const shares = await fractionalization.getUserShares(userAddress, assetId);
      return shares.toString();
    } catch (err) {
      console.error('❌ Error fetching shares:', err);
      return '0';
    }
  };

  // Get user's ownership percentage (NEW)
  const getUserOwnershipPercentage = async (userAddress, assetId) => {
    if (!fractionalization || !userAddress) return { percentage: 0, shares: 0 };
    
    try {
      const result = await fractionalization.getUserOwnershipPercentage(userAddress, assetId);
      return {
        percentage: result.percentage.toNumber() / 100, // Convert from basis points
        shares: result.shares.toString()
      };
    } catch (err) {
      console.error('❌ Error fetching ownership:', err);
      return { percentage: 0, shares: 0 };
    }
  };

  // Lock shares for a period (NEW)
  const lockShares = async (assetId, amount, lockDuration) => {
    if (!fractionalization) throw new Error('Contract not connected');
    
    try {
      console.log('🔒 Locking shares:', { assetId, amount, lockDuration });
      
      const tx = await fractionalization.lockShares(assetId, amount, lockDuration);
      
      console.log('⏳ Lock transaction sent:', tx.hash);
      
      await tx.wait();
      
      console.log('✅ Shares locked!');
      
      return tx;
    } catch (err) {
      console.error('❌ Lock error:', err);
      throw err;
    }
  };

  // Unlock shares after lock period (NEW)
  const unlockShares = async (assetId) => {
    if (!fractionalization) throw new Error('Contract not connected');
    
    try {
      console.log('🔓 Unlocking shares:', { assetId });
      
      const tx = await fractionalization.unlockShares(assetId);
      
      console.log('⏳ Unlock transaction sent:', tx.hash);
      
      await tx.wait();
      
      console.log('✅ Shares unlocked!');
      
      return tx;
    } catch (err) {
      console.error('❌ Unlock error:', err);
      throw err;
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  // Listen for events
  useEffect(() => {
    if (!fractionalization) return;

    const handleSharesPurchased = (assetId, buyer, amount, totalCost) => {
      console.log('🔔 Shares purchased event:', { 
        assetId: assetId.toString(), 
        buyer, 
        amount: amount.toString(), 
        totalCost: ethers.utils.formatEther(totalCost) 
      });
      fetchAssets();
    };

    const handleRequestAutoApproved = (requestId, assetId, proposer) => {
      console.log('🔔 Request auto-approved:', { 
        requestId: requestId.toString(), 
        assetId: assetId.toString(), 
        proposer 
      });
      fetchAssets();
    };

    const handleSharesTransferred = (assetId, from, to, amount) => {
      console.log('🔔 Shares transferred:', { 
        assetId: assetId.toString(), 
        from, 
        to, 
        amount: amount.toString() 
      });
      fetchAssets();
    };

    fractionalization.on('SharesPurchased', handleSharesPurchased);
    fractionalization.on('RequestAutoApproved', handleRequestAutoApproved);
    fractionalization.on('SharesTransferred', handleSharesTransferred);

    return () => {
      fractionalization.off('SharesPurchased', handleSharesPurchased);
      fractionalization.off('RequestAutoApproved', handleRequestAutoApproved);
      fractionalization.off('SharesTransferred', handleSharesTransferred);
    };
  }, [fractionalization, fetchAssets]);

  return {
    assets,
    loading,
    error,
    purchaseShares,
    transferShares,
    getUserShares,
    getUserOwnershipPercentage,
    lockShares,
    unlockShares,
    refreshAssets: fetchAssets
  };
};
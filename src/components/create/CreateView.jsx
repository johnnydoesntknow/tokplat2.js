// src/components/create/CreateView.jsx
import React, { useState, useEffect } from 'react';
import { useWeb3 } from '../../contexts/Web3Context';
import { useCreateAsset } from '../../hooks/useCreateAsset';
import { useApp } from '../../contexts/AppContext';
import { useContract } from '../../hooks/useContract';
import { CONTRACTS } from '../../utils/contracts';
import { 
  AlertCircle, 
  Loader2, 
  CheckCircle,
  FileText,
  Users,
  ChevronRight,
  ChevronLeft,
  Info,
  TrendingUp,
  ToggleLeft,
  ToggleRight,
  Image,
  Sparkles,
  Wand2,
  X,
  Plus
} from 'lucide-react';
import { ethers } from 'ethers';
import KYCModal from '../kyc/KYCModal';
import ContentWarningModal from '../modals/ContentWarningModal';
import UploadProgressModal from '../modals/UploadProgressModal'; // ✅ NEW IMPORT
import { generateVariations } from '../../services/huggingfaceNew';
import { contentModeration } from '../../services/contentModeration';
import ipfsService from '../../services/ipfsService'; // ✅ NEW IMPORT

const CreateView = () => {
  const { address, isConnected, signer } = useWeb3();
  const { createAsset, checkAlphaMode, loading: createLoading } = useCreateAsset();
  const { showNotification, setUserKYCStatus } = useApp();
  const { kyc } = useContract();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [isAlphaMode, setIsAlphaMode] = useState(false);
  const [kycVerified, setKycVerified] = useState(false);
  const [showKYCModal, setShowKYCModal] = useState(false);
  const [hasCheckedKYC, setHasCheckedKYC] = useState(false);
  
  // Content moderation
  const [contentWarning, setContentWarning] = useState(null);
  const [showContentWarning, setShowContentWarning] = useState(false);
  
  // ✅ NEW: IPFS Upload Progress
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('idle'); // idle, uploading, success, error
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [currentUploadFile, setCurrentUploadFile] = useState(0);
  const [totalUploadFiles, setTotalUploadFiles] = useState(0);
  const [uploadError, setUploadError] = useState(null);
  
  // AI Image Generation
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState([]);
  const [selectedImages, setSelectedImages] = useState([]);
  const [aiPrompt, setAiPrompt] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  
  const [formData, setFormData] = useState({
  assetType: '',
  assetName: '',
  assetDescription: '',
  totalShares: 1000,
  totalAssetValue: '',         
  minPurchaseAmount: 1,
    maxPurchaseAmount: 0,
    shareType: 'weighted',
    requiresPurchaserKYC: false,
    disclaimerAccepted: false
  });

  const [calculatedPrice, setCalculatedPrice] = useState(0);
  const [errors, setErrors] = useState({});
  const hasMaxLimit = formData.maxPurchaseAmount > 0;

  const steps = [
    { number: 1, title: 'Create Images', icon: Sparkles },
    { number: 2, title: 'Asset Details', icon: FileText },
    { number: 3, title: 'Share Structure', icon: Users },
    { number: 4, title: 'Review & Submit', icon: CheckCircle }
  ];

  // Check alpha mode on mount
  useEffect(() => {
    const checkMode = async () => {
      const mode = await checkAlphaMode();
      setIsAlphaMode(mode);
      console.log('🎯 Alpha mode:', mode ? 'ON (auto-approve)' : 'OFF');
    };
    
    if (isConnected) {
      checkMode();
    }
  }, [isConnected, checkAlphaMode]);

  // Calculate price per share from total value
useEffect(() => {
  if (formData.totalAssetValue && formData.totalShares > 0) {
    const price = parseFloat(formData.totalAssetValue) / parseFloat(formData.totalShares);
    setCalculatedPrice(price);
  } else {
    setCalculatedPrice(0);
  }
}, [formData.totalAssetValue, formData.totalShares]);


  // Smart prompt generation based on asset type
  const getPromptForAssetType = (type) => {
    const prompts = {
      'Real Estate': 'Modern luxury villa with infinity pool, Dubai architecture, sunset lighting, professional photography',
      'Vehicles': 'Luxury sports car, sleek design, showroom lighting, professional automotive photography',
      'Art': 'Contemporary abstract art, vibrant colors, gallery lighting, museum quality',
      'Collectibles': 'Rare collectible item, premium display, studio lighting, high detail photography',
      'Other': 'Professional product photography, clean background, premium quality'
    };
    return prompts[type] || prompts['Other'];
  };

  // Handle asset type selection
  const handleAssetTypeSelect = (type) => {
    handleInputChange('assetType', type);
    const defaultPrompt = getPromptForAssetType(type);
    setAiPrompt(defaultPrompt);
    setCustomPrompt(''); // Clear custom prompt when switching types
  };

  // Smart input handler with moderation
  const handleModeratedInput = (field, value) => {
    const result = contentModeration.checkContent(address, value, field);
    
    if (!result.allowed && result.action === 'BLOCKED') {
      setContentWarning(result);
      setShowContentWarning(true);
      return;
    }
    
    if (result.action && result.action !== 'BLOCKED') {
      setContentWarning(result);
      setShowContentWarning(true);
    }
    
    if (result.allowed) {
      handleInputChange(field, value);
    }
  };

  // Generate AI images
  const handleGenerateImages = async () => {
    const prompt = customPrompt || aiPrompt || getPromptForAssetType(formData.assetType);
    
    if (!prompt?.trim()) {
      showNotification('Please enter an image description', 'warning');
      return;
    }

    setIsGenerating(true);
    
    try {
      const results = await generateVariations(prompt, 4);
      
      if (results && results.length > 0) {
        const images = results.map((r, index) => ({
          url: r.image,
          prompt: prompt,
          id: `flux-${Date.now()}-${index}`
        }));
        
        setGeneratedImages(prev => [...prev, ...images]);
        showNotification(`Generated ${images.length} new images!`, 'success');
      } else {
        showNotification('Failed to generate images', 'error');
      }
    } catch (error) {
      console.error('Generation error:', error);
      showNotification('Error generating images', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  // Toggle image selection
  const toggleImageSelection = (image) => {
    if (selectedImages.find(img => img.id === image.id)) {
      setSelectedImages(prev => prev.filter(img => img.id !== image.id));
    } else {
      if (selectedImages.length >= 5) {
        showNotification('Maximum 5 images allowed', 'warning');
        return;
      }
      setSelectedImages(prev => [...prev, image]);
    }
  };

  // ✅ NEW: Upload images to IPFS before submitting
  const uploadImagesToIPFS = async () => {
    if (selectedImages.length === 0) {
      return { success: true, urls: [] };
    }

    setShowUploadModal(true);
    setUploadStatus('uploading');
    setUploadProgress(0);
    setTotalUploadFiles(selectedImages.length);
    setUploadError(null);

    try {
      const uploadedUrls = [];

      for (let i = 0; i < selectedImages.length; i++) {
        setCurrentUploadFile(i + 1);
        const image = selectedImages[i];

        // Convert blob URL to File object
        const file = await ipfsService.blobUrlToFile(image.url, `asset-image-${i + 1}.png`);

        // Upload to IPFS with progress tracking
        const result = await ipfsService.uploadImage(file, (percent) => {
          const totalProgress = Math.round(((i + percent / 100) / selectedImages.length) * 100);
          setUploadProgress(totalProgress);
        });

        if (result.success) {
          uploadedUrls.push(result.url);
          console.log(`✅ Image ${i + 1} uploaded:`, result.url);
        } else {
          throw new Error(`Failed to upload image ${i + 1}: ${result.error}`);
        }
      }

      setUploadStatus('success');
      setUploadProgress(100);

      // Wait a moment to show success state
      await new Promise(resolve => setTimeout(resolve, 1000));

      setShowUploadModal(false);

      return {
        success: true,
        urls: uploadedUrls
      };

    } catch (error) {
      console.error('❌ IPFS upload error:', error);
      setUploadStatus('error');
      setUploadError(error.message);
      
      // Keep modal open on error so user can see what happened
      return {
        success: false,
        error: error.message
      };
    }
  };

  // Validation
  const validateStep = (step) => {
    const newErrors = {};

    switch (step) {
      case 1:
        if (selectedImages.length === 0) {
          newErrors.images = 'Please select at least one image';
        }
        break;
      
      case 2:
        if (!formData.assetType) {
          newErrors.assetType = 'Please select an asset type';
        }
        if (!formData.assetName.trim()) {
          newErrors.assetName = 'Asset name is required';
        }
        if (!formData.assetDescription.trim()) {
          newErrors.assetDescription = 'Description is required';
        }
        break;
      
      case 3:
        if (formData.totalShares < 1) {
          newErrors.totalShares = 'Must have at least 1 share';
        }
        if (!formData.totalAssetValue || parseFloat(formData.totalAssetValue) <= 0) {
  newErrors.totalAssetValue = 'Total value must be greater than 0';
}
        if (formData.minPurchaseAmount < 1) {
          newErrors.minPurchaseAmount = 'Minimum purchase must be at least 1';
        }
        break;

      case 4:
        if (!formData.disclaimerAccepted) {
          newErrors.disclaimerAccepted = 'You must acknowledge the disclaimer';
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    setErrors(prev => ({
      ...prev,
      [field]: undefined
    }));
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, steps.length));
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  // ✅ NEW: Update selectedImages with IPFS URLs after upload
const updateImagesWithIPFS = (ipfsUrls) => {
  const updatedImages = selectedImages.map((img, index) => ({
    ...img,
    url: ipfsUrls[index] || img.url // Replace blob URL with IPFS URL
  }));
  setSelectedImages(updatedImages);
};


 const handleSubmit = async () => {
  if (!validateStep(currentStep)) return;

  try {
    setLoading(true);
    
    console.log('🚀 Starting asset creation...');
    console.log('📤 Step 1: Uploading images to IPFS...');

    // Upload images to IPFS
    const uploadResult = await uploadImagesToIPFS();

    if (!uploadResult.success) {
      showNotification('Failed to upload images to IPFS', 'error');
      setLoading(false);
      return;
    }

    console.log('✅ Images uploaded to IPFS:', uploadResult.urls);
    
    // ✅ UPDATE: Replace blob URLs with IPFS URLs in state
    updateImagesWithIPFS(uploadResult.urls);
    
    console.log('📝 Creating asset on blockchain...');
    
    const submitData = {
      ...formData,
      pricePerShare: calculatedPrice.toString(),
      assetImageUrl: uploadResult.urls[0],
      additionalImages: uploadResult.urls.slice(1)
    };
    
    const { tx, requestId, assetId, isAutoApproved } = await createAsset(submitData);
    
    showNotification(
      isAutoApproved 
        ? `✅ Asset created! ID: ${assetId}`
        : `Request created! ID: ${requestId}`,
      'success'
    );
    
    // Reset form
    setFormData({
      assetType: '',
      assetName: '',
      assetDescription: '',
      totalShares: 1000,
      totalAssetValue: '',
      minPurchaseAmount: 1,
      maxPurchaseAmount: 0,
      shareType: 'weighted',
      requiresPurchaserKYC: false,
      disclaimerAccepted: false
    });
    setCurrentStep(1);
    setGeneratedImages([]);
    setSelectedImages([]);
    setAiPrompt('');
    setCustomPrompt('');
    
  } catch (error) {
    console.error('❌ Submit error:', error);
    showNotification(error.message || 'Failed to create asset', 'error');
  } finally {
    setLoading(false);
  }
};

  // Step 1: Image Generation & Selection
  const renderImageStep = () => (
    <div className="space-y-6">
      {/* Asset Type Selector */}
      <div className="bg-neutral-900 p-6 border border-neutral-800">
        <h3 className="text-xl font-normal text-white mb-4">Select Asset Type</h3>
        <div className="grid grid-cols-5 gap-3">
          {['Real Estate', 'Vehicles', 'Art', 'Collectibles', 'Other'].map(type => (
            <button
              key={type}
              onClick={() => handleAssetTypeSelect(type)}
              className={`p-3 border rounded transition-all ${
                formData.assetType === type
                  ? 'border-purple-500 bg-purple-500/20 text-white'
                  : 'border-neutral-800 text-neutral-400 hover:border-neutral-700'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Image Generation */}
      <div className="bg-neutral-900 p-6 border border-neutral-800">
        <h3 className="text-xl font-normal text-white mb-4 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-500" />
          Generate Asset Images
        </h3>

        {/* Selected Images Count */}
        {selectedImages.length > 0 && (
          <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded flex justify-between items-center">
            <span className="text-sm text-green-400">
              {selectedImages.length}/5 images selected
            </span>
            <button
              onClick={() => setSelectedImages([])}
              className="text-xs text-red-400 hover:text-red-300"
            >
              Clear Selection
            </button>
          </div>
        )}

        {/* Prompt Input */}
        <div className="mb-4">
          <label className="block text-sm text-neutral-400 mb-2">
            Describe your asset (AI will generate images)
          </label>
          <textarea
            value={customPrompt || aiPrompt}
            onChange={(e) => {
              const result = contentModeration.checkContent(address, e.target.value, 'aiPrompt');
              if (result.allowed) {
                setCustomPrompt(e.target.value);
              } else if (result.action === 'BLOCKED') {
                setContentWarning(result);
                setShowContentWarning(true);
              }
            }}
            placeholder={getPromptForAssetType(formData.assetType || 'Other')}
            rows={2}
            className="w-full bg-black border border-neutral-800 px-4 py-3 text-white"
          />
        </div>

        {/* Generate Button */}
        <button
          onClick={handleGenerateImages}
          disabled={isGenerating}
          className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Wand2 className="w-5 h-5" />
              Generate Images
            </>
          )}
        </button>
      </div>

      {/* Generated Images Grid */}
      {generatedImages.length > 0 && (
        <div className="bg-neutral-900 p-6 border border-neutral-800">
          <h3 className="text-xl font-normal text-white mb-4">Select Images (up to 5)</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {generatedImages.map(image => (
              <div 
                key={image.id}
                onClick={() => toggleImageSelection(image)}
                className={`relative aspect-square cursor-pointer rounded overflow-hidden border-2 transition-all ${
                  selectedImages.find(img => img.id === image.id)
                    ? 'border-green-500 ring-2 ring-green-500/50'
                    : 'border-neutral-800 hover:border-neutral-700'
                }`}
              >
                <img 
                  src={image.url} 
                  alt="Generated" 
                  className="w-full h-full object-cover"
                />
                {selectedImages.find(img => img.id === image.id) && (
                  <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                    <CheckCircle className="w-12 h-12 text-green-500" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {errors.images && (
        <div className="flex items-center gap-2 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4" />
          {errors.images}
        </div>
      )}
    </div>
  );


  // Step 2: Asset Details
  const renderDetailsStep = () => (
    <div className="space-y-6">
      {/* Show Selected Images */}
      <div className="bg-neutral-900 p-6 border border-neutral-800">
        <h3 className="text-xl font-normal text-white mb-4">Selected Images</h3>
        <div className="grid grid-cols-5 gap-2">
          {selectedImages.map((img, idx) => (
            <div key={img.id} className="relative">
              <img 
                src={img.url} 
                alt={`Selected ${idx + 1}`}
                className="w-full aspect-square object-cover rounded border border-purple-500/50"
              />
              {idx === 0 && (
                <span className="absolute top-1 left-1 bg-purple-600 text-white text-xs px-2 py-1 rounded">
                  Main
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Asset Information */}
      <div className="bg-neutral-900 p-6 border border-neutral-800">
        <h3 className="text-xl font-normal text-white mb-4">Asset Information</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-neutral-400 mb-2">Asset Name *</label>
            <input
              type="text"
              value={formData.assetName}
              onChange={(e) => handleModeratedInput('assetName', e.target.value)}
              placeholder="Enter a name for your asset"
              maxLength={128}
              className={`w-full bg-black border px-4 py-3 text-white ${
                errors.assetName ? 'border-red-500' : 'border-neutral-800'
              }`}
            />
            {errors.assetName && (
              <p className="text-red-400 text-xs mt-1">{errors.assetName}</p>
            )}
          </div>

          <div>
            <label className="block text-sm text-neutral-400 mb-2">Description *</label>
            <textarea
              value={formData.assetDescription}
              onChange={(e) => handleModeratedInput('assetDescription', e.target.value)}
              placeholder="Provide a detailed description of your asset..."
              rows={6}
              className={`w-full bg-black border px-4 py-3 text-white ${
                errors.assetDescription ? 'border-red-500' : 'border-neutral-800'
              }`}
            />
            {errors.assetDescription && (
              <p className="text-red-400 text-xs mt-1">{errors.assetDescription}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // Step 3: Share Structure
  const renderShareStep = () => (
    <div className="space-y-6">
      {/* ============ SHARE TYPE SELECTOR ============ */}
      <div className="bg-neutral-900 p-6 border border-neutral-800">
        <h4 className="text-lg font-normal text-white mb-3">Share Structure Type</h4>
        <p className="text-sm text-neutral-400 mb-4">
          Choose how users will purchase shares in your asset
        </p>
        
        <div className="grid grid-cols-2 gap-4">
          {/* Weighted Shares Option */}
          <button
            type="button"
            onClick={() => handleInputChange('shareType', 'weighted')}
            className={`p-4 border rounded transition-all ${
              formData.shareType === 'weighted'
                ? 'bg-white text-black border-white'
                : 'bg-black text-white border-neutral-800 hover:border-neutral-600'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-5 h-5 rounded-full border-2 mt-0.5 ${
                formData.shareType === 'weighted'
                  ? 'border-black bg-black'
                  : 'border-neutral-600'
              }`}>
                {formData.shareType === 'weighted' && (
                  <div className="w-2.5 h-2.5 bg-white rounded-full m-auto mt-0.5" />
                )}
              </div>
              
              <div className="flex-1 text-left">
                <p className="font-semibold mb-1">Weighted Shares</p>
                <p className="text-xs opacity-70">
                  Buy by percentage (e.g., "I want 2.5% of this property")
                </p>
                <p className="text-xs opacity-70 mt-2">
                  • Total: 1,000,000 units = 100%<br/>
                  • Users purchase exact percentages<br/>
                  • Best for real estate & high-value assets
                </p>
              </div>
            </div>
          </button>

          {/* Equal Shares Option */}
          <button
            type="button"
            onClick={() => handleInputChange('shareType', 'equal')}
            className={`p-4 border rounded transition-all ${
              formData.shareType === 'equal'
                ? 'bg-white text-black border-white'
                : 'bg-black text-white border-neutral-800 hover:border-neutral-600'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-5 h-5 rounded-full border-2 mt-0.5 ${
                formData.shareType === 'equal'
                  ? 'border-black bg-black'
                  : 'border-neutral-600'
              }`}>
                {formData.shareType === 'equal' && (
                  <div className="w-2.5 h-2.5 bg-white rounded-full m-auto mt-0.5" />
                )}
              </div>
              
              <div className="flex-1 text-left">
                <p className="font-semibold mb-1">Equal Shares</p>
                <p className="text-xs opacity-70">
                  Buy fixed number of shares (e.g., "I want 100 shares")
                </p>
                <p className="text-xs opacity-70 mt-2">
                  • You define total number of shares<br/>
                  • Users purchase whole shares<br/>
                  • Best for art, collectibles & vehicles
                </p>
              </div>
            </div>
          </button>
        </div>

        {/* Info box for weighted shares */}
        {formData.shareType === 'weighted' && (
          <div className="mt-4 p-4 bg-blue-900/10 border border-blue-900/30 rounded">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-neutral-300">
                <p className="font-semibold text-white mb-1">Weighted Shares Explained:</p>
                <p>
                  Your asset will be divided into 1,000,000 units representing 100.0000% ownership. 
                  When users buy, they select a percentage (like 0.5% or 10%), and the system automatically 
                  calculates the exact number of units. This makes it intuitive for investors to understand 
                  exactly what portion of the asset they own.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Info box for equal shares */}
        {formData.shareType === 'equal' && (
          <div className="mt-4 p-4 bg-purple-900/10 border border-purple-900/30 rounded">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-neutral-300">
                <p className="font-semibold text-white mb-1">Equal Shares Explained:</p>
                <p>
                  You define the total number of shares (e.g., 1,000 shares). Each share is identical 
                  and represents an equal portion of the asset. Users purchase whole shares (not fractions), 
                  making it simple for items like collectibles where you want specific, countable ownership units.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Share Details */}
      <div className="bg-neutral-900 p-6 border border-neutral-800">
        <h3 className="text-xl font-normal text-white mb-4">Share Details</h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-neutral-400 mb-2">Total Shares *</label>
            <input
              type="number"
              value={formData.totalShares}
              onChange={(e) => handleInputChange('totalShares', parseInt(e.target.value) || 0)}
              min="1"
              className={`w-full bg-black border px-4 py-3 text-white ${
                errors.totalShares ? 'border-red-500' : 'border-neutral-800'
              }`}
            />
            {errors.totalShares && (
              <p className="text-red-400 text-xs mt-1">{errors.totalShares}</p>
            )}
          </div>

         <div>
  <label className="block text-sm text-neutral-400 mb-2">Total Asset Value (OPN) *</label>
  <input
    type="number"
    value={formData.totalAssetValue}
    onChange={(e) => handleInputChange('totalAssetValue', e.target.value)}
    step="0.01"
    min="0.01"
    placeholder="1000"
    className={`w-full bg-black border px-4 py-3 text-white ${
      errors.totalAssetValue ? 'border-red-500' : 'border-neutral-800'
    }`}
  />
  {errors.totalAssetValue && (
    <p className="text-red-400 text-xs mt-1">{errors.totalAssetValue}</p>
  )}
  
  {/* ✅ NEW: Show calculated price */}
  {calculatedPrice > 0 && (
    <p className="text-xs text-green-400 mt-2">
      = {calculatedPrice.toFixed(6)} OPN per {formData.shareType === 'weighted' ? 'unit' : 'share'}
    </p>
  )}
</div>

          <div>
            <label className="block text-sm text-neutral-400 mb-2">Min Purchase *</label>
            <input
              type="number"
              value={formData.minPurchaseAmount}
              onChange={(e) => handleInputChange('minPurchaseAmount', parseInt(e.target.value) || 1)}
              min="1"
              className={`w-full bg-black border px-4 py-3 text-white ${
                errors.minPurchaseAmount ? 'border-red-500' : 'border-neutral-800'
              }`}
            />
          </div>

          <div>
            <label className="block text-sm text-neutral-400 mb-2">Max per User</label>
            <input
              type="number"
              value={hasMaxLimit ? formData.maxPurchaseAmount : ''}
              onChange={(e) => handleInputChange('maxPurchaseAmount', parseInt(e.target.value) || 0)}
              min="0"
              placeholder="Unlimited"
              className="w-full bg-black border border-neutral-800 px-4 py-3 text-white"
            />
          </div>
        </div>

        {formData.totalAssetValue && formData.totalShares && (
  <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded">
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <p className="text-sm text-neutral-400">Total Asset Value:</p>
        <p className="text-2xl font-light text-white">
          {parseFloat(formData.totalAssetValue).toFixed(2)} OPN
        </p>
      </div>
      <div className="flex justify-between items-center text-sm">
        <p className="text-neutral-500">Price per {formData.shareType === 'weighted' ? 'unit' : 'share'}:</p>
        <p className="text-white font-mono">{calculatedPrice.toFixed(6)} OPN</p>
      </div>
    </div>
  </div>
)}
      </div>
    </div>
  );

  // Step 4: Review & Submit
  const renderReviewStep = () => (
    <div className="space-y-6">
      <div className="bg-neutral-900 p-6 border border-neutral-800">
        <h3 className="text-xl font-normal text-white mb-4">Review Your Asset</h3>
        
        <div className="mb-4">
          <p className="text-sm text-neutral-400 mb-2">Images ({selectedImages.length})</p>
          <div className="grid grid-cols-5 gap-2">
            {selectedImages.map((img, idx) => (
              <img 
                key={img.id}
                src={img.url} 
                alt={`Review ${idx + 1}`}
                className="w-full aspect-square object-cover rounded border border-neutral-800"
              />
            ))}
          </div>
        </div>
        
        <div className="space-y-3">
          <div className="flex justify-between py-2 border-b border-neutral-800">
            <span className="text-neutral-400">Type</span>
            <span className="text-white">{formData.assetType}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-neutral-800">
            <span className="text-neutral-400">Name</span>
            <span className="text-white">{formData.assetName}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-neutral-800">
            <span className="text-neutral-400">Share Type</span>
            <span className="text-white">{formData.shareType === 'weighted' ? 'Weighted (Percentage-based)' : 'Equal (Fixed shares)'}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-neutral-800">
            <span className="text-neutral-400">Total Shares</span>
            <span className="text-white">{formData.totalShares.toLocaleString()}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-neutral-800">
  <span className="text-neutral-400">Total Asset Value</span>
  <span className="text-white">{formData.totalAssetValue} OPN</span>
</div>
<div className="flex justify-between py-2 border-b border-neutral-800">
  <span className="text-neutral-400">Price per {formData.shareType === 'weighted' ? 'Unit' : 'Share'}</span>
  <span className="text-white font-mono">{calculatedPrice.toFixed(6)} OPN</span>
</div>
          <div className="flex justify-between py-2 border-b border-neutral-800">
            <span className="text-neutral-400">Min Purchase</span>
            <span className="text-white">{formData.minPurchaseAmount} units</span>
          </div>
          <div className="flex justify-between py-2 border-b border-neutral-800">
            <span className="text-neutral-400">Max per User</span>
            <span className="text-white">{formData.maxPurchaseAmount > 0 ? `${formData.maxPurchaseAmount} units` : 'Unlimited'}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-neutral-400">Total Value</span>
            <span className="text-white font-semibold">
              {(parseFloat(formData.pricePerShare || 0) * parseInt(formData.totalShares)).toFixed(2)} OPN
            </span>
          </div>
        </div>
      </div>

      {/* Disclaimer Section */}
      <div className="bg-yellow-900/20 border border-yellow-600/50 p-6 rounded">
        <h4 className="text-yellow-500 font-semibold mb-3 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          Important Disclaimer
        </h4>
        
        <div className="space-y-3 text-sm text-yellow-200/80 mb-4">
          <p>
            <strong>⚠️ This is a demonstration platform for educational and entertainment purposes only.</strong>
          </p>
          <p>
            • The assets, tokens, and transactions on this platform have NO real-world value
          </p>
          <p>
            • This is NOT an investment platform and does NOT involve real money or real assets
          </p>
          <p>
            • Any "OPN" tokens or shares are purely fictional and for demonstration purposes
          </p>
          <p>
            • No actual ownership, rights, or financial returns are associated with these digital assets
          </p>
          <p>
            • This platform is a technical demonstration of blockchain fractionalization concepts
          </p>
        </div>

        <label className="flex items-start gap-3 cursor-pointer p-4 bg-black/30 border border-yellow-600/30 rounded">
          <input
            type="checkbox"
            checked={formData.disclaimerAccepted}
            onChange={(e) => handleInputChange('disclaimerAccepted', e.target.checked)}
            className="mt-0.5 w-5 h-5 bg-black border-2 border-yellow-600"
          />
          <div>
            <p className="text-white font-medium">I understand and acknowledge</p>
            <p className="text-xs text-yellow-300 mt-1">
              I confirm that I understand this is a demonstration platform with no real value, 
              and I am using it purely for educational or entertainment purposes. I acknowledge 
              that no real assets, money, or ownership rights are involved.
            </p>
          </div>
        </label>

        {errors.disclaimerAccepted && (
          <div className="mt-3 p-3 bg-red-900/30 border border-red-600/50 rounded">
            <p className="text-xs text-red-400">You must acknowledge the disclaimer to proceed</p>
          </div>
        )}
      </div>
    </div>
  );

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-neutral-500 mx-auto mb-4" />
          <h2 className="text-xl font-light text-white mb-2">Wallet Not Connected</h2>
          <p className="text-neutral-400 font-light">Please connect your wallet to create assets</p>
        </div>
      </div>
    );
  }

  return (
  <div className="min-h-screen bg-black">
    <div className="max-w-5xl mx-auto px-6 py-12">
      <h1 className="text-4xl font-light text-white mb-8 flex items-center gap-3">
        Create Fractionalized Asset
        <Sparkles className="w-8 h-8 text-purple-500" />
      </h1>

      {/* Progress Steps */}
      <div className="mb-8 flex items-center justify-between">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = currentStep >= step.number;
          const isCompleted = currentStep > step.number;
          
          return (
            <React.Fragment key={step.number}>
              <div className="flex flex-col items-center">
                <div className={`
                  w-12 h-12 rounded-full flex items-center justify-center mb-2
                  ${isActive ? 'bg-blue-500' : 'bg-neutral-800'}
                  ${isCompleted ? 'bg-green-500' : ''}
                `}>
                  <Icon className={`w-6 h-6 ${isActive ? 'text-white' : 'text-neutral-500'}`} />
                </div>
                <span className={`text-xs ${isActive ? 'text-white' : 'text-neutral-500'}`}>
                  {step.title}
                </span>
              </div>
              
              {index < steps.length - 1 && (
                <div className={`flex-1 h-0.5 ${
                  currentStep > step.number ? 'bg-green-500' : 'bg-neutral-800'
                }`} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Step Content */}
      <div className="mb-8">
        {currentStep === 1 && renderImageStep()}
        {currentStep === 2 && renderDetailsStep()}
        {currentStep === 3 && renderShareStep()}
        {currentStep === 4 && renderReviewStep()}
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={prevStep}
          disabled={currentStep === 1}
          className={`px-6 py-3 border flex items-center gap-2 ${
            currentStep === 1 
              ? 'border-neutral-800 text-neutral-600 cursor-not-allowed' 
              : 'border-neutral-700 text-white hover:bg-neutral-900'
          }`}
        >
          <ChevronLeft className="w-4 h-4" />
          Previous
        </button>

        {currentStep < steps.length ? (
          <button
            onClick={nextStep}
            className="px-8 py-3 bg-blue-500 text-white hover:bg-blue-600 flex items-center gap-2"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={loading || createLoading}
            className={`px-8 py-3 flex items-center gap-2 ${
              loading || createLoading
                ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                : 'bg-green-500 text-white hover:bg-green-600'
            }`}
          >
            {loading || createLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Create Asset
              </>
            )}
          </button>
        )}
      </div>
    </div>

    {/* Modals */}
    {showKYCModal && (
      <KYCModal
        isOpen={showKYCModal}
        onClose={() => setShowKYCModal(false)}
        onSuccess={() => {
          setKycVerified(true);
          setUserKYCStatus(true);
          setShowKYCModal(false);
          handleSubmit();
        }}
        context="create"
      />
    )}
    
    <ContentWarningModal
      isOpen={showContentWarning}
      onClose={() => setShowContentWarning(false)}
      warning={contentWarning}
      onAction={(action) => console.log('Action:', action)}
    />

    {/* ✅ NEW: Upload Progress Modal - THIS IS THE ONLY NEW ADDITION */}
    <UploadProgressModal
      isOpen={showUploadModal}
      progress={uploadProgress}
      currentFile={currentUploadFile}
      totalFiles={totalUploadFiles}
      status={uploadStatus}
      error={uploadError}
    />
  </div>
);
};

export default CreateView;
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
import { generateVariations } from '../../services/huggingfaceNew';
import { contentModeration } from '../../services/contentModeration';

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
    pricePerShare: '',
    minPurchaseAmount: 1,
    maxPurchaseAmount: 0,
    shareType: 'weighted',
    requiresPurchaserKYC: false,
    disclaimerAccepted: false
  });

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
      console.log('🎯 Alpha mode:', mode ? 'ENABLED' : 'DISABLED');
    };
    checkMode();
  }, []);

  // Check KYC status (NoKYC mode - always verified)
  useEffect(() => {
    const checkInitialKYC = async () => {
      if (!address) return;
      
      try {
        // NoKYC deployment - skip verification check
        setKycVerified(true);
        console.log('✅ NoKYC mode - auto-verified');
      } catch (err) {
        console.error('KYC check error:', err);
        setKycVerified(true); // Default to verified on error
      }
    };
    
    checkInitialKYC();
  }, [address]);

  // Generate contextual prompt based on asset type
  const getPromptForAssetType = (assetType) => {
    const prompts = {
      'Real Estate': 'modern luxury property, professional real estate photography, architectural masterpiece, golden hour, 8k quality',
      'Vehicles': 'luxury vehicle, professional automotive photography, studio lighting, pristine condition, high quality',
      'Art': 'valuable fine art piece, museum quality artwork, professional photography, gallery lighting',
      'Collectibles': 'rare valuable collectible, professional photography, studio lighting, pristine condition',
      'Other': 'valuable asset, professional photography, high quality, studio lighting'
    };
    return prompts[assetType] || prompts['Other'];
  };

  // Handle asset type selection
  const handleAssetTypeSelect = (type) => {
    handleInputChange('assetType', type);
    const newPrompt = getPromptForAssetType(type);
    setAiPrompt(newPrompt);
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
        if (!formData.pricePerShare || parseFloat(formData.pricePerShare) <= 0) {
          newErrors.pricePerShare = 'Price must be greater than 0';
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

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;

    try {
      setLoading(true);
      
      console.log('🚀 Creating asset with weighted shares...');
      console.log('📊 Share type:', formData.shareType);
      console.log('📈 Min purchase:', formData.minPurchaseAmount);
      console.log('📉 Max purchase:', formData.maxPurchaseAmount);
      
      const submitData = {
        ...formData,
        assetImageUrl: selectedImages[0]?.url || '',
        additionalImages: selectedImages.slice(1).map(img => img.url)
      };
      
      const { tx, requestId, assetId, isAutoApproved } = await createAsset(submitData);
      
      showNotification(
        isAutoApproved 
          ? `✅ Asset created and approved! Asset ID: ${assetId}`
          : `Asset created! Request ID: ${requestId}. Awaiting approval.`,
        'success'
      );
      
      // Reset form
      setFormData({
        assetType: '',
        assetName: '',
        assetDescription: '',
        totalShares: 1000,
        pricePerShare: '',
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
              Generating Images...
            </>
          ) : (
            <>
              <Wand2 className="w-5 h-5" />
              Generate Images
            </>
          )}
        </button>

        {/* Generated Images Grid */}
        {generatedImages.length > 0 && (
          <div className="mt-6">
            <p className="text-sm text-neutral-400 mb-3">
              Click images to select (max 5)
            </p>
            <div className="grid grid-cols-4 gap-3">
              {generatedImages.map((image) => {
                const isSelected = selectedImages.find(img => img.id === image.id);
                return (
                  <div
                    key={image.id}
                    onClick={() => toggleImageSelection(image)}
                    className={`
                      relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all
                      ${isSelected 
                        ? 'border-purple-500 ring-2 ring-purple-500/50' 
                        : 'border-neutral-800 hover:border-neutral-600'
                      }
                    `}
                  >
                    <img 
                      src={image.url} 
                      alt="Generated"
                      className="w-full aspect-square object-cover"
                    />
                    {isSelected && (
                      <div className="absolute inset-0 bg-purple-500/30 flex items-center justify-center">
                        <div className="bg-purple-600 rounded-full p-1">
                          <CheckCircle className="w-6 h-6 text-white" />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {errors.images && (
          <p className="text-red-400 text-xs mt-2">{errors.images}</p>
        )}
      </div>
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
      {/* ============ END SHARE TYPE SELECTOR ============ */}

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
            <label className="block text-sm text-neutral-400 mb-2">Price per Share (OPN) *</label>
            <input
              type="number"
              value={formData.pricePerShare}
              onChange={(e) => handleInputChange('pricePerShare', e.target.value)}
              step="0.000001"
              min="0.000001"
              placeholder="0.1"
              className={`w-full bg-black border px-4 py-3 text-white ${
                errors.pricePerShare ? 'border-red-500' : 'border-neutral-800'
              }`}
            />
            {errors.pricePerShare && (
              <p className="text-red-400 text-xs mt-1">{errors.pricePerShare}</p>
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

        {formData.pricePerShare && formData.totalShares && (
          <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded">
            <div className="flex justify-between items-center">
              <p className="text-sm text-neutral-400">Total Asset Value:</p>
              <p className="text-2xl font-light text-white">
                {(parseFloat(formData.pricePerShare) * parseInt(formData.totalShares)).toFixed(2)} OPN
              </p>
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
            <span className="text-neutral-400">Price per Share</span>
            <span className="text-white">{formData.pricePerShare} OPN</span>
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
    </div>
  );
};

export default CreateView;
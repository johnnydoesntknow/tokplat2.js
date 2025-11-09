// src/components/modals/UploadProgressModal.jsx
import React from 'react';
import { Loader2, CheckCircle, AlertCircle, Upload } from 'lucide-react';

const UploadProgressModal = ({ 
  isOpen, 
  progress, 
  currentFile, 
  totalFiles, 
  status = 'uploading',
  error = null 
}) => {
  if (!isOpen) return null;

  const getStatusIcon = () => {
    switch (status) {
      case 'uploading':
        return <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />;
      case 'success':
        return <CheckCircle className="w-12 h-12 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-12 h-12 text-red-500" />;
      default:
        return <Upload className="w-12 h-12 text-blue-500" />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'uploading':
        return `Uploading to IPFS... (${currentFile} of ${totalFiles})`;
      case 'success':
        return 'Upload Complete!';
      case 'error':
        return 'Upload Failed';
      default:
        return 'Preparing upload...';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-neutral-900 border border-neutral-800 p-8 max-w-md w-full mx-4">
        {/* Status Icon */}
        <div className="flex justify-center mb-6">
          {getStatusIcon()}
        </div>

        {/* Status Text */}
        <h3 className="text-xl font-normal text-white text-center mb-4">
          {getStatusText()}
        </h3>

        {/* Progress Bar */}
        {status === 'uploading' && (
          <div className="mb-4">
            <div className="w-full bg-neutral-800 h-2 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-blue-600 to-purple-600 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-sm text-neutral-400 text-center mt-2">
              {progress}% Complete
            </p>
          </div>
        )}

        {/* Success Message */}
        {status === 'success' && (
          <p className="text-sm text-neutral-400 text-center mb-4">
            All images have been uploaded to IPFS successfully!
          </p>
        )}

        {/* Error Message */}
        {status === 'error' && error && (
          <div className="bg-red-500/10 border border-red-500/30 p-4 mb-4">
            <p className="text-sm text-red-400">
              {error}
            </p>
          </div>
        )}

        {/* File Counter */}
        {totalFiles > 1 && status === 'uploading' && (
          <p className="text-xs text-neutral-500 text-center">
            Processing image {currentFile} of {totalFiles}
          </p>
        )}

        {/* Info Text */}
        {status === 'uploading' && (
          <p className="text-xs text-neutral-500 text-center mt-4">
            Please don't close this window...
          </p>
        )}
      </div>
    </div>
  );
};

export default UploadProgressModal;
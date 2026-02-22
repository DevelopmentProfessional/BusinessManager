import React from 'react';

/**
 * SquareImage - A responsive square image component with center cropping
 * 
 * @param {string} src - Image source URL
 * @param {string} alt - Alt text for the image
 * @param {string} fallbackContent - Content to show when image is not available (optional)
 * @param {string} className - Additional CSS classes for the container (optional)
 * @param {object} style - Additional inline styles for the container (optional)
 * @param {function} onError - Callback when image fails to load (optional)
 * @param {string} size - Predefined sizes: 'sm' (80px), 'md' (120px), 'lg' (200px), 'xl' (300px) or 'full' for responsive
 */
export default function SquareImage({ 
  src, 
  alt = '', 
  fallbackContent = null,
  className = '',
  style = {},
  onError,
  size = 'full'
}) {
  const sizeClasses = {
    sm: 'w-20 h-20',      // 80px
    md: 'w-30 h-30',      // 120px  
    lg: 'w-50 h-50',      // 200px
    xl: 'w-75 h-75',      // 300px
    full: 'w-full'        // Responsive
  };

  const containerClass = size === 'full' 
    ? 'square-image-container' 
    : `${sizeClasses[size] || sizeClasses.full} relative overflow-hidden rounded-lg`;

  const handleImageError = (e) => {
    e.target.style.display = 'none';
    // Show fallback if it exists
    const fallback = e.target.nextElementSibling;
    if (fallback) {
      fallback.style.display = 'flex';
    }
    // Call custom error handler if provided
    onError?.(e);
  };

  return (
    <div 
      className={`${containerClass} ${className}`}
      style={style}
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          className={size === 'full' ? 'square-image' : 'w-full h-full object-cover object-center'}
          onError={handleImageError}
        />
      ) : null}
      
      {/* Fallback content - always present but conditionally visible */}
      <div 
        className={`${
          size === 'full' ? 'square-image-placeholder' : 'absolute inset-0 flex items-center justify-center'
        } ${src ? 'hidden' : 'flex'}`}
        style={{ display: src ? 'none' : 'flex' }}
      >
        {fallbackContent || (
          <div className="text-gray-400 text-xs text-center">
            No Image
          </div>
        )}
      </div>
    </div>
  );
}
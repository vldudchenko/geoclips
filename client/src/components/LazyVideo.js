import React, { useRef, useEffect, useState } from 'react';
import { useLazyLoad } from '../hooks/useIntersectionObserver';

const LazyVideo = ({ 
  src, 
  poster, 
  className, 
  style, 
  muted = true, 
  playsInline = true, 
  loop = false,
  preload = 'metadata',
  onLoadedMetadata,
  videoRef: externalRef,
  ...props 
}) => {
  const { ref, shouldLoad } = useLazyLoad({ rootMargin: '100px' });
  const internalRef = useRef(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const videoRef = externalRef || internalRef;

  useEffect(() => {
    if (shouldLoad && !isLoaded) {
      setIsLoaded(true);
    }
  }, [shouldLoad, isLoaded]);

  return (
    <div ref={ref} style={{ position: 'relative', ...style }}>
      {isLoaded ? (
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          className={className}
          muted={muted}
          playsInline={playsInline}
          loop={loop}
          preload={preload}
          onLoadedMetadata={onLoadedMetadata}
          {...props}
        />
      ) : (
        <div 
          className={`video-placeholder ${className}`}
          style={{
            width: '100%',
            height: '100%',
            background: poster ? `url(${poster}) center/cover` : '#f0f0f0',
            ...style
          }}
        />
      )}
    </div>
  );
};

export default React.memo(LazyVideo);

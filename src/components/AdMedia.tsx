import React from 'react';
import type { Advertisement } from '../lib/supabase';

interface AdMediaProps {
  ad: Advertisement;
  className?: string;
}

export const AdMedia: React.FC<AdMediaProps> = ({ ad, className = 'h-full w-full object-cover' }) => {
  if (ad.media_type === 'video') {
    return (
      <video
        src={ad.media_url}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        className={className}
      />
    );
  }

  return (
    <img
      src={ad.media_url || ad.image_url || '/src/assets/images/hatly_banner_fast_1794860406366.jpg'}
      alt={ad.title}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={(e) => {
        const img = e.currentTarget;
        if (!img.dataset.fallbackApplied) {
          img.dataset.fallbackApplied = 'true';
          img.src = '/src/assets/images/hatly_banner_fast_1794860406366.jpg';
        }
      }}
      className={className}
    />
  );
};

import React from 'react';
import './Skeleton.css';

const Skeleton = ({ width = '100%', height = '20px', borderRadius = '4px', className = '' }) => {
  return (
    <div
      className={`skeleton ${className}`}
      style={{
        width,
        height,
        borderRadius,
      }}
    />
  );
};

export const SkeletonCard = () => (
  <div className="skeleton-card">
    <Skeleton height="200px" borderRadius="12px" />
    <div className="skeleton-card-content">
      <Skeleton width="80%" height="16px" />
      <Skeleton width="60%" height="14px" />
      <div className="skeleton-card-stats">
        <Skeleton width="40px" height="14px" />
        <Skeleton width="40px" height="14px" />
      </div>
    </div>
  </div>
);

export const SkeletonProfile = () => (
  <div className="skeleton-profile">
    <Skeleton width="120px" height="120px" borderRadius="50%" />
    <div className="skeleton-profile-info">
      <Skeleton width="200px" height="24px" />
      <div className="skeleton-profile-stats">
        <Skeleton width="80px" height="40px" />
        <Skeleton width="80px" height="40px" />
        <Skeleton width="80px" height="40px" />
      </div>
    </div>
  </div>
);

export default Skeleton;

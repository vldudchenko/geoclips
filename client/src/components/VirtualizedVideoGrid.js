import React, { useCallback, useRef } from 'react';
import { FixedSizeGrid as Grid } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';

const VirtualizedVideoGrid = ({ 
  videos, 
  onVideoClick, 
  onDeleteClick, 
  isCurrentUserProfile, 
  deletingVideo,
  videoRefs,
  onPreviewEnter,
  onPreviewLeave 
}) => {
  const getColumnCount = (width) => {
    if (width >= 1200) return 4;
    if (width >= 900) return 3;
    if (width >= 600) return 2;
    return 1;
  };

  const Cell = useCallback(({ columnIndex, rowIndex, style, data }) => {
    const { videos, columnCount } = data;
    const index = rowIndex * columnCount + columnIndex;
    
    if (index >= videos.length) return null;
    
    const video = videos[index];
    
    return (
      <div style={style}>
        <div 
          className="video-card" 
          onClick={() => onVideoClick(video)}
          onMouseEnter={() => onPreviewEnter(video.id)}
          onMouseLeave={() => onPreviewLeave(video.id)}
          style={{ margin: '8px' }}
        >
          <div className="video-thumbnail">
            <video
              ref={(el) => { if (el) videoRefs.current[video.id] = el; }}
              src={video.video_url}
              muted
              playsInline
              loop
              preload="metadata"
              className="video-thumb-video"
              style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '12px' }}
            />
          </div>
          <div className="video-info">
            <h4 className="video-title">{video.description || 'Без описания'}</h4>
            
            {video.tags && video.tags.length > 0 && (
              <div className="video-tags">
                {video.tags.map((tag) => (
                  <span key={tag.id} className="video-tag">
                    #{tag.name}
                  </span>
                ))}
              </div>
            )}
            
            <div className="video-stats">
              <span className="video-likes">❤️{video.likes_count || 0}</span>
              <span className="video-views">👁️{video.views_count || 0}</span>
            </div>
          </div>
          
          {isCurrentUserProfile && (
            <button 
              className="video-delete-button"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteClick(video);
              }}
              disabled={deletingVideo === video.id}
              title="Удалить видео"
            >
              {deletingVideo === video.id ? '⏳' : '🗑️'}
            </button>
          )}
        </div>
      </div>
    );
  }, [onVideoClick, onDeleteClick, isCurrentUserProfile, deletingVideo, videoRefs, onPreviewEnter, onPreviewLeave]);

  if (!videos || videos.length === 0) return null;

  return (
    <AutoSizer>
      {({ height, width }) => {
        const columnCount = getColumnCount(width);
        const rowCount = Math.ceil(videos.length / columnCount);
        const columnWidth = width / columnCount;
        const rowHeight = columnWidth * 1.4;

        return (
          <Grid
            columnCount={columnCount}
            columnWidth={columnWidth}
            height={height}
            rowCount={rowCount}
            rowHeight={rowHeight}
            width={width}
            itemData={{ videos, columnCount }}
            overscanRowCount={2}
          >
            {Cell}
          </Grid>
        );
      }}
    </AutoSizer>
  );
};

export default React.memo(VirtualizedVideoGrid);

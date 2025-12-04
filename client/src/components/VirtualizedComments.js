import React, { useCallback } from 'react';
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';

const CommentRow = React.memo(({ index, style, data }) => {
  const { comments, onNavigateToProfile } = data;
  const comment = comments[index];

  const handleProfileClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (comment.users?.display_name) {
      onNavigateToProfile(`/profile/${comment.users.display_name}`);
    }
  };

  return (
    <div style={style} className="comment-item">
      <div className="comment-header">
        <div className="comment-user" onClick={handleProfileClick}>
          {comment.users?.avatar_url ? (
            <img
              src={comment.users.avatar_url}
              alt={comment.users.display_name || 'User'}
              className="comment-avatar"
            />
          ) : (
            <div className="comment-avatar-placeholder">👤</div>
          )}
          <span className="comment-username">
            {comment.users?.display_name || 'Пользователь'}
          </span>
        </div>
        <span className="comment-date">
          {new Date(comment.created_at).toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>
      <p className="comment-content">{comment.content}</p>
    </div>
  );
});

const VirtualizedComments = ({ comments, onNavigateToProfile }) => {
  const itemData = useCallback(() => ({
    comments,
    onNavigateToProfile,
  }), [comments, onNavigateToProfile]);

  if (!comments || comments.length === 0) {
    return (
      <div className="no-comments">
        <p>Пока нет комментариев</p>
      </div>
    );
  }

  return (
    <AutoSizer>
      {({ height, width }) => (
        <List
          height={height}
          itemCount={comments.length}
          itemSize={100}
          width={width}
          itemData={itemData()}
          overscanCount={5}
        >
          {CommentRow}
        </List>
      )}
    </AutoSizer>
  );
};

export default React.memo(VirtualizedComments);

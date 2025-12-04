import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { VideoService } from '../services/videoService';
import VideoPlayer from './VideoPlayer';
import Comments from './Comments';
import './VideoPage.css';
import { API_BASE_URL } from '../utils/constants';

const VideoPage = ({ currentUser }) => {
  const { userDisplayName, videoId } = useParams();
  const navigate = useNavigate();
  const modalRef = useRef(null);
  const updateCommentsCountRef = useRef(null);
  
  const [video, setVideo] = useState(null);
  const [userVideos, setUserVideos] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [author, setAuthor] = useState({ display_name: null, avatar: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [commentsCount, setCommentsCount] = useState(0);
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [isPlayerVisible, setIsPlayerVisible] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        const resp = await fetch(`${API_BASE_URL}/api/profile/${userDisplayName}`, { credentials: 'include' });
        if (!resp.ok) {
          setError('Видео не найдено');
          return;
        }
        
        const profile = await resp.json();
        const videos = profile?.videos || [];
        setUserVideos(videos);
        setAuthor({ display_name: profile?.user?.display_name, avatar: profile?.user?.avatar });

        const byId = videos.find(v => v.id === videoId) || await VideoService.getVideoById(videoId);
        if (!byId) {
          setError('Видео не найдено');
          return;
        }
        
        setVideo(byId);
        setCurrentIndex(videos.findIndex(v => v.id === byId.id));
        setCommentsCount(byId.comments_count || 0);

        VideoService.recordView(byId.id).catch(() => {});
      } catch (error) {
        setError('Ошибка загрузки видео');
      } finally {
        setLoading(false);
      }
    };

    if (videoId && userDisplayName) loadData();
  }, [videoId, userDisplayName]);

  const handleClose = useCallback(() => {
    setIsPlayerVisible(false);
    setTimeout(() => navigate(window.history.length > 1 ? -1 : '/'), 0);
  }, [navigate]);

  const handleNavigateToProfile = useCallback((profilePath) => {
    setIsPlayerVisible(false);
    setShowCommentsModal(false);
    setTimeout(() => navigate(profilePath), 50);
  }, [navigate]);

  const handleNavigateToMap = useCallback((mapPath) => {
    setIsPlayerVisible(false);
    setShowCommentsModal(false);
    setTimeout(() => navigate(mapPath), 50);
  }, [navigate]);

  const goNext = useCallback(() => {
    if (!userVideos?.length || currentIndex === -1) return;
    const nextIdx = (currentIndex + 1) % userVideos.length;
    const nextVideo = userVideos[nextIdx];
    setCurrentIndex(nextIdx);
    setVideo(nextVideo);
    setCommentsCount(nextVideo.comments_count || 0);
    navigate(`/video/${userDisplayName}/${nextVideo.id}`, { replace: true });
  }, [userVideos, currentIndex, userDisplayName, navigate]);

  const goPrev = useCallback(() => {
    if (!userVideos?.length || currentIndex === -1) return;
    const prevIdx = (currentIndex - 1 + userVideos.length) % userVideos.length;
    const prevVideo = userVideos[prevIdx];
    setCurrentIndex(prevIdx);
    setVideo(prevVideo);
    setCommentsCount(prevVideo.comments_count || 0);
    navigate(`/video/${userDisplayName}/${prevVideo.id}`, { replace: true });
  }, [userVideos, currentIndex, userDisplayName, navigate]);

  const handleOpenComments = useCallback(() => setShowCommentsModal(true), []);
  const handleCloseComments = useCallback(() => setShowCommentsModal(false), []);

  const handleCommentsCountChange = useCallback((count) => {
    setCommentsCount(count);
    updateCommentsCountRef.current?.(count);
  }, []);

  const handleCommentsCountRefChange = useCallback((updateFunction) => {
    updateCommentsCountRef.current = updateFunction;
  }, []);

  const handleTouchEnd = useCallback((e) => {
    const touchStart = e.changedTouches[0].clientY;
    const touchEnd = e.touches[0]?.clientY || touchStart;
    if (touchStart - touchEnd < -100) handleCloseComments();
  }, [handleCloseComments]);

  if (loading) {
    return (
      <div className="video-page-loading">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="video-page-error">
        <div className="error-content">
          <h2>😔 Видео не найдено</h2>
          <p>{error || 'Запрашиваемое видео не существует'}</p>
          <button onClick={handleClose} className="back-button">
            ← Вернуться назад
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="video-page">
      {/* Видеоплеер */}
      {isPlayerVisible && (
        <div className={`video-page-content ${showCommentsModal ? 'with-comments' : ''}`}>
          <VideoPlayer 
            video={video} 
            currentUser={currentUser}
            onClose={handleClose}
            onNavigateToProfile={handleNavigateToProfile}
            onNavigateToMap={handleNavigateToMap}
            onPrev={userVideos.length > 1 ? goPrev : undefined}
            onNext={userVideos.length > 1 ? goNext : undefined}
            hasPrev={userVideos.length > 1}
            hasNext={userVideos.length > 1}
            authorDisplayName={author.display_name}
            authorAvatar={author.avatar}
            onOpenComments={handleOpenComments}
            commentsCount={commentsCount}
            onCommentsCountChange={handleCommentsCountRefChange}
          />
        </div>
      )}

      {showCommentsModal && (
        <div className="comments-modal-overlay" onClick={handleCloseComments}>
          <div 
            ref={modalRef}
            className="comments-modal open"
            onClick={(e) => e.stopPropagation()}
            onTouchEnd={handleTouchEnd}
          >
            <div className="comments-modal-header">
              <div className="comments-modal-handle"></div>
              <h3>{commentsCount} {commentsCount === 1 ? 'комментарий' : commentsCount > 1 && commentsCount < 5 ? 'комментария' : 'комментариев'}</h3>
              <button className="comments-modal-close" onClick={handleCloseComments}>✕</button>
            </div>
            <div className="comments-modal-content">
              <Comments 
                videoId={video.id} 
                currentUser={currentUser}
                onCommentsCountChange={handleCommentsCountChange}
                isModal
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoPage;

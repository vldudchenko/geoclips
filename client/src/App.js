import React, { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';
import { VideoService } from './services/videoService';
import useAuth from './hooks/useAuth';
import ErrorBoundary from './components/common/ErrorBoundary';
import LoadingSpinner from './components/common/LoadingSpinner';
import './App.css';

const YandexMap = lazy(() => import('./components/YandexMap'));
const UploadForm = lazy(() => import('./components/UploadForm'));
const ProfilePage = lazy(() => import('./components/ProfilePage'));
const VideoPage = lazy(() => import('./components/VideoPage'));
const AdminPanel = lazy(() => import('./components/admin/AdminPanel'));

const HomePage = React.memo(({ user, onLogout, ymaps, mapData, setMapData, error, setError, showUploadForm, setShowUploadForm, onNavigateProfile, isAuthenticated }) => {

  const handleCoordinatesSelect = React.useCallback((coords) => {
    const newMapData = {
      coordinates: {
        latitude: coords[1],
        longitude: coords[0]
      },
      timestamp: Date.now()
    };
    setMapData(newMapData);
    localStorage.setItem('mapData', JSON.stringify(newMapData));
    
    if (isAuthenticated) {
      setShowUploadForm(true);
    }
  }, [isAuthenticated, setMapData, setShowUploadForm]);

  const handleSubmitUpload = React.useCallback(async (uploadData) => {
    try {
      const { success, message, ...videoData } = uploadData;
      await VideoService.uploadVideo(videoData);
      
      setMapData(null);
      localStorage.removeItem('mapData');
      setShowUploadForm(false);
      setError(null);
    } catch (error) {
      console.error('❌ App: Ошибка при загрузке видео:', error);
    }
  }, [setMapData, setShowUploadForm, setError]);

  const handleCloseUploadForm = React.useCallback(() => {
    setShowUploadForm(false);
    setMapData(null);
    localStorage.removeItem('mapData');
  }, [setShowUploadForm, setMapData]);

  return (
    <>
      <div className="map-container">
        <Suspense fallback={<LoadingSpinner fullScreen message="Загрузка карты..." />}>
          <YandexMap
            ymaps={ymaps}
            mapData={mapData}
            onCoordinatesSelect={handleCoordinatesSelect}
            currentUser={user}
            onNavigateProfile={onNavigateProfile}
            isAuthenticated={isAuthenticated}
          />
        </Suspense>
      </div>

      {error && (
        <div className="error">
          {error}
        </div>
      )}

      {showUploadForm && mapData && isAuthenticated && (
        <Suspense fallback={<LoadingSpinner message="Загрузка формы..." />}>
          <UploadForm
            coordinates={[mapData.coordinates.longitude, mapData.coordinates.latitude]}
            onSubmit={handleSubmitUpload}
            onCancel={handleCloseUploadForm}
            user={user}
          />
        </Suspense>
      )}
    </>
  );
});

const ProfilePageWithParams = React.memo(({ user, onLogout }) => {
  const { accessToken } = useParams();
  const actualAccessToken = accessToken === 'current' ? null : accessToken;

  return (
    <Suspense fallback={<LoadingSpinner fullScreen message="Загрузка профиля..." />}>
      <ProfilePage 
        user={user} 
        onLogout={onLogout} 
        accessToken={actualAccessToken}
      />
    </Suspense>
  );
});

// Внутренний компонент приложения с роутингом
const AppContent = () => {
  const navigate = useNavigate();
  
  const [mapData, setMapData] = useState(() => {
    const saved = localStorage.getItem('mapData');
    return saved ? JSON.parse(saved) : null;
  });
  const [error, setError] = useState(null);
  const [ymaps, setYmaps] = useState(null);
  const [showUploadForm, setShowUploadForm] = useState(false);
  
  // Авторизация
  const { user, isAuthenticated, isLoading, logout } = useAuth();

  // Инициализация Яндекс карт
  useEffect(() => {
    if (window.ymaps) {
      window.ymaps.ready(() => {
        setYmaps(window.ymaps);
      });
    }
  }, []);

  const navigateToProfile = React.useCallback(async () => {
    try {
      if (user?.dbUser?.display_name) {
        navigate(`/profile/${user.dbUser.display_name}`);
      } else if (user?.dbUser?.id) {
        navigate(`/profile/${user.dbUser.id}`);
      } else if (user?.accessToken) {
        navigate(`/profile/${user.accessToken}`);
      } else {
        navigate('/profile');
      }
    } catch (error) {
      navigate('/profile');
    }
  }, [user, navigate]);

  // Показываем загрузку пока проверяем авторизацию
  if (isLoading) {
    return <LoadingSpinner fullScreen message="Загрузка приложения..." />;
  }

  return (
    <div className="App">
      <Routes>
        {/* Главная страница */}
        <Route 
          path="/" 
          element={
            <HomePage 
              user={user}
              onLogout={logout}
              ymaps={ymaps}
              mapData={mapData}
              setMapData={setMapData}
              error={error}
              setError={setError}
              showUploadForm={showUploadForm}
              setShowUploadForm={setShowUploadForm}
              onNavigateProfile={navigateToProfile}
              isAuthenticated={isAuthenticated}
            />
          } 
        />
        
        
        {/* Профиль текущего пользователя - редирект на профиль с ID */}
        <Route 
          path="/profile" 
          element={<Navigate to="/profile/current" replace />} 
        />
        
        {/* Профиль текущего пользователя с токеном */}
        <Route 
          path="/profile/current" 
          element={<ProfilePageWithParams user={user} onLogout={logout} />} 
        />
        
        {/* Профиль пользователя по токену или ID */}
        <Route 
          path="/profile/:accessToken" 
          element={<ProfilePageWithParams user={user} onLogout={logout} />} 
        />
        
        {/* Видео с параметрами display_name пользователя и ID */}
        <Route 
          path="/video/:userDisplayName/:videoId" 
          element={
            <Suspense fallback={<LoadingSpinner fullScreen message="Загрузка видео..." />}>
              <VideoPage currentUser={user} />
            </Suspense>
          } 
        />
        
        {/* Административная панель с lazy loading */}
        <Route 
          path="/admin/*" 
          element={
            <Suspense fallback={<LoadingSpinner fullScreen message="Загрузка админ-панели..." />}>
              <AdminPanel />
            </Suspense>
          } 
        />
        
        {/* Редирект на главную для неизвестных маршрутов */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
};

// Главный компонент приложения с ErrorBoundary
function App() {
  return (
    <ErrorBoundary>
      <Router>
        <AppContent />
      </Router>
    </ErrorBoundary>
  );
}

export default App;
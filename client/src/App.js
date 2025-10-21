import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';
import YandexMap from './components/YandexMap';
import UploadForm from './components/UploadForm';
import ProfilePage from './components/ProfilePage';
import VideoPage from './components/VideoPage';
import { VideoService } from './services/videoService';
import useAuth from './hooks/useAuth';
import './App.css';

// Компонент для главной страницы
const HomePage = ({ user, onLogout, ymaps, mapData, setMapData, error, setError, showUploadForm, setShowUploadForm, onNavigateProfile, isAuthenticated }) => {
  const navigate = useNavigate();

  const handleCoordinatesSelect = (coords) => {
    const newMapData = {
      coordinates: {
        latitude: coords[1],
        longitude: coords[0]
      },
      timestamp: Date.now()
    };
    setMapData(newMapData);
    localStorage.setItem('mapData', JSON.stringify(newMapData));
    
    // Показываем форму загрузки только авторизованным пользователям
    if (isAuthenticated) {
      setShowUploadForm(true);
    }
  };

  const handleSubmitUpload = async (uploadData) => {
    try {
      console.log('App: Отправка данных загрузки:', uploadData);
      
      // Извлекаем только данные видео, исключая служебные поля
      const { success, message, ...videoData } = uploadData;
      await VideoService.uploadVideo(videoData);
      
      // Очищаем данные карты после успешной загрузки
      setMapData(null);
      localStorage.removeItem('mapData');
      setShowUploadForm(false);
      setError(null);
      
      // Видео успешно загружено
    } catch (error) {
      console.error('❌ App: Ошибка при загрузке видео:', error);
      setError('Ошибка при загрузке видео: ' + error.message);
    }
  };

  const handleCloseUploadForm = () => {
    setShowUploadForm(false);
    setMapData(null);
    localStorage.removeItem('mapData');
  };

  return (
    <>
      <div className="map-container">
        <YandexMap
          ymaps={ymaps}
          mapData={mapData}
          onCoordinatesSelect={handleCoordinatesSelect}
          currentUser={user}
          onNavigateProfile={onNavigateProfile}
          isAuthenticated={isAuthenticated}
        />
        
      </div>

      {error && (
        <div className="error">
          {error}
        </div>
      )}

      {showUploadForm && mapData && isAuthenticated && (
        <UploadForm
          coordinates={[mapData.coordinates.longitude, mapData.coordinates.latitude]}
          onSubmit={handleSubmitUpload}
          onCancel={handleCloseUploadForm}
          user={user}
        />
      )}
    </>
  );
};

// Компонент для профиля с параметрами
const ProfilePageWithParams = ({ user, onLogout }) => {
  const { accessToken } = useParams();
  
  // Если accessToken === 'current', не передаем его в ProfilePage
  // ProfilePage сам определит, что нужно загрузить данные текущего пользователя
  const actualAccessToken = accessToken === 'current' ? null : accessToken;

  return (
    <ProfilePage 
      user={user} 
      onLogout={onLogout} 
      accessToken={actualAccessToken}
    />
  );
};

// Внутренний компонент приложения с роутингом
const AppContent = () => {
  const navigate = useNavigate();
  
  // Восстанавливаем сохраненные данные карты из localStorage
  const getInitialMapData = () => {
    const saved = localStorage.getItem('mapData');
    return saved ? JSON.parse(saved) : null;
  };

  const [mapData, setMapData] = useState(getInitialMapData);
  const [error, setError] = useState(null);
  const [ymaps, setYmaps] = useState(null);
  const [showUploadForm, setShowUploadForm] = useState(false);
  
  // Авторизация
  const { user, isAuthenticated, isLoading, logout, getCurrentUserId } = useAuth();

  // Инициализация Яндекс карт
  useEffect(() => {
    if (window.ymaps) {
      window.ymaps.ready(() => {
        setYmaps(window.ymaps);
      });
    }
  }, []);

  // Функция для навигации на профиль текущего пользователя
  const navigateToProfile = async () => {
    try {
      // Приоритет: используем display_name пользователя из базы данных
      if (user?.dbUser?.display_name) {
        navigate(`/profile/${user.dbUser.display_name}`);
      } else if (user?.dbUser?.id) {
        // Fallback: используем ID пользователя
        navigate(`/profile/${user.dbUser.id}`);
      } else if (user?.accessToken) {
        // Fallback: используем токен доступа
        navigate(`/profile/${user.accessToken}`);
      } else {
        console.error('❌ Данные пользователя не найдены, используем fallback');
        // Fallback на старый путь
        navigate('/profile');
      }
    } catch (error) {
      console.error('❌ Ошибка навигации на профиль:', error);
      // Fallback на старый путь
      navigate('/profile');
    }
  };

  // Показываем загрузку пока проверяем авторизацию
  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
      </div>
    );
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
          element={<VideoPage currentUser={user} />} 
        />
        
        {/* Редирект на главную для неизвестных маршрутов */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
};

// Главный компонент приложения
function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
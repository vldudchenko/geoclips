import React from 'react';
import './LoadingSpinner.css';

/**
 * Компонент индикатора загрузки
 * 
 * @param {Object} props
 * @param {string} [props.size='medium'] - Размер спиннера (small, medium, large)
 * @param {string} [props.message] - Сообщение под спиннером
 * @param {boolean} [props.fullScreen=false] - Показать на весь экран
 * @param {string} [props.className] - Дополнительные CSS классы
 */
const LoadingSpinner = ({ 
  size = 'medium', 
  message, 
  fullScreen = false,
  className = ''
}) => {
  const spinnerClass = `loading-spinner loading-spinner--${size} ${className}`;
  const containerClass = fullScreen 
    ? 'loading-spinner-container loading-spinner-container--fullscreen' 
    : 'loading-spinner-container';

  return (
    <div className={containerClass} role="status" aria-live="polite">
      <div className={spinnerClass}>
        <div className="loading-spinner__circle"></div>
      </div>
      {message && (
        <p className="loading-spinner__message">{message}</p>
      )}
      <span className="sr-only">Загрузка...</span>
    </div>
  );
};

export default React.memo(LoadingSpinner);

import React, { useState, useEffect } from 'react';
import { useDebounce } from '../../hooks/useDebounce';
import './SearchBar.css';

/**
 * Компонент строки поиска с оптимизированным дебаунсом
 */
const SearchBar = ({ 
  value = '', 
  onChange, 
  placeholder = 'Поиск...', 
  className = '',
  debounceMs = 300,
  showClearButton = true 
}) => {
  const [inputValue, setInputValue] = useState(value);
  
  // Используем оптимизированный хук useDebounce
  const debouncedValue = useDebounce(inputValue, debounceMs);

  // Синхронизация с внешним значением
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Вызываем onChange когда debounced значение изменилось
  useEffect(() => {
    if (debouncedValue !== value) {
      onChange?.(debouncedValue);
    }
  }, [debouncedValue, value, onChange]);

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
  };

  const handleClear = () => {
    setInputValue('');
    onChange?.('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onChange?.(inputValue);
  };

  return (
    <form className={`search-bar ${className}`} onSubmit={handleSubmit}>
      <div className="search-bar-input-container">
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          placeholder={placeholder}
          className="search-bar-input"
        />
        
        {showClearButton && inputValue && (
          <button
            type="button"
            className="search-bar-clear"
            onClick={handleClear}
            title="Очистить поиск"
          >
            ×
          </button>
        )}
        
        <button
          type="submit"
          className="search-bar-submit"
          title="Найти"
        >
          🔍
        </button>
      </div>
    </form>
  );
};

export default SearchBar;
import React from 'react';
import './Pagination.css';

/**
 * Компонент пагинации
 */
const Pagination = ({ 
  currentPage, 
  totalPages, 
  onPageChange, 
  className = '',
  showInfo = true 
}) => {
  if (totalPages <= 1) return null;

  const getVisiblePages = () => {
    const delta = 2;
    const range = [];
    const rangeWithDots = [];

    for (let i = Math.max(2, currentPage - delta); 
         i <= Math.min(totalPages - 1, currentPage + delta); 
         i++) {
      range.push(i);
    }

    if (currentPage - delta > 2) {
      rangeWithDots.push(1, '...');
    } else {
      rangeWithDots.push(1);
    }

    rangeWithDots.push(...range);

    if (currentPage + delta < totalPages - 1) {
      rangeWithDots.push('...', totalPages);
    } else {
      rangeWithDots.push(totalPages);
    }

    return rangeWithDots;
  };

  const visiblePages = getVisiblePages();

  return (
    <div className={`pagination ${className}`}>
      {showInfo && (
        <div className="pagination-info">
          Страница {currentPage} из {totalPages}
        </div>
      )}
      
      <div className="pagination-controls">
        <button
          className="pagination-btn pagination-prev"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          title="Предыдущая страница"
        >
          ← Назад
        </button>

        <div className="pagination-pages">
          {visiblePages.map((page, index) => (
            <button
              key={index}
              className={`pagination-page ${
                page === currentPage ? 'active' : ''
              } ${page === '...' ? 'dots' : ''}`}
              onClick={() => typeof page === 'number' && onPageChange(page)}
              disabled={page === '...' || page === currentPage}
            >
              {page}
            </button>
          ))}
        </div>

        <button
          className="pagination-btn pagination-next"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          title="Следующая страница"
        >
          Вперед →
        </button>
      </div>
    </div>
  );
};

export default Pagination;
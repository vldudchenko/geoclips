import React from 'react';
import './ErrorBoundary.css';

/**
 * Error Boundary для перехвата ошибок React
 * Предотвращает падение всего приложения при ошибке в компоненте
 * 
 * @example
 * <ErrorBoundary fallback={<ErrorFallback />}>
 *   <MyComponent />
 * </ErrorBoundary>
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Логируем ошибку
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Отправляем в систему мониторинга (например, Sentry)
    if (window.Sentry) {
      window.Sentry.captureException(error, {
        contexts: {
          react: {
            componentStack: errorInfo.componentStack
          }
        }
      });
    }

    this.setState({
      error,
      errorInfo
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render() {
    if (this.state.hasError) {
      // Используем кастомный fallback если передан
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Дефолтный UI ошибки
      return (
        <div className="error-boundary">
          <div className="error-boundary__content">
            <div className="error-boundary__icon">⚠️</div>
            <h1 className="error-boundary__title">Что-то пошло не так</h1>
            <p className="error-boundary__message">
              Произошла ошибка при отображении этой части приложения.
            </p>
            
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="error-boundary__details">
                <summary>Детали ошибки (только в режиме разработки)</summary>
                <pre className="error-boundary__stack">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}

            <div className="error-boundary__actions">
              <button 
                onClick={this.handleReset}
                className="error-boundary__button error-boundary__button--primary"
              >
                Попробовать снова
              </button>
              <button 
                onClick={() => window.location.href = '/'}
                className="error-boundary__button error-boundary__button--secondary"
              >
                Вернуться на главную
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

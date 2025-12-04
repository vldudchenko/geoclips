import { useEffect, useRef } from 'react';

/**
 * Хук для управления AbortController
 * Автоматически отменяет запросы при размонтировании компонента
 * 
 * @returns {AbortController} Контроллер для отмены запросов
 * 
 * @example
 * const controller = useAbortController();
 * 
 * useEffect(() => {
 *   fetch('/api/data', { signal: controller.signal })
 *     .then(res => res.json())
 *     .catch(err => {
 *       if (err.name === 'AbortError') {
 *         console.log('Request cancelled');
 *       }
 *     });
 * }, []);
 */
const useAbortController = () => {
  const controllerRef = useRef(null);

  useEffect(() => {
    // Создаем новый контроллер при монтировании
    controllerRef.current = new AbortController();

    // Отменяем все запросы при размонтировании
    return () => {
      if (controllerRef.current) {
        controllerRef.current.abort();
      }
    };
  }, []);

  return controllerRef.current;
};

export default useAbortController;

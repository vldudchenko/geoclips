import { useEffect, useRef, useCallback } from 'react';

export const useWebWorker = (workerPath) => {
  const workerRef = useRef(null);
  const callbacksRef = useRef(new Map());
  const messageIdRef = useRef(0);

  useEffect(() => {
    try {
      workerRef.current = new Worker(workerPath);

      workerRef.current.onmessage = (e) => {
        const { type, data, error, messageId } = e.data;
        const callback = callbacksRef.current.get(messageId);

        if (callback) {
          if (type === 'ERROR') {
            callback.reject(new Error(error));
          } else {
            callback.resolve(data);
          }
          callbacksRef.current.delete(messageId);
        }
      };

      workerRef.current.onerror = (error) => {
        console.error('Worker error:', error);
        callbacksRef.current.forEach((callback) => {
          callback.reject(error);
        });
        callbacksRef.current.clear();
      };
    } catch (error) {
      console.error('Failed to create worker:', error);
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, [workerPath]);

  const postMessage = useCallback((type, data) => {
    return new Promise((resolve, reject) => {
      if (!workerRef.current) {
        reject(new Error('Worker not initialized'));
        return;
      }

      const messageId = messageIdRef.current++;
      callbacksRef.current.set(messageId, { resolve, reject });

      workerRef.current.postMessage({ type, data, messageId });

      setTimeout(() => {
        if (callbacksRef.current.has(messageId)) {
          callbacksRef.current.delete(messageId);
          reject(new Error('Worker timeout'));
        }
      }, 30000);
    });
  }, []);

  return { postMessage };
};

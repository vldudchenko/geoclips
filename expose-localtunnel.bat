@echo off
setlocal ENABLEDELAYEDEXPANSION

REM Автоматическое открытие сервера и клиента GeoClips через LocalTunnel
REM Требования: установлен Node.js, LocalTunnel используется через npx.

set SERVER_PORT=5000
set CLIENT_PORT=3000
set WEB_SUB=geoclips-myapp-web
set CLIENT_SUB=geoclips-myapp-client

REM Публичные URL (будут использованы после запуска туннелей)
set PUBLIC_SERVER_URL=https://%WEB_SUB%.loca.lt
set PUBLIC_CLIENT_URL=https://%CLIENT_SUB%.loca.lt
set REDIRECT_URI=%PUBLIC_SERVER_URL%/auth/yandex/callback

echo =====================================================
echo Настройка переменных окружения:
echo SERVER_PORT=%SERVER_PORT%
echo CLIENT_PORT=%CLIENT_PORT%
echo PUBLIC_SERVER_URL=%PUBLIC_SERVER_URL%
echo PUBLIC_CLIENT_URL=%PUBLIC_CLIENT_URL%
echo REDIRECT_URI=%REDIRECT_URI%
echo =====================================================

echo.
echo [1/5] Сборка клиента...
pushd client
set CLIENT_URL=%PUBLIC_CLIENT_URL%
call npm run build
if errorlevel 1 (
  echo [ERROR] Сборка клиента не удалась. Прерывание.
  popd
  pause
  goto :eof
)
popd
echo [OK] Сборка клиента завершена.

echo.
echo [2/5] Запуск сервера на порту %SERVER_PORT%...
start "GeoClips-Server" cmd /c "cd server && set PORT=%SERVER_PORT% && set BASE_URL=%PUBLIC_SERVER_URL% && set CLIENT_URL=%PUBLIC_CLIENT_URL% && set REDIRECT_URI=%REDIRECT_URI% && set NODE_ENV=production && npm start"

REM Даем серверу время запуститься
timeout /t 3 /nobreak >nul

echo.
echo [3/5] Запуск клиента на порту %CLIENT_PORT%...
start "GeoClips-Client" cmd /c "cd client && set PORT=%CLIENT_PORT% && set CLIENT_URL=%PUBLIC_CLIENT_URL% && npm start"

REM Даем клиенту время запуститься
timeout /t 3 /nobreak >nul

echo.
echo [4/5] Запуск LocalTunnel для сервера (%PUBLIC_SERVER_URL%)...
start "LocalTunnel-Server" cmd /c "npx localtunnel --port %SERVER_PORT% --subdomain %WEB_SUB%"

REM Небольшая задержка перед запуском второго туннеля
timeout /t 2 /nobreak >nul

echo.
echo [5/5] Запуск LocalTunnel для клиента (%PUBLIC_CLIENT_URL%)...
start "LocalTunnel-Client" cmd /c "npx localtunnel --port %CLIENT_PORT% --subdomain %CLIENT_SUB%"

echo.
echo =====================================================
echo [SUCCESS] Все компоненты запущены!
echo =====================================================
echo Публичный URL сервера:  %PUBLIC_SERVER_URL%
echo Публичный URL клиента:  %PUBLIC_CLIENT_URL%
echo.
echo Локальный сервер:       http://localhost:%SERVER_PORT%
echo Локальный клиент:       http://localhost:%CLIENT_PORT%
echo.
echo REDIRECT_URI для Yandex OAuth: %REDIRECT_URI%
echo =====================================================
echo.
echo ВАЖНО: При первом переходе по туннелю LocalTunnel
echo        нажмите "Click to Continue" для продолжения.
echo.
echo Для остановки закройте все открытые окна команд.
echo =====================================================

pause

endlocal
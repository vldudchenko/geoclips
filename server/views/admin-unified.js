/**
 * Объединенная админ-панель GeoClips
 * Содержит всю функциональность в одном файле для упрощения структуры
 */

// ==================== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ====================
let allTags = [];
let filteredTags = [];
let selectedVideoIds = [];
let currentUsersPage = 0;
let currentVideosPage = 0;
const ITEMS_PER_PAGE = 20;

// ==================== ОСНОВНЫЕ ФУНКЦИИ ====================

/**
 * Переключение вкладок
 */
function switchTab(tabName) {
    // Скрываем все вкладки
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Убираем активный класс у всех кнопок
    document.querySelectorAll('.nav-tab').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Показываем выбранную вкладку
    const selectedTab = document.getElementById(`tab-${tabName}`);
    if (selectedTab) {
        selectedTab.classList.add('active');
    }
    
    // Добавляем активный класс к нажатой кнопке
    event.target.classList.add('active');
    
    // Загружаем данные для вкладки если нужно
    switch(tabName) {
        case 'dashboard':
            loadStats();
            loadDashboardChart();
            break;
        case 'analytics':
            loadAnalytics();
            break;
        case 'users':
            loadUsers();
            break;
        case 'videos':
            loadVideos();
            break;
        case 'tags':
            loadTags();
            break;
        case 'system':
            loadSystemInfo();
            break;
        case 'logs':
            loadActivityLogs();
            break;
    }
}

/**
 * Выход из админки
 */
async function logout() {
    if (!confirm('Вы уверены, что хотите выйти из админки?')) return;
    
    try {
        const response = await fetch('/admin/logout', { method: 'POST' });
        
        if (response.ok) {
            window.location.href = '/admin';
        } else {
            showNotification('Ошибка при выходе', 'error');
        }
    } catch (error) {
        console.error('Ошибка при выходе:', error);
        showNotification('Ошибка при выходе', 'error');
    }
}

// ==================== СТАТИСТИКА И АНАЛИТИКА ====================

/**
 * Загрузка статистики
 */
async function loadStats() {
    try {
        const response = await fetch('/admin/stats');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        document.getElementById('users-count').textContent = data.usersCount || 0;
        document.getElementById('videos-count').textContent = data.videosCount || 0;
        document.getElementById('total-views').textContent = data.totalViews || 0;
        document.getElementById('total-likes').textContent = data.totalLikes || 0;
        document.getElementById('tags-count').textContent = data.tagsCount || 0;
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
        showNotification('Ошибка загрузки статистики', 'error');
    }
}

/**
 * Загрузка графика для дашборда
 */
async function loadDashboardChart() {
    try {
        const response = await fetch('/admin/analytics');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        
        // Отображаем простую статистику на дашборде
        const chartContainer = document.getElementById('dashboard-chart');
        chartContainer.innerHTML = `
            <div class="stats-summary">
                <p><strong>За последние 7 дней:</strong></p>
                <p>Новых пользователей: ${data.period.last7Days.users}</p>
                <p>Новых видео: ${data.period.last7Days.videos}</p>
            </div>
        `;
    } catch (error) {
        console.error('Ошибка загрузки графика:', error);
    }
}

/**
 * Загрузка расширенной аналитики
 */
async function loadAnalytics() {
    try {
        showNotification('Загрузка аналитики...', 'info');
        
        const response = await fetch('/admin/analytics');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        
        // Обновляем периоды
        document.getElementById('analytics-users-7d').textContent = data.period.last7Days.users;
        document.getElementById('analytics-videos-7d').textContent = data.period.last7Days.videos;
        document.getElementById('analytics-users-30d').textContent = data.period.last30Days.users;
        document.getElementById('analytics-videos-30d').textContent = data.period.last30Days.videos;
        
        // Отображаем топ пользователей
        const topUsersList = document.getElementById('top-users-list');
        topUsersList.innerHTML = data.topUsers.map(user => `
            <div class="top-item">
                <span class="user-name">${user.user_name}</span>
                <span class="count">${user.videos_count} видео</span>
            </div>
        `).join('');
        
        // Отображаем топ видео
        const topVideosList = document.getElementById('top-videos-list');
        topVideosList.innerHTML = data.topVideos.map(video => `
            <div class="top-item">
                <span class="video-title">${video.description || 'Без описания'}</span>
                <span class="count">${video.views_count} просмотров</span>
            </div>
        `).join('');
        
        showNotification('Аналитика загружена', 'success');
    } catch (error) {
        console.error('Ошибка загрузки аналитики:', error);
        showNotification('Ошибка загрузки аналитики', 'error');
    }
}

// ==================== ПОЛЬЗОВАТЕЛИ ====================

/**
 * Загрузка пользователей
 */
async function loadUsers() {
    try {
        showNotification('Загрузка пользователей...', 'info');
        
        const response = await fetch('/admin/users');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        displayUsers(data.users);
        
        showNotification('Пользователи загружены', 'success');
    } catch (error) {
        console.error('Ошибка загрузки пользователей:', error);
        showNotification('Ошибка загрузки пользователей', 'error');
    }
}

/**
 * Отображение пользователей
 */
function displayUsers(users) {
    const container = document.getElementById('users-container');
    
    if (!users || users.length === 0) {
        container.innerHTML = '<div class="no-data">Пользователи не найдены</div>';
        return;
    }
    
    container.innerHTML = users.map(user => `
        <div class="user-card">
            <div class="user-info">
                <div class="user-avatar">
                    ${user.avatar_url ? `<img src="${user.avatar_url}" alt="Avatar">` : '👤'}
                </div>
                <div class="user-details">
                    <h3>${user.display_name || 'Без имени'}</h3>
                    <p>ID: ${user.id}</p>
                    <p>Yandex ID: ${user.yandex_id}</p>
                    <p>Видео: ${user.videosCount || 0}</p>
                    <p>Регистрация: ${new Date(user.created_at).toLocaleDateString()}</p>
                </div>
            </div>
            <div class="user-actions">
                <button class="btn btn-danger" onclick="deleteUser('${user.id}', '${user.display_name}')">
                    🗑️ Удалить
                </button>
            </div>
        </div>
    `).join('');
}

/**
 * Поиск пользователей
 */
async function searchUsers() {
    const query = document.getElementById('users-search').value;
    const sortBy = document.getElementById('users-sort').value;
    const order = document.getElementById('users-order').value;
    
    try {
        showNotification('Поиск пользователей...', 'info');
        
        const params = new URLSearchParams({
            query: query || '',
            sortBy,
            order,
            limit: ITEMS_PER_PAGE,
            offset: currentUsersPage * ITEMS_PER_PAGE
        });
        
        const response = await fetch(`/admin/users/search?${params}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        displayUsers(data.data);
        
        showNotification('Поиск завершен', 'success');
    } catch (error) {
        console.error('Ошибка поиска пользователей:', error);
        showNotification('Ошибка поиска пользователей', 'error');
    }
}

/**
 * Удаление пользователя
 */
async function deleteUser(userId, userName) {
    if (!confirm(`Вы уверены, что хотите удалить пользователя "${userName}"?\n\nЭто действие нельзя отменить!`)) {
        return;
    }
    
    try {
        showNotification('Удаление пользователя...', 'info');
        
        const response = await fetch(`/admin/users/${userId}`, { method: 'DELETE' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const result = await response.json();
        showNotification(`Пользователь удален. Удалено видео: ${result.deletedVideos}`, 'success');
        
        // Перезагружаем список
        loadUsers();
    } catch (error) {
        console.error('Ошибка удаления пользователя:', error);
        showNotification('Ошибка удаления пользователя', 'error');
    }
}

// ==================== ВИДЕО ====================

/**
 * Загрузка видео
 */
async function loadVideos() {
    try {
        showNotification('Загрузка видео...', 'info');
        
        const response = await fetch('/admin/videos/admin');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        displayVideos(data.videos);
        
        showNotification('Видео загружены', 'success');
    } catch (error) {
        console.error('Ошибка загрузки видео:', error);
        showNotification('Ошибка загрузки видео', 'error');
    }
}

/**
 * Отображение видео
 */
function displayVideos(videos) {
    const container = document.getElementById('videos-container');
    
    if (!videos || videos.length === 0) {
        container.innerHTML = '<div class="no-data">Видео не найдены</div>';
        return;
    }
    
    container.innerHTML = videos.map(video => `
        <div class="video-card">
            <div class="video-checkbox">
                <input type="checkbox" value="${video.id}" onchange="toggleVideoSelection('${video.id}')">
            </div>
            <div class="video-info">
                <h3>${video.description || 'Без описания'}</h3>
                <p>Автор: ${video.users?.display_name || 'Неизвестно'}</p>
                <p>Просмотры: ${video.views_count || 0}</p>
                <p>Лайки: ${video.likes_count || 0}</p>
                <p>Дата: ${new Date(video.created_at).toLocaleDateString()}</p>
                ${video.latitude && video.longitude ? 
                    `<p>Координаты: ${video.latitude.toFixed(4)}, ${video.longitude.toFixed(4)}</p>` : 
                    '<p>Координаты: не указаны</p>'
                }
            </div>
            <div class="video-actions">
                <button class="btn btn-danger" onclick="deleteVideo('${video.id}')">
                    🗑️ Удалить
                </button>
            </div>
        </div>
    `).join('');
}

/**
 * Поиск видео
 */
async function searchVideos() {
    const query = document.getElementById('videos-search').value;
    const minViews = document.getElementById('videos-min-views').value;
    const minLikes = document.getElementById('videos-min-likes').value;
    const sortBy = document.getElementById('videos-sort').value;
    const order = document.getElementById('videos-order').value;
    
    try {
        showNotification('Поиск видео...', 'info');
        
        const params = new URLSearchParams({
            query: query || '',
            minViews: minViews || '',
            minLikes: minLikes || '',
            sortBy,
            order,
            limit: ITEMS_PER_PAGE,
            offset: currentVideosPage * ITEMS_PER_PAGE
        });
        
        const response = await fetch(`/admin/videos/admin/search?${params}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        displayVideos(data.data);
        
        showNotification('Поиск завершен', 'success');
    } catch (error) {
        console.error('Ошибка поиска видео:', error);
        showNotification('Ошибка поиска видео', 'error');
    }
}

/**
 * Удаление видео
 */
async function deleteVideo(videoId) {
    if (!confirm('Вы уверены, что хотите удалить это видео?\n\nЭто действие нельзя отменить!')) {
        return;
    }
    
    try {
        showNotification('Удаление видео...', 'info');
        
        const response = await fetch(`/admin/videos/admin/${videoId}`, { method: 'DELETE' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const result = await response.json();
        showNotification('Видео удалено', 'success');
        
        // Перезагружаем список
        loadVideos();
    } catch (error) {
        console.error('Ошибка удаления видео:', error);
        showNotification('Ошибка удаления видео', 'error');
    }
}

/**
 * Переключение выбора видео
 */
function toggleVideoSelection(videoId) {
    const index = selectedVideoIds.indexOf(videoId);
    if (index > -1) {
        selectedVideoIds.splice(index, 1);
    } else {
        selectedVideoIds.push(videoId);
    }
    
    // Обновляем кнопку массового удаления
    const bulkDeleteBtn = document.getElementById('bulk-delete-videos-btn');
    bulkDeleteBtn.disabled = selectedVideoIds.length === 0;
}

/**
 * Массовое удаление видео
 */
async function bulkDeleteVideos() {
    if (selectedVideoIds.length === 0) {
        showNotification('Выберите видео для удаления', 'warning');
        return;
    }
    
    if (!confirm(`Вы уверены, что хотите удалить ${selectedVideoIds.length} видео?\n\nЭто действие нельзя отменить!`)) {
        return;
    }
    
    try {
        showNotification('Массовое удаление видео...', 'info');
        
        const response = await fetch('/admin/videos/admin/bulk', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ videoIds: selectedVideoIds })
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const result = await response.json();
        showNotification(`Удалено видео: ${result.count}`, 'success');
        
        // Очищаем выбор и перезагружаем
        selectedVideoIds = [];
        loadVideos();
    } catch (error) {
        console.error('Ошибка массового удаления:', error);
        showNotification('Ошибка массового удаления', 'error');
    }
}

// ==================== ТЕГИ ====================

/**
 * Загрузка тегов
 */
async function loadTags() {
    try {
        showNotification('Загрузка тегов...', 'info');
        
        const response = await fetch('/admin/tags');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        allTags = data.tags;
        displayTags(allTags);
        
        showNotification('Теги загружены', 'success');
    } catch (error) {
        console.error('Ошибка загрузки тегов:', error);
        showNotification('Ошибка загрузки тегов', 'error');
    }
}

/**
 * Отображение тегов
 */
function displayTags(tags) {
    const container = document.getElementById('tags-container');
    
    if (!tags || tags.length === 0) {
        container.innerHTML = '<div class="no-data">Теги не найдены</div>';
        return;
    }
    
    container.innerHTML = tags.map(tag => `
        <div class="tag-card">
            <div class="tag-info">
                <h3>${tag.name}</h3>
                <p>Использований: ${tag.usage_count || 0}</p>
                <p>Создатель: ${tag.creator_name || 'Система'}</p>
                <p>Дата создания: ${new Date(tag.created_at).toLocaleDateString()}</p>
            </div>
            <div class="tag-actions">
                <button class="btn btn-danger" onclick="deleteTag('${tag.id}', '${tag.name}')">
                    🗑️ Удалить
                </button>
            </div>
        </div>
    `).join('');
}

/**
 * Создание тега
 */
async function createTag() {
    const nameInput = document.getElementById('new-tag-name');
    const name = nameInput.value.trim();
    
    if (!name) {
        showNotification('Введите название тега', 'warning');
        return;
    }
    
    if (name.length > 50) {
        showNotification('Название тега не должно превышать 50 символов', 'warning');
        return;
    }
    
    try {
        showNotification('Создание тега...', 'info');
        
        const response = await fetch('/admin/tags', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const result = await response.json();
        showNotification('Тег создан', 'success');
        
        // Очищаем поле и перезагружаем
        nameInput.value = '';
        loadTags();
    } catch (error) {
        console.error('Ошибка создания тега:', error);
        showNotification('Ошибка создания тега', 'error');
    }
}

/**
 * Удаление тега
 */
async function deleteTag(tagId, tagName) {
    if (!confirm(`Вы уверены, что хотите удалить тег "${tagName}"?\n\nЭто действие нельзя отменить!`)) {
        return;
    }
    
    try {
        showNotification('Удаление тега...', 'info');
        
        const response = await fetch(`/admin/tags/${tagId}`, { method: 'DELETE' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const result = await response.json();
        showNotification('Тег удален', 'success');
        
        // Перезагружаем список
        loadTags();
    } catch (error) {
        console.error('Ошибка удаления тега:', error);
        showNotification('Ошибка удаления тега', 'error');
    }
}

/**
 * Исправление счетчиков тегов
 */
async function fixTagCounters() {
    if (!confirm('Исправить счетчики использования тегов?\n\nЭто может занять некоторое время.')) {
        return;
    }
    
    try {
        showNotification('Исправление счетчиков...', 'info');
        
        const response = await fetch('/admin/tags/fix-counters', { method: 'POST' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const result = await response.json();
        showNotification(`Исправлено ${result.fixedCount} из ${result.totalTags} тегов`, 'success');
        
        // Перезагружаем список
        loadTags();
    } catch (error) {
        console.error('Ошибка исправления счетчиков:', error);
        showNotification('Ошибка исправления счетчиков', 'error');
    }
}

// ==================== СИСТЕМА ====================

/**
 * Загрузка системной информации
 */
async function loadSystemInfo() {
    try {
        showNotification('Загрузка системной информации...', 'info');
        
        const response = await fetch('/admin/system/info');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        displaySystemInfo(data);
        
        showNotification('Системная информация загружена', 'success');
    } catch (error) {
        console.error('Ошибка загрузки системной информации:', error);
        showNotification('Ошибка загрузки системной информации', 'error');
    }
}

/**
 * Отображение системной информации
 */
function displaySystemInfo(info) {
    const container = document.getElementById('system-info-container');
    
    container.innerHTML = `
        <div class="system-info">
            <div class="info-section">
                <h3>🖥️ Операционная система</h3>
                <p>Платформа: ${info.os.platform}</p>
                <p>Хост: ${info.os.hostname}</p>
                <p>Время работы: ${Math.floor(info.os.uptime / 3600)} часов</p>
                <p>Node.js: ${info.os.nodeVersion}</p>
            </div>
            
            <div class="info-section">
                <h3>💾 Память</h3>
                <p>Общая: ${Math.round(info.memory.total / 1024 / 1024)} MB</p>
                <p>Свободная: ${Math.round(info.memory.free / 1024 / 1024)} MB</p>
                <p>Используется: ${Math.round(info.memory.used / 1024 / 1024)} MB</p>
                <p>Загрузка: ${info.memory.usagePercent}%</p>
            </div>
            
            <div class="info-section">
                <h3>⚡ Процессор</h3>
                <p>Ядра: ${info.cpu.count}</p>
                <p>Модель: ${info.cpu.model}</p>
            </div>
            
            <div class="info-section">
                <h3>🔄 Процесс Node.js</h3>
                <p>Время работы: ${Math.floor(info.process.uptime / 3600)} часов</p>
                <p>RSS: ${Math.round(info.process.memory.rss / 1024 / 1024)} MB</p>
                <p>Heap Total: ${Math.round(info.process.memory.heapTotal / 1024 / 1024)} MB</p>
                <p>Heap Used: ${Math.round(info.process.memory.heapUsed / 1024 / 1024)} MB</p>
            </div>
        </div>
    `;
}

/**
 * Экспорт данных
 */
async function exportData(type, format) {
    try {
        showNotification('Экспорт данных...', 'info');
        
        const response = await fetch(`/admin/system/export/${type}?format=${format}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${type}_export_${Date.now()}.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        showNotification('Данные экспортированы', 'success');
    } catch (error) {
        console.error('Ошибка экспорта:', error);
        showNotification('Ошибка экспорта данных', 'error');
    }
}

/**
 * Очистка данных
 */
async function cleanupData(type) {
    const messages = {
        'unused_tags': 'удалить неиспользуемые теги',
        'old_videos': 'удалить старые видео без просмотров (старше 90 дней)'
    };
    
    if (!confirm(`Вы уверены, что хотите ${messages[type]}?\n\nЭто действие нельзя отменить!`)) {
        return;
    }
    
    try {
        showNotification('Очистка данных...', 'info');
        
        const response = await fetch('/admin/system/cleanup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type })
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const result = await response.json();
        showNotification(`Удалено записей: ${result.deletedCount}`, 'success');
        loadStats();
    } catch (error) {
        console.error('Ошибка очистки данных:', error);
        showNotification('Ошибка очистки данных', 'error');
    }
}

// ==================== ЛОГИ ====================

/**
 * Загрузка логов активности
 */
async function loadActivityLogs() {
    try {
        showNotification('Загрузка логов...', 'info');
        
        const response = await fetch('/admin/activity-logs');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        displayActivityLogs(data.logs);
        
        showNotification('Логи загружены', 'success');
    } catch (error) {
        console.error('Ошибка загрузки логов:', error);
        showNotification('Ошибка загрузки логов', 'error');
    }
}

/**
 * Отображение логов активности
 */
function displayActivityLogs(logs) {
    const container = document.getElementById('activity-logs-container');
    
    if (!logs || logs.length === 0) {
        container.innerHTML = '<div class="no-data">Логи не найдены</div>';
        return;
    }
    
    container.innerHTML = logs.map(log => `
        <div class="log-entry">
            <div class="log-time">${new Date(log.timestamp).toLocaleString()}</div>
            <div class="log-type">${log.type}</div>
            <div class="log-user">${log.user}</div>
            <div class="log-description">${log.description}</div>
        </div>
    `).join('');
}

// ==================== УТИЛИТЫ ====================

/**
 * Показать уведомление
 */
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

/**
 * Инициализация админки
 */
document.addEventListener('DOMContentLoaded', function() {
    // Загружаем начальную статистику
    loadStats();
    
    // Обновляем статистику каждые 30 секунд
    setInterval(loadStats, 30000);
    
    console.log('Админ-панель GeoClips инициализирована');
});

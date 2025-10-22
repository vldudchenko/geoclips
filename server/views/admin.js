// Глобальные переменные
let allTags = [];
let filteredTags = [];
let selectedVideoIds = [];
let currentUsersPage = 0;
let currentVideosPage = 0;
const ITEMS_PER_PAGE = 20;

// Переключение вкладок
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

// Загрузка статистики
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

// Загрузка графика для дашборда
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

// Загрузка расширенной аналитики
async function loadAnalytics() {
    try {
        showNotification('Загрузка аналитики...', 'info');
        
        const response = await fetch('/admin/analytics');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        
        // Обновляем данные периодов
        document.getElementById('analytics-users-7d').textContent = data.period.last7Days.users;
        document.getElementById('analytics-videos-7d').textContent = data.period.last7Days.videos;
        document.getElementById('analytics-users-30d').textContent = data.period.last30Days.users;
        document.getElementById('analytics-videos-30d').textContent = data.period.last30Days.videos;
        
        // Топ пользователей
        const topUsersList = document.getElementById('top-users-list');
        if (data.topUsers && data.topUsers.length > 0) {
            topUsersList.innerHTML = data.topUsers.map((user, index) => `
                <div class="top-item">
                    <span class="rank">#${index + 1}</span>
                    <span class="name">${user.user_name}</span>
                    <span class="count">${user.videos_count} видео</span>
                </div>
            `).join('');
        } else {
            topUsersList.innerHTML = '<p>Нет данных</p>';
        }
        
        // Топ видео
        const topVideosList = document.getElementById('top-videos-list');
        if (data.topVideos && data.topVideos.length > 0) {
            topVideosList.innerHTML = data.topVideos.map((video, index) => `
                <div class="top-item">
                    <span class="rank">#${index + 1}</span>
                    <span class="name">${video.description || 'Без описания'}</span>
                    <span class="count">👁 ${video.views_count} ❤ ${video.likes_count}</span>
                </div>
            `).join('');
        } else {
            topVideosList.innerHTML = '<p>Нет данных</p>';
        }
        
        showNotification('Аналитика загружена', 'success');
    } catch (error) {
        console.error('Ошибка загрузки аналитики:', error);
        showNotification('Ошибка загрузки аналитики', 'error');
    }
}

// Загрузка пользователей
async function loadUsers() {
    const container = document.getElementById('users-container');
    container.innerHTML = '<div class="loading">Загрузка пользователей...</div>';
    
    try {
        const response = await fetch('/admin/users');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        
        // Извлекаем массив пользователей из ответа
        const users = Array.isArray(data.users) ? data.users : 
                     Array.isArray(data) ? data : [];
        
        if (users.length === 0) {
            container.innerHTML = '<div class="no-data">Пользователи не найдены</div>';
            return;
        }
        
        displayUsers(users);
    } catch (error) {
        console.error('Ошибка загрузки пользователей:', error);
        container.innerHTML = `<div class="error">Ошибка загрузки пользователей: ${error.message}</div>`;
    }
}

// Отображение пользователей
function displayUsers(users) {
    const container = document.getElementById('users-container');
    
    const table = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Аватар</th>
                    <th>Имя</th>
                    <th>Логин</th>
                    <th>Видео</th>
                    <th>Дата регистрации</th>
                    <th>Действия</th>
                </tr>
            </thead>
            <tbody>
                ${users.map(user => `
                    <tr>
                        <td>${user.id.substring(0, 8)}...</td>
                        <td>
                            ${user.avatar_url ? 
                                `<img src="${user.avatar_url}" class="avatar" alt="Аватар">` : 
                                `<div class="avatar-placeholder">👤</div>`
                            }
                        </td>
                        <td>${user.first_name || ''} ${user.last_name || ''}</td>
                        <td>${user.display_name || 'Пользователь'}</td>
                        <td><span class="video-count">${user.videos_count || 0}</span></td>
                        <td>${new Date(user.created_at).toLocaleDateString('ru-RU')}</td>
                        <td>
                            <button class="btn btn-small" onclick="viewUserVideos('${user.id}')">
                                📹 Видео
                            </button>
                            <button class="btn btn-small btn-danger" onclick="deleteUser('${user.id}', '${(user.display_name || 'Неизвестно').replace(/'/g, "\\'")}')">
                                🗑️ Удалить
                            </button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    
    container.innerHTML = table;
}

// Поиск пользователей
async function searchUsers() {
    const query = document.getElementById('users-search').value;
    const sortBy = document.getElementById('users-sort').value;
    const order = document.getElementById('users-order').value;
    
    const container = document.getElementById('users-container');
    container.innerHTML = '<div class="loading">Поиск пользователей...</div>';
    
    try {
        const params = new URLSearchParams({
            query,
            sortBy,
            order,
            limit: ITEMS_PER_PAGE,
            offset: currentUsersPage * ITEMS_PER_PAGE
        });
        
        const response = await fetch(`/admin/users/search?${params}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        
        if (!data.users || data.users.length === 0) {
            container.innerHTML = '<div class="no-data">Пользователи не найдены</div>';
            return;
        }
        
        displayUsers(data.users);
        updatePagination('users', data.total, data.offset, data.limit);
    } catch (error) {
        console.error('Ошибка поиска пользователей:', error);
        container.innerHTML = `<div class="error">Ошибка поиска: ${error.message}</div>`;
    }
}

// Просмотр видео пользователя
function viewUserVideos(userId) {
    // Переключаемся на вкладку видео и фильтруем по пользователю
    switchTab('videos');
    setTimeout(() => {
        searchVideos(userId);
    }, 100);
}

// Удаление пользователя
async function deleteUser(userId, userName) {
    if (!confirm(`Вы уверены, что хотите удалить пользователя "${userName}"?\n\nВсе видео пользователя также будут удалены!\n\nЭто действие нельзя отменить!`)) {
        return;
    }
    
    try {
        const response = await fetch(`/admin/users/${userId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            const result = await response.json();
            showNotification(`Пользователь удален. Удалено видео: ${result.deletedVideos}`, 'success');
            loadUsers();
            loadStats();
        } else {
            throw new Error(`HTTP ${response.status}`);
        }
    } catch (error) {
        console.error('Ошибка удаления пользователя:', error);
        showNotification('Ошибка удаления пользователя', 'error');
    }
}

// Загрузка видео
async function loadVideos() {
    const container = document.getElementById('videos-container');
    container.innerHTML = '<div class="loading">Загрузка видео...</div>';
    
    try {
        const response = await fetch('/admin/videos');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        
        // Извлекаем массив видео из ответа
        const videos = Array.isArray(data.videos) ? data.videos : 
                      Array.isArray(data) ? data : [];
        
        if (videos.length === 0) {
            container.innerHTML = '<div class="no-data">Видео не найдены</div>';
            return;
        }
        
        displayVideos(videos);
    } catch (error) {
        console.error('Ошибка загрузки видео:', error);
        container.innerHTML = `<div class="error">Ошибка загрузки видео: ${error.message}</div>`;
    }
}

// Отображение видео
function displayVideos(videos) {
    const container = document.getElementById('videos-container');
    
    const table = `
        <table class="data-table">
            <thead>
                <tr>
                    <th><input type="checkbox" id="select-all-videos" onchange="toggleAllVideos(this)"></th>
                    <th>ID</th>
                    <th>Описание</th>
                    <th>Автор</th>
                    <th>Просмотры</th>
                    <th>Лайки</th>
                    <th>Координаты</th>
                    <th>Дата публикации</th>
                    <th>Действия</th>
                </tr>
            </thead>
            <tbody>
                ${videos.map(video => `
                    <tr>
                        <td><input type="checkbox" class="video-checkbox" value="${video.id}" onchange="updateBulkDeleteVideos()"></td>
                        <td>${video.id.substring(0, 8)}...</td>
                        <td>${video.description || 'Без описания'}</td>
                        <td>${video.users?.display_name || 'Неизвестно'}</td>
                        <td>${video.views_count || 0}</td>
                        <td>${video.likes_count || 0}</td>
                        <td>
                            ${video.latitude && video.longitude ? 
                                `${video.latitude.toFixed(4)}, ${video.longitude.toFixed(4)}` : 
                                'Нет координат'
                            }
                        </td>
                        <td>${new Date(video.created_at).toLocaleDateString('ru-RU')}</td>
                        <td>
                            <button class="btn btn-small btn-danger" onclick="deleteVideo('${video.id}', '${(video.description || 'Без описания').replace(/'/g, "\\'")}')">
                                🗑️ Удалить
                            </button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    
    container.innerHTML = table;
}

// Поиск видео
async function searchVideos(userId = null) {
    const query = document.getElementById('videos-search')?.value || '';
    const minViews = document.getElementById('videos-min-views')?.value || '';
    const minLikes = document.getElementById('videos-min-likes')?.value || '';
    const sortBy = document.getElementById('videos-sort')?.value || 'created_at';
    const order = document.getElementById('videos-order')?.value || 'desc';
    
    const container = document.getElementById('videos-container');
    container.innerHTML = '<div class="loading">Поиск видео...</div>';
    
    try {
        const params = new URLSearchParams({
            sortBy,
            order,
            limit: ITEMS_PER_PAGE,
            offset: currentVideosPage * ITEMS_PER_PAGE
        });
        
        if (query) params.append('query', query);
        if (userId) params.append('userId', userId);
        if (minViews) params.append('minViews', minViews);
        if (minLikes) params.append('minLikes', minLikes);
        
        const response = await fetch(`/admin/videos/search?${params}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        
        if (!data.videos || data.videos.length === 0) {
            container.innerHTML = '<div class="no-data">Видео не найдены</div>';
            return;
        }
        
        displayVideos(data.videos);
        updatePagination('videos', data.total, data.offset, data.limit);
    } catch (error) {
        console.error('Ошибка поиска видео:', error);
        container.innerHTML = `<div class="error">Ошибка поиска: ${error.message}</div>`;
    }
}

// Переключение всех чекбоксов видео
function toggleAllVideos(checkbox) {
    const checkboxes = document.querySelectorAll('.video-checkbox');
    checkboxes.forEach(cb => cb.checked = checkbox.checked);
    updateBulkDeleteVideos();
}

// Обновление кнопки массового удаления видео
function updateBulkDeleteVideos() {
    const checkboxes = document.querySelectorAll('.video-checkbox:checked');
    const btn = document.getElementById('bulk-delete-videos-btn');
    
    if (btn) {
        btn.disabled = checkboxes.length === 0;
        btn.textContent = `🗑️ Удалить выбранные (${checkboxes.length})`;
    }
    
    selectedVideoIds = Array.from(checkboxes).map(cb => cb.value);
}

// Массовое удаление видео
async function bulkDeleteVideos() {
    if (selectedVideoIds.length === 0) {
        showNotification('Выберите видео для удаления', 'warning');
        return;
    }
    
    if (!confirm(`Вы уверены, что хотите удалить ${selectedVideoIds.length} выбранных видео?\n\nЭто действие нельзя отменить!`)) {
        return;
    }
    
    try {
        const response = await fetch('/admin/videos/bulk', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ videoIds: selectedVideoIds })
        });
        
        if (response.ok) {
            const result = await response.json();
            showNotification(`Удалено видео: ${result.count}`, 'success');
            loadVideos();
            loadStats();
        } else {
            throw new Error(`HTTP ${response.status}`);
        }
    } catch (error) {
        console.error('Ошибка массового удаления:', error);
        showNotification('Ошибка массового удаления', 'error');
    }
}

// Удаление видео
async function deleteVideo(videoId, description) {
    if (!confirm(`Вы уверены, что хотите удалить видео "${description}"?\n\nЭто действие нельзя отменить!`)) {
        return;
    }
    
    try {
        const response = await fetch(`/admin/videos/${videoId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showNotification('Видео успешно удалено', 'success');
            loadVideos();
            loadStats();
        } else {
            throw new Error(`HTTP ${response.status}`);
        }
    } catch (error) {
        console.error('Ошибка удаления видео:', error);
        showNotification('Ошибка удаления видео', 'error');
    }
}

// Загрузка тегов
async function loadTags() {
    const container = document.getElementById('tags-container');
    container.innerHTML = '<div class="loading">Загрузка тегов...</div>';
    
    try {
        const response = await fetch('/admin/tags');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        
        // Извлекаем массив тегов из ответа
        allTags = Array.isArray(data.tags) ? data.tags : 
                 Array.isArray(data) ? data : [];
        
        if (allTags.length === 0) {
            container.innerHTML = '<div class="no-data">Теги не найдены</div>';
            return;
        }
        
        allTags.sort((a, b) => (b.usage_count || 0) - (a.usage_count || 0));
        
        const table = `
            <div class="tags-actions">
                <div class="tags-filters">
                    <select id="usage-filter" onchange="filterTags()" class="filter-select">
                        <option value="">Все теги (${allTags.length})</option>
                        <option value="0">Неиспользуемые (0 раз)</option>
                        <option value="1-5">Малоиспользуемые (1-5 раз)</option>
                        <option value="6-20">Среднеиспользуемые (6-20 раз)</option>
                        <option value="21+">Частоиспользуемые (21+ раз)</option>
                    </select>
                    <input type="text" id="search-tags" placeholder="Поиск тегов..." onkeyup="searchTags()" class="search-input">
                </div>
                <div class="tags-bulk-actions">
                    <button class="btn btn-secondary" onclick="selectAllTags()">Выбрать все</button>
                    <button class="btn btn-secondary" onclick="deselectAllTags()">Снять выбор</button>
                    <button class="btn btn-warning" onclick="fixTagCounters()" id="fix-counters-btn">
                        🔧 Исправить счетчики
                    </button>
                    <button class="btn btn-danger" onclick="deleteSelectedTags()" id="bulk-delete-btn" disabled>
                        🗑️ Удалить выбранные
                    </button>
                </div>
            </div>
            <table class="data-table">
                <thead>
                    <tr>
                        <th><input type="checkbox" id="select-all-checkbox" onchange="toggleAllTags(this)"></th>
                        <th>ID</th>
                        <th>Название</th>
                        <th>Использований</th>
                        <th>Создатель</th>
                        <th>Дата создания</th>
                        <th>Действия</th>
                    </tr>
                </thead>
                <tbody id="tags-tbody"></tbody>
            </table>
        `;
        
        container.innerHTML = table;
        filteredTags = [...allTags];
        renderFilteredTags();
    } catch (error) {
        console.error('Ошибка загрузки тегов:', error);
        container.innerHTML = `<div class="error">Ошибка загрузки тегов: ${error.message}</div>`;
    }
}

// Фильтрация тегов
function filterTags() {
    const usageFilter = document.getElementById('usage-filter').value;
    const searchQuery = document.getElementById('search-tags').value.toLowerCase();
    
    filteredTags = allTags.filter(tag => {
        let matchesUsage = true;
        let matchesSearch = true;
        
        if (usageFilter) {
            const usage = tag.usage_count || 0;
            switch (usageFilter) {
                case '0': matchesUsage = usage === 0; break;
                case '1-5': matchesUsage = usage >= 1 && usage <= 5; break;
                case '6-20': matchesUsage = usage >= 6 && usage <= 20; break;
                case '21+': matchesUsage = usage >= 21; break;
            }
        }
        
        if (searchQuery) {
            matchesSearch = tag.name.toLowerCase().includes(searchQuery);
        }
        
        return matchesUsage && matchesSearch;
    });
    
    renderFilteredTags();
}

function searchTags() {
    filterTags();
}

function renderFilteredTags() {
    const tbody = document.getElementById('tags-tbody');
    if (!tbody) return;
    
    if (filteredTags.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="no-data">Теги не найдены</td></tr>';
        return;
    }
    
    tbody.innerHTML = filteredTags.map(tag => {
        const creatorName = tag.creator_name || 'Система';
        const creatorId = tag.user_id ? tag.user_id.substring(0, 8) + '...' : '-';
        
        return `
            <tr>
                <td><input type="checkbox" class="tag-checkbox" value="${tag.id}" onchange="updateBulkDeleteButton()"></td>
                <td>${tag.id.substring(0, 8)}...</td>
                <td><span class="tag">${tag.name}</span></td>
                <td>${tag.usage_count || 0}</td>
                <td title="${creatorName} (${creatorId})">${creatorName}</td>
                <td>${new Date(tag.created_at).toLocaleDateString('ru-RU')}</td>
                <td>
                    <button class="btn btn-small btn-danger" onclick="deleteTag('${tag.id}', '${tag.name.replace(/'/g, "\\'")}', ${tag.usage_count || 0})">
                        🗑️ Удалить
                    </button>
                </td>
            </tr>
        `;
    }).join('');
    
    updateBulkDeleteButton();
}

function selectAllTags() {
    document.querySelectorAll('.tag-checkbox').forEach(cb => cb.checked = true);
    document.getElementById('select-all-checkbox').checked = true;
    updateBulkDeleteButton();
}

function deselectAllTags() {
    document.querySelectorAll('.tag-checkbox').forEach(cb => cb.checked = false);
    document.getElementById('select-all-checkbox').checked = false;
    updateBulkDeleteButton();
}

function toggleAllTags(checkbox) {
    document.querySelectorAll('.tag-checkbox').forEach(cb => cb.checked = checkbox.checked);
    updateBulkDeleteButton();
}

function updateBulkDeleteButton() {
    const selected = document.querySelectorAll('.tag-checkbox:checked');
    const btn = document.getElementById('bulk-delete-btn');
    
    if (btn) {
        btn.disabled = selected.length === 0;
        btn.textContent = `🗑️ Удалить выбранные (${selected.length})`;
    }
}

async function deleteTag(tagId, tagName, usageCount) {
    let message = `Вы уверены, что хотите удалить тег "${tagName}"?`;
    
    if (usageCount > 0) {
        message += `\n\n⚠️ Этот тег используется в ${usageCount} видео. Все связи будут удалены!`;
    }
    
    message += '\n\n❗ Это действие нельзя отменить!';
    
    if (!confirm(message)) return;
    
    try {
        const response = await fetch(`/admin/tags/${tagId}`, { method: 'DELETE' });
        
        if (response.ok) {
            const result = await response.json();
            showNotification(`Тег "${result.tagName}" удален. Удалено связей: ${result.deletedConnections}`, 'success');
            loadTags();
        } else {
            throw new Error(`HTTP ${response.status}`);
        }
    } catch (error) {
        console.error('Ошибка удаления тега:', error);
        showNotification('Ошибка удаления тега', 'error');
    }
}

async function deleteSelectedTags() {
    const selected = Array.from(document.querySelectorAll('.tag-checkbox:checked')).map(cb => cb.value);
    
    if (selected.length === 0) {
        showNotification('Выберите теги для удаления', 'warning');
        return;
    }
    
    if (!confirm(`Вы уверены, что хотите удалить ${selected.length} выбранных тегов?\n\n❗ Это действие нельзя отменить!`)) {
        return;
    }
    
    try {
        const response = await fetch('/admin/tags/bulk', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tagIds: selected })
        });
        
        if (response.ok) {
            const result = await response.json();
            showNotification(`Удалено тегов: ${result.successCount}`, 'success');
            loadTags();
        } else {
            throw new Error(`HTTP ${response.status}`);
        }
    } catch (error) {
        console.error('Ошибка массового удаления:', error);
        showNotification('Ошибка массового удаления', 'error');
    }
}

async function fixTagCounters() {
    if (!confirm('Вы уверены, что хотите исправить счетчики использования тегов?\n\nЭто действие проверит и исправит несоответствия между реальным количеством связей и счетчиками в базе данных.')) {
        return;
    }
    
    try {
        const btn = document.getElementById('fix-counters-btn');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '⏳ Исправление...';
        }
        
        const response = await fetch('/admin/tags/fix-counters', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
            const result = await response.json();
            
            if (result.fixedCount > 0) {
                showNotification(`Исправлено ${result.fixedCount} из ${result.totalTags} тегов`, 'success');
            } else {
                showNotification('Все счетчики тегов уже корректны', 'success');
            }
            
            loadTags();
        } else {
            throw new Error(`HTTP ${response.status}`);
        }
    } catch (error) {
        console.error('Ошибка исправления счетчиков:', error);
        showNotification('Ошибка исправления счетчиков', 'error');
    } finally {
        const btn = document.getElementById('fix-counters-btn');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '🔧 Исправить счетчики';
        }
    }
}

// Загрузка системной информации
async function loadSystemInfo() {
    const container = document.getElementById('system-info-container');
    container.innerHTML = '<div class="loading">Загрузка системной информации...</div>';
    
    try {
        const response = await fetch('/admin/system/info');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        
        const formatBytes = (bytes) => {
            const gb = (bytes / (1024 ** 3)).toFixed(2);
            const mb = (bytes / (1024 ** 2)).toFixed(2);
            return bytes > 1024 ** 3 ? `${gb} GB` : `${mb} MB`;
        };
        
        const formatUptime = (seconds) => {
            const days = Math.floor(seconds / 86400);
            const hours = Math.floor((seconds % 86400) / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            return `${days}д ${hours}ч ${minutes}м`;
        };
        
        container.innerHTML = `
            <div class="system-info-grid">
                <div class="info-card">
                    <h3>💻 Операционная система</h3>
                    <p><strong>Платформа:</strong> ${data.os.platform}</p>
                    <p><strong>Хост:</strong> ${data.os.hostname}</p>
                    <p><strong>Время работы:</strong> ${formatUptime(data.os.uptime)}</p>
                    <p><strong>Node.js:</strong> ${data.os.nodeVersion}</p>
                </div>
                
                <div class="info-card">
                    <h3>🧠 Память</h3>
                    <p><strong>Всего:</strong> ${formatBytes(data.memory.total)}</p>
                    <p><strong>Использовано:</strong> ${formatBytes(data.memory.used)}</p>
                    <p><strong>Свободно:</strong> ${formatBytes(data.memory.free)}</p>
                    <p><strong>Использование:</strong> ${data.memory.usagePercent}%</p>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${data.memory.usagePercent}%"></div>
                    </div>
                </div>
                
                <div class="info-card">
                    <h3>⚙️ Процессор</h3>
                    <p><strong>Модель:</strong> ${data.cpu.model}</p>
                    <p><strong>Ядер:</strong> ${data.cpu.count}</p>
                </div>
                
                <div class="info-card">
                    <h3>📊 Процесс Node.js</h3>
                    <p><strong>Время работы:</strong> ${formatUptime(data.process.uptime)}</p>
                    <p><strong>RSS:</strong> ${formatBytes(data.process.memory.rss)}</p>
                    <p><strong>Heap Total:</strong> ${formatBytes(data.process.memory.heapTotal)}</p>
                    <p><strong>Heap Used:</strong> ${formatBytes(data.process.memory.heapUsed)}</p>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Ошибка загрузки системной информации:', error);
        container.innerHTML = `<div class="error">Ошибка загрузки: ${error.message}</div>`;
    }
}

// Очистка данных
async function cleanupData(type) {
    const messages = {
        'unused_tags': 'удалить неиспользуемые теги',
        'old_videos': 'удалить старые видео без просмотров (старше 90 дней)'
    };
    
    if (!confirm(`Вы уверены, что хотите ${messages[type]}?\n\nЭто действие нельзя отменить!`)) {
        return;
    }
    
    try {
        const response = await fetch('/admin/system/cleanup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type })
        });
        
        if (response.ok) {
            const result = await response.json();
            showNotification(`Удалено записей: ${result.deletedCount}`, 'success');
            loadStats();
        } else {
            throw new Error(`HTTP ${response.status}`);
        }
    } catch (error) {
        console.error('Ошибка очистки данных:', error);
        showNotification('Ошибка очистки данных', 'error');
    }
}

// Загрузка логов активности
async function loadActivityLogs() {
    const container = document.getElementById('activity-logs-container');
    container.innerHTML = '<div class="loading">Загрузка логов...</div>';
    
    try {
        const response = await fetch('/admin/activity-logs?limit=50');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        
        if (!data.logs || data.logs.length === 0) {
            container.innerHTML = '<div class="no-data">Логи не найдены</div>';
            return;
        }
        
        const logsHtml = data.logs.map(log => {
            const icon = log.type === 'video_upload' ? '🎬' : '👤';
            const typeLabel = log.type === 'video_upload' ? 'Загрузка видео' : 'Регистрация';
            const date = new Date(log.timestamp).toLocaleString('ru-RU');
            
            return `
                <div class="log-item">
                    <span class="log-icon">${icon}</span>
                    <div class="log-content">
                        <div class="log-header">
                            <strong>${typeLabel}</strong>
                            <span class="log-time">${date}</span>
                        </div>
                        <div class="log-description">
                            <strong>${log.user}:</strong> ${log.description}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = `<div class="logs-list">${logsHtml}</div>`;
    } catch (error) {
        console.error('Ошибка загрузки логов:', error);
        container.innerHTML = `<div class="error">Ошибка загрузки логов: ${error.message}</div>`;
    }
}

// Экспорт данных
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

// Пагинация
function updatePagination(type, total, offset, limit) {
    const container = document.getElementById(`${type}-pagination`);
    if (!container) return;
    
    const totalPages = Math.ceil(total / limit);
    const currentPage = Math.floor(offset / limit) + 1;
    
    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }
    
    let html = `<div class="pagination-info">Страница ${currentPage} из ${totalPages} (всего: ${total})</div>`;
    html += '<div class="pagination-buttons">';
    
    if (currentPage > 1) {
        html += `<button class="btn btn-small" onclick="changePage('${type}', ${currentPage - 2})">← Назад</button>`;
    }
    
    if (currentPage < totalPages) {
        html += `<button class="btn btn-small" onclick="changePage('${type}', ${currentPage})">Вперед →</button>`;
    }
    
    html += '</div>';
    container.innerHTML = html;
}

function changePage(type, page) {
    if (type === 'users') {
        currentUsersPage = page;
        searchUsers();
    } else if (type === 'videos') {
        currentVideosPage = page;
        searchVideos();
    }
}

// Диалог очистки
function showCleanupDialog() {
    if (confirm('Выберите действие:\n\nОК - Удалить неиспользуемые теги\nОтмена - Удалить старые видео без просмотров')) {
        cleanupData('unused_tags');
    } else {
        cleanupData('old_videos');
    }
}

// Выход
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

// Уведомления
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 10000;
        max-width: 400px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        backdrop-filter: blur(10px);
        animation: slideIn 0.3s ease;
    `;
    
    switch(type) {
        case 'success': notification.style.background = 'rgba(76, 175, 80, 0.9)'; break;
        case 'error': notification.style.background = 'rgba(244, 67, 54, 0.9)'; break;
        case 'warning': notification.style.background = 'rgba(255, 152, 0, 0.9)'; break;
        default: notification.style.background = 'rgba(33, 150, 243, 0.9)';
    }
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 5000);
}

// CSS для анимаций
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

// Инициализация
// Создание нового тега
async function createTag() {
    const input = document.getElementById('new-tag-name');
    const tagName = input.value.trim();
    
    if (!tagName) {
        showNotification('Введите название тега', 'warning');
        input.focus();
        return;
    }
    
    if (tagName.length > 50) {
        showNotification('Название тега не должно превышать 50 символов', 'warning');
        input.focus();
        return;
    }
    
    // Проверяем, не существует ли уже такой тег
    const existingTag = allTags.find(tag => tag.name.toLowerCase() === tagName.toLowerCase());
    if (existingTag) {
        showNotification(`Тег "${tagName}" уже существует`, 'warning');
        input.focus();
        return;
    }
    
    try {
        // Отправляем запрос на создание тега
        const response = await fetch('/admin/tags', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name: tagName })
        });
        
        if (response.ok) {
            const result = await response.json();
            showNotification(`Тег "${result.tag.name}" успешно создан`, 'success');
            
            // Очищаем поле ввода
            input.value = '';
            
            // Обновляем список тегов
            loadTags();
        } else {
            const error = await response.json();
            throw new Error(error.message || 'Ошибка создания тега');
        }
    } catch (error) {
        console.error('Ошибка создания тега:', error);
        showNotification(`Ошибка создания тега: ${error.message}`, 'error');
    }
}

// Обработчик нажатия Enter в поле ввода тега
document.addEventListener('DOMContentLoaded', function() {
    const tagInput = document.getElementById('new-tag-name');
    if (tagInput) {
        tagInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                createTag();
            }
        });
    }
    
    loadStats();
    loadDashboardChart();
    
    // Обновляем статистику каждые 30 секунд
    setInterval(loadStats, 30000);
});

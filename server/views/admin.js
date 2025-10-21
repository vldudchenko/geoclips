import '../views/admin.css';
// Загрузка статистики
async function loadStats() {
    try {
        console.log('Загружаем статистику...');
        const response = await fetch(`${window.location.origin}/admin/stats`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Статистика получена:', data);
        
        document.getElementById('users-count').textContent = data.usersCount || 0;
        document.getElementById('videos-count').textContent = data.videosCount || 0;
        document.getElementById('total-views').textContent = data.totalViews || 0;
        document.getElementById('total-likes').textContent = data.totalLikes || 0;
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
        document.getElementById('users-count').textContent = 'Ошибка';
        document.getElementById('videos-count').textContent = 'Ошибка';
        document.getElementById('total-views').textContent = 'Ошибка';
        document.getElementById('total-likes').textContent = 'Ошибка';
    }
}

// Загрузка пользователей
async function loadUsers() {
    const container = document.getElementById('users-container');
    container.innerHTML = '<div class="loading">Загрузка пользователей...</div>';
    
    try {
        console.log('Загружаем пользователей...');
        const response = await fetch(`${window.location.origin}/admin/users`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const users = await response.json();
        console.log('Пользователи получены:', users);
        
        if (users.length === 0) {
            container.innerHTML = '<div class="no-data">Пользователи не найдены</div>';
            return;
        }
        
        const table = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Аватар</th>
                        <th>Имя Фамилия</th>
                        <th>Логин</th>
                        <th>Видео</th>
                        <th>Дата регистрации</th>
                        <th>Yandex ID</th>
                    </tr>
                </thead>
                <tbody>
                    ${users.map(user => `
                        <tr>
                            <td>${user.id}</td>
                            <td>
                                ${user.avatar_url ? 
                                    `<img src="${user.avatar_url}" class="avatar" alt="Аватар">` : 
                                    `<div class="avatar" style="background: #ddd; display: flex; align-items: center; justify-content: center;">👤</div>`
                                }
                            </td>
                            <td>${user.first_name || ''} ${user.last_name || ''}</td>
                            <td>${user.display_name || 'Неизвестно'}</td>
                            <td>
                                <span class="video-count">${user.videos_count || 0}</span>
                                <span class="video-count-label">видео</span>
                            </td>
                            <td>${new Date(user.created_at).toLocaleDateString('ru-RU')}</td>
                            <td>${user.yandex_id || '-'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        
        container.innerHTML = table;
    } catch (error) {
        console.error('Ошибка загрузки пользователей:', error);
        container.innerHTML = `<div class="error">Ошибка загрузки пользователей: ${error.message}</div>`;
    }
}

// Загрузка видео
async function loadVideos() {
    const container = document.getElementById('videos-container');
    container.innerHTML = '<div class="loading">Загрузка видео...</div>';
    
    try {
        console.log('Загружаем видео...');
        const response = await fetch(`${window.location.origin}/admin/videos`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const videos = await response.json();
        console.log('Видео получены:', videos);
        
        if (videos.length === 0) {
            container.innerHTML = '<div class="no-data">Видео не найдены</div>';
            return;
        }
        
        const table = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Превью</th>
                        <th>ID</th>
                        <th>Описание</th>
                        <th>Автор</th>
                        <th>Просмотры</th>
                        <th>Лайки</th>
                        <th>Координаты</th>
                        <th>Дата создания</th>
                        <th>Действия</th>
                    </tr>
                </thead>
                <tbody>
                    ${videos.map(video => `
                        <tr>
                            <td>
                                <div class="video-preview-container">
                                    <div class="video-preview-placeholder" onclick="generateThumbnail('${video.video_url}')">
                                        <span>📹</span>
                                        <small>Нажмите для генерации превью</small>
                                    </div>
                                </div>
                            </td>
                            <td>${video.id}</td>
                            <td>${video.description || 'Без описания'}</td>
                            <td>${video.users?.display_name || 'Неизвестно'}</td>
                            <td>${video.views_count || 0}</td>
                            <td>${video.likes_count || 0}</td>
                            <td>${video.latitude && video.longitude ? 
                                `${video.latitude.toFixed(4)}, ${video.longitude.toFixed(4)}` : 
                                'Нет координат'
                            }</td>
                            <td>${new Date(video.created_at).toLocaleDateString('ru-RU')}</td>
                            <td>
                                <button class="btn btn-danger" onclick="deleteVideo('${video.id}', '${video.description || 'Без описания'}')">
                                    🗑️ Удалить
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        
        container.innerHTML = table;
    } catch (error) {
        console.error('Ошибка загрузки видео:', error);
        container.innerHTML = `<div class="error">Ошибка загрузки видео: ${error.message}</div>`;
    }
}

// Удаление видео
async function deleteVideo(videoId, description) {
    if (!confirm(`Вы уверены, что хотите удалить видео "${description}"?\n\nЭто действие нельзя отменить!`)) {
        return;
    }
    
    try {
        const response = await fetch(`${window.location.origin}/admin/videos/${videoId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            alert('Видео успешно удалено!');
            loadVideos(); // Перезагружаем список
            loadStats(); // Обновляем статистику
        } else {
            const error = await response.json();
            alert(`Ошибка удаления видео: ${error.error}`);
        }
    } catch (error) {
        alert(`Ошибка удаления видео: ${error.message}`);
    }
}

// Загрузка тегов
async function loadTags() {
    const container = document.getElementById('tags-container');
    container.innerHTML = '<div class="loading">Загрузка тегов...</div>';
    
    try {
        console.log('Загружаем теги...');
        const response = await fetch(`${window.location.origin}/admin/tags`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        allTags = await response.json();
        console.log('Теги получены:', allTags);
        
        if (allTags.length === 0) {
            container.innerHTML = '<div class="no-data">Теги не найдены</div>';
            return;
        }
        
        // Сортируем теги по количеству использований (убывание)
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
                        <th>
                            <input type="checkbox" id="select-all-checkbox" onchange="toggleAllTags(this)">
                        </th>
                        <th>ID</th>
                        <th>Название</th>
                        <th>Использований</th>
                        <th>Дата создания</th>
                        <th>Действия</th>
                    </tr>
                </thead>
                <tbody>
                    <!-- Содержимое будет загружено через renderFilteredTags() -->
                </tbody>
            </table>
        `;
        
        container.innerHTML = table;
        
        // Инициализируем отображение тегов
        filteredTags = [...allTags];
        renderFilteredTags();
    } catch (error) {
        console.error('Ошибка загрузки тегов:', error);
        container.innerHTML = `<div class="error">Ошибка загрузки тегов: ${error.message}</div>`;
    }
}

// Удаление тега
async function deleteTag(tagId, tagName, usageCount) {
    let message = `Вы уверены, что хотите удалить тег "${tagName}"?`;
    
    if (usageCount > 0) {
        message += `\n\n⚠️ Этот тег используется в ${usageCount} видео. Все связи будут удалены!`;
    }
    
    message += '\n\n❗ Это действие нельзя отменить!';
    
    if (!confirm(message)) {
        return;
    }
    
    try {
        // Показываем индикатор загрузки
        const deleteButton = document.querySelector(`button[onclick*="${tagId}"]`);
        if (deleteButton) {
            deleteButton.disabled = true;
            deleteButton.innerHTML = '⏳ Удаление...';
        }
        
        const response = await fetch(`${window.location.origin}/admin/tags/${tagId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            const result = await response.json();
            showNotification(`✅ Тег "${result.tagName}" успешно удален. Удалено связей: ${result.deletedConnections}`, 'success');
            loadTags(); // Перезагружаем список
        } else {
            const error = await response.json();
            showNotification(`❌ Ошибка удаления тега: ${error.error}`, 'error');
        }
    } catch (error) {
        showNotification(`❌ Ошибка удаления тега: ${error.message}`, 'error');
    }
}

// Переменные для хранения всех тегов и отфильтрованных тегов
let allTags = [];
let filteredTags = [];

// Функции фильтрации и поиска тегов
function filterTags() {
    const usageFilter = document.getElementById('usage-filter').value;
    const searchQuery = document.getElementById('search-tags').value.toLowerCase();
    
    filteredTags = allTags.filter(tag => {
        let matchesUsage = true;
        let matchesSearch = true;
        
        // Фильтр по использованию
        if (usageFilter) {
            const usage = tag.usage_count || 0;
            switch (usageFilter) {
                case '0':
                    matchesUsage = usage === 0;
                    break;
                case '1-5':
                    matchesUsage = usage >= 1 && usage <= 5;
                    break;
                case '6-20':
                    matchesUsage = usage >= 6 && usage <= 20;
                    break;
                case '21+':
                    matchesUsage = usage >= 21;
                    break;
            }
        }
        
        // Фильтр по поиску
        if (searchQuery) {
            matchesSearch = tag.name.toLowerCase().includes(searchQuery);
        }
        
        return matchesUsage && matchesSearch;
    });
    
    renderFilteredTags();
}

function searchTags() {
    filterTags(); // Переиспользуем логику фильтрации
}

function renderFilteredTags() {
    const tbody = document.querySelector('#tags-container table tbody');
    if (!tbody) return;
    
    if (filteredTags.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="no-data">Теги не найдены</td></tr>';
        return;
    }
    
    tbody.innerHTML = filteredTags.map(tag => `
        <tr>
            <td>
                <input type="checkbox" class="tag-checkbox" value="${tag.id}" onchange="updateBulkDeleteButton()">
            </td>
            <td>${tag.id}</td>
            <td><span class="tag">${tag.name}</span></td>
            <td>${tag.usage_count}</td>
            <td>${new Date(tag.created_at).toLocaleDateString('ru-RU')}</td>
            <td>
                <button class="btn btn-danger" onclick="deleteTag('${tag.id}', '${tag.name.replace(/'/g, "\\'")}', ${tag.usage_count})">
                    🗑️ Удалить
                </button>
            </td>
        </tr>
    `).join('');
    
    updateBulkDeleteButton();
}

// Функции для массового удаления тегов
function selectAllTags() {
    const checkboxes = document.querySelectorAll('.tag-checkbox');
    const selectAllCheckbox = document.getElementById('select-all-checkbox');
    
    checkboxes.forEach(checkbox => {
        checkbox.checked = true;
    });
    selectAllCheckbox.checked = true;
    updateBulkDeleteButton();
}

function deselectAllTags() {
    const checkboxes = document.querySelectorAll('.tag-checkbox');
    const selectAllCheckbox = document.getElementById('select-all-checkbox');
    
    checkboxes.forEach(checkbox => {
        checkbox.checked = false;
    });
    selectAllCheckbox.checked = false;
    updateBulkDeleteButton();
}

function toggleAllTags(selectAllCheckbox) {
    const checkboxes = document.querySelectorAll('.tag-checkbox');
    
    checkboxes.forEach(checkbox => {
        checkbox.checked = selectAllCheckbox.checked;
    });
    updateBulkDeleteButton();
}

function updateBulkDeleteButton() {
    const selectedCheckboxes = document.querySelectorAll('.tag-checkbox:checked');
    const bulkDeleteBtn = document.getElementById('bulk-delete-btn');
    
    if (bulkDeleteBtn) {
        bulkDeleteBtn.disabled = selectedCheckboxes.length === 0;
        bulkDeleteBtn.textContent = `🗑️ Удалить выбранные (${selectedCheckboxes.length})`;
    }
}

// Исправление счетчиков использования тегов
async function fixTagCounters() {
    const message = 'Вы уверены, что хотите исправить счетчики использования тегов?\n\nЭто действие проверит и исправит несоответствия между реальным количеством связей и счетчиками в базе данных.';
    
    if (!confirm(message)) {
        return;
    }
    
    try {
        const fixBtn = document.getElementById('fix-counters-btn');
        if (fixBtn) {
            fixBtn.disabled = true;
            fixBtn.innerHTML = '⏳ Исправление...';
        }
        
        const response = await fetch(`${window.location.origin}/admin/tags/fix-counters`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const result = await response.json();
            
            if (result.fixedCount > 0) {
                showNotification(`✅ Исправлено ${result.fixedCount} из ${result.totalTags} тегов`, 'success');
                
                // Показываем детали исправлений в консоли
                if (result.results && result.results.length > 0) {
                    console.log('Исправленные теги:', result.results);
                }
            } else {
                showNotification('✅ Все счетчики тегов уже корректны', 'success');
            }
            
            // Перезагружаем список тегов
            loadTags();
        } else {
            const error = await response.json();
            showNotification(`❌ Ошибка исправления счетчиков: ${error.error}`, 'error');
        }
        
    } catch (error) {
        showNotification(`❌ Ошибка исправления счетчиков: ${error.message}`, 'error');
    } finally {
        // Восстанавливаем кнопку
        const fixBtn = document.getElementById('fix-counters-btn');
        if (fixBtn) {
            fixBtn.disabled = false;
            fixBtn.innerHTML = '🔧 Исправить счетчики';
        }
    }
}

async function deleteSelectedTags() {
    const selectedCheckboxes = document.querySelectorAll('.tag-checkbox:checked');
    const selectedTagIds = Array.from(selectedCheckboxes).map(cb => cb.value);
    
    if (selectedTagIds.length === 0) {
        showNotification('Выберите теги для удаления', 'warning');
        return;
    }
    
    const message = `Вы уверены, что хотите удалить ${selectedTagIds.length} выбранных тегов?\n\n❗ Это действие нельзя отменить!`;
    
    if (!confirm(message)) {
        return;
    }
    
    try {
        const bulkDeleteBtn = document.getElementById('bulk-delete-btn');
        if (bulkDeleteBtn) {
            bulkDeleteBtn.disabled = true;
            bulkDeleteBtn.innerHTML = '⏳ Удаление...';
        }
        
        // Используем новый API endpoint для массового удаления
        const response = await fetch(`${window.location.origin}/admin/tags/bulk`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ tagIds: selectedTagIds })
        });
        
        if (response.ok) {
            const result = await response.json();
            
            if (result.successCount > 0) {
                showNotification(`✅ Успешно удалено ${result.successCount} из ${result.total} тегов`, 'success');
            }
            
            if (result.errorCount > 0) {
                showNotification(`❌ Ошибка при удалении ${result.errorCount} тегов`, 'error');
                if (result.errors && result.errors.length > 0) {
                    console.error('Ошибки удаления:', result.errors);
                }
            }
            
            // Перезагружаем список тегов
            loadTags();
        } else {
            const error = await response.json();
            showNotification(`❌ Ошибка массового удаления: ${error.error}`, 'error');
        }
        
    } catch (error) {
        showNotification(`❌ Ошибка массового удаления: ${error.message}`, 'error');
    } finally {
        // Восстанавливаем кнопку
        const bulkDeleteBtn = document.getElementById('bulk-delete-btn');
        if (bulkDeleteBtn) {
            bulkDeleteBtn.disabled = false;
            updateBulkDeleteButton();
        }
    }
}

// Выход из админки
async function logout() {
    if (!confirm('Вы уверены, что хотите выйти из админки?')) {
        return;
    }
    
    try {
        const response = await fetch(`${window.location.origin}/admin/logout`, {
            method: 'POST'
        });
        
        if (response.ok) {
            // Перенаправляем на страницу входа
            window.location.href = '/admin';
        } else {
            alert('Ошибка при выходе из системы');
        }
    } catch (error) {
        alert(`Ошибка при выходе: ${error.message}`);
    }
}

// Генерация превью видео
async function generateThumbnail(videoUrl) {
    if (!videoUrl) {
        showNotification('URL видео не найден', 'error');
        return;
    }
    
    try {
        showNotification('Генерация превью...', 'info');
        
        const response = await fetch(`${window.location.origin}/admin/generate-thumbnail`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ videoUrl })
        });
        
        if (response.ok) {
            const result = await response.json();
            showNotification('Превью успешно создано!', 'success');
            loadVideos(); // Перезагружаем список видео
        } else {
            const error = await response.json();
            showNotification(`Ошибка генерации превью: ${error.error}`, 'error');
        }
    } catch (error) {
        console.error('Ошибка генерации превью:', error);
        showNotification('Ошибка генерации превью', 'error');
    }
}

// Функция для показа уведомлений
function showNotification(message, type = 'info') {
    // Создаем элемент уведомления
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Стили для уведомления
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
    
    // Цвета в зависимости от типа
    switch(type) {
        case 'success':
            notification.style.background = 'rgba(76, 175, 80, 0.9)';
            break;
        case 'error':
            notification.style.background = 'rgba(244, 67, 54, 0.9)';
            break;
        case 'warning':
            notification.style.background = 'rgba(255, 152, 0, 0.9)';
            break;
        default:
            notification.style.background = 'rgba(33, 150, 243, 0.9)';
    }
    
    // Добавляем в DOM
    document.body.appendChild(notification);
    
    // Удаляем через 5 секунд
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 5000);
}

// CSS для анимаций уведомлений
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
document.addEventListener('DOMContentLoaded', function() {
    loadStats();
    loadUsers();
    loadVideos();
    loadTags();
    
    // Обновляем статистику каждые 30 секунд
    setInterval(loadStats, 30000);
});


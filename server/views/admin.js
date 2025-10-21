// Загрузка статистики
async function loadStats() {
    try {
        console.log('Загружаем статистику...');
        const response = await fetch('/admin/stats');
        
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
        const response = await fetch('/admin/users');
        
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
        const response = await fetch('/admin/videos');
        
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
                                <button class="btn btn-danger" onclick="deleteVideo(${video.id}, '${video.description || 'Без описания'}')">
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
        const response = await fetch(`/admin/videos/${videoId}`, {
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
        const response = await fetch('/admin/tags');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const tags = await response.json();
        console.log('Теги получены:', tags);
        
        if (tags.length === 0) {
            container.innerHTML = '<div class="no-data">Теги не найдены</div>';
            return;
        }
        
        const table = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Название</th>
                        <th>Использований</th>
                        <th>Дата создания</th>
                        <th>Действия</th>
                    </tr>
                </thead>
                <tbody>
                    ${tags.map(tag => `
                        <tr>
                            <td>${tag.id}</td>
                            <td>${tag.name}</td>
                            <td>${tag.usage_count}</td>
                            <td>${new Date(tag.created_at).toLocaleDateString('ru-RU')}</td>
                            <td>
                                <button class="btn btn-danger" onclick="deleteTag(${tag.id}, '${tag.name}', ${tag.usage_count})">
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
        console.error('Ошибка загрузки тегов:', error);
        container.innerHTML = `<div class="error">Ошибка загрузки тегов: ${error.message}</div>`;
    }
}

// Удаление тега
async function deleteTag(tagId, tagName, usageCount) {
    let message = `Вы уверены, что хотите удалить тег "${tagName}"?`;
    
    if (usageCount > 0) {
        message += `\n\nЭтот тег используется в ${usageCount} видео. Все связи будут удалены!`;
    }
    
    message += '\n\nЭто действие нельзя отменить!';
    
    if (!confirm(message)) {
        return;
    }
    
    try {
        const response = await fetch(`/admin/tags/${tagId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            alert('Тег успешно удален!');
            loadTags(); // Перезагружаем список
        } else {
            const error = await response.json();
            alert(`Ошибка удаления тега: ${error.error}`);
        }
    } catch (error) {
        alert(`Ошибка удаления тега: ${error.message}`);
    }
}

// Выход из админки
async function logout() {
    if (!confirm('Вы уверены, что хотите выйти из админки?')) {
        return;
    }
    
    try {
        const response = await fetch('/admin/logout', {
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

// Инициализация
document.addEventListener('DOMContentLoaded', function() {
    loadStats();
    loadUsers();
    loadVideos();
    loadTags();
    
    // Обновляем статистику каждые 30 секунд
    setInterval(loadStats, 30000);
});


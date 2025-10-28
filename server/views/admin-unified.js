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
        case 'users':
            loadUsers();
            break;
        case 'videos':
            loadVideos();
            break;
        case 'tags':
            loadTags();
            break;
        case 'comments':
            loadComments();
            break;

    }
}

/**
 * Выход из админки
 */
async function logout() {
    if (!confirm('Вы уверены, что хотите выйти из админки?')) return;
    
    try {
        const response = await fetch('/admin/logout', { method: 'POST', credentials: 'include' });
        
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

// ==================== НАВИГАЦИЯ ПО ДАННЫМ ====================

/**
 * Обработка клика по неактивному элементу
 */
function handleDisabledClick(message) {
    showNotification(message, 'warning');
}

/**
 * Переход к профилю пользователя
 */
function navigateToUserProfile(userId, userName) {
    console.log('👤 Переход к профилю пользователя:', { userId, userName });
    
    // Переключаемся на вкладку пользователей
    switchTab('users');
    
    // Фильтруем пользователей по ID
    setTimeout(() => {
        // Очищаем поле поиска
        const searchInput = document.getElementById('users-search');
        if (searchInput) {
            searchInput.value = '';
        }
        
        // Загружаем пользователей и выделяем нужного
        loadUsers().then(() => {
            // Активируем режим размытия для контейнера
            const usersContainer = document.querySelector('.users-table-container');
            if (usersContainer) {
                usersContainer.classList.add('blur-mode');
                
                // Добавляем обработчик клика для отключения размытия
                const disableBlurHandler = (e) => {
                    if (e.target.closest('tr')) {
                        usersContainer.classList.remove('blur-mode');
                        usersContainer.removeEventListener('click', disableBlurHandler);
                    }
                };
                usersContainer.addEventListener('click', disableBlurHandler);
            }
            
            // Выделяем строку пользователя
            const userRow = document.getElementById(`user-row-${userId}`);
            if (userRow) {
                userRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
                userRow.classList.add('highlighted');
                
                // Убираем выделение и размытие через 4 секунды
                setTimeout(() => {
                    userRow.classList.remove('highlighted');
                    if (usersContainer) {
                        usersContainer.classList.remove('blur-mode');
                    }
                }, 4000);
            }
        });
    }, 100);
    
    showNotification(`Показываем профиль пользователя: ${userName}`, 'info');
}

/**
 * Переход к видео пользователя
 */
function navigateToUserVideos(userId, userName) {
    console.log('🎬 Переход к видео пользователя:', { userId, userName });
    
    // Переключаемся на вкладку видео
    switchTab('videos');
    
    // Фильтруем видео по пользователю
    setTimeout(() => {
        // Очищаем поле поиска
        const searchInput = document.getElementById('videos-search');
        if (searchInput) {
            searchInput.value = '';
        }
        
        // Загружаем видео пользователя
        loadUserVideos(userId, userName);
    }, 100);
    
    showNotification(`Показываем видео пользователя: ${userName}`, 'info');
}

/**
 * Загрузить видео пользователя
 */
async function loadUserVideos(userId, userName) {
    try {
        showNotification('Загрузка видео пользователя...', 'info');
        
        const params = new URLSearchParams({
            userId: userId,
            sortBy: 'created_at',
            order: 'desc',
            limit: ITEMS_PER_PAGE,
            offset: 0
        });
        
        const response = await fetch(`/admin/videos/admin/search?${params}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        
        // Обновляем заголовок для показа фильтра
        const videosContainer = document.getElementById('videos-container');
        if (videosContainer) {
            const existingHeader = videosContainer.querySelector('.filter-header');
            if (existingHeader) {
                existingHeader.remove();
            }
            
            const filterHeader = document.createElement('div');
            filterHeader.className = 'filter-header';
            filterHeader.innerHTML = `
                <div class="filter-info">
                    <span class="filter-label">Фильтр:</span>
                    <span class="filter-value">Видео пользователя "${userName}"</span>
                    <button class="btn btn-secondary btn-small" onclick="clearVideoFilter()">Сбросить фильтр</button>
                </div>
            `;
            videosContainer.insertBefore(filterHeader, videosContainer.firstChild);
        }
        
        displayVideos(data.data);
        
        showNotification(`Найдено видео: ${data.data?.length || 0}`, 'success');
    } catch (error) {
        console.error('Ошибка загрузки видео пользователя:', error);
        showNotification('Ошибка загрузки видео пользователя', 'error');
    }
}

/**
 * Сбросить фильтр видео
 */
function clearVideoFilter() {
    const videosContainer = document.getElementById('videos-container');
    if (videosContainer) {
        const filterHeader = videosContainer.querySelector('.filter-header');
        if (filterHeader) {
            filterHeader.remove();
        }
    }
    
    // Загружаем все видео
    loadVideos();
}

/**
 * Переход к комментариям пользователя
 */
function navigateToUserComments(userId, userName, type = 'written') {
    console.log('💬 Переход к комментариям пользователя:', { userId, userName, type });
    
    // Переключаемся на вкладку комментариев (если есть) или создаем модальное окно
    showCommentsModal(userId, userName, type);
}

/**
 * Переход к лайкам пользователя
 */
function navigateToUserLikes(userId, userName, type = 'given') {
    console.log('❤️ Переход к лайкам пользователя:', { userId, userName, type });
    
    // Создаем модальное окно с лайками
    showLikesModal(userId, userName, type);
}

/**
 * Переход к тегам пользователя
 */
function navigateToUserTags(userId, userName, type = 'created') {
    console.log('🏷️ Переход к тегам пользователя:', { userId, userName, type });
    
    // Переключаемся на вкладку тегов
    switchTab('tags');
    
    // Фильтруем теги по пользователю
    setTimeout(() => {
        // Очищаем поле поиска
        const searchInput = document.getElementById('tags-search');
        if (searchInput) {
            searchInput.value = '';
        }
        
        // Загружаем теги пользователя
        loadUserTags(userId, userName, type);
    }, 100);
    
    showNotification(`Показываем теги пользователя: ${userName}`, 'info');
}

/**
 * Загрузить теги пользователя
 */
async function loadUserTags(userId, userName, type) {
    try {
        showNotification('Загрузка тегов пользователя...', 'info');
        
        const params = new URLSearchParams({
            userId: userId,
            sortBy: 'name',
            order: 'asc'
        });
        
        const response = await fetch(`/admin/tags?${params}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        
        // Фильтруем теги в зависимости от типа
        let filteredTags = data.tags || [];
        if (type === 'created') {
            // Показываем только теги, созданные пользователем
            filteredTags = filteredTags.filter(tag => tag.user_id === userId);
        } else if (type === 'used') {
            // Показываем теги, которые были присвоены к видео пользователя
            try {
                const videosResponse = await fetch(`/admin/videos/admin/search?userId=${userId}&limit=1000`, { credentials: 'include' });
                if (videosResponse.ok) {
                    const videosData = await videosResponse.json();
                    const videoIds = videosData.data?.map(video => video.id) || [];
                    
                    if (videoIds.length > 0) {
                        // Получаем все теги, которые были присвоены к видео пользователя
                        const usedTagsResponse = await fetch(`/admin/tags`, { credentials: 'include' });
                        if (usedTagsResponse.ok) {
                            const allTagsData = await usedTagsResponse.json();
                            const allTags = allTagsData.tags || [];
                            
                            // Фильтруем теги, которые были присвоены к видео пользователя
                            // Для этого нужно проверить, есть ли связь между тегом и видео пользователя
                            // Пока что показываем все теги пользователя
                            filteredTags = allTags.filter(tag => tag.user_id === userId);
                        }
                    } else {
                        filteredTags = [];
                    }
                }
            } catch (error) {
                console.error('Ошибка получения видео пользователя:', error);
                // Fallback: показываем все теги пользователя
                filteredTags = filteredTags.filter(tag => tag.user_id === userId);
            }
        }
        
        // Обновляем заголовок для показа фильтра
        const tagsContainer = document.getElementById('tags-container');
        if (tagsContainer) {
            const existingHeader = tagsContainer.querySelector('.filter-header');
            if (existingHeader) {
                existingHeader.remove();
            }
            
            const filterHeader = document.createElement('div');
            filterHeader.className = 'filter-header';
            const typeText = type === 'created' ? 'созданные' : 'использованные';
            filterHeader.innerHTML = `
                <div class="filter-info">
                    <span class="filter-label">Фильтр:</span>
                    <span class="filter-value">${typeText} теги пользователя "${userName}"</span>
                    <button class="btn btn-secondary btn-small" onclick="clearTagsFilter()">Сбросить фильтр</button>
                </div>
            `;
            tagsContainer.insertBefore(filterHeader, tagsContainer.firstChild);
        }
        
        displayTags(filteredTags);
        
        showNotification(`Найдено тегов: ${filteredTags.length}`, 'success');
    } catch (error) {
        console.error('Ошибка загрузки тегов пользователя:', error);
        showNotification('Ошибка загрузки тегов пользователя', 'error');
    }
}

/**
 * Сбросить фильтр тегов
 */
function clearTagsFilter() {
    const tagsContainer = document.getElementById('tags-container');
    if (tagsContainer) {
        const filterHeader = tagsContainer.querySelector('.filter-header');
        if (filterHeader) {
            filterHeader.remove();
        }
    }
    
    // Загружаем все теги
    loadTags();
}

/**
 * Показать модальное окно с комментариями
 */
function showCommentsModal(userId, userName, type) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Комментарии пользователя: ${userName}</h3>
                <button class="modal-close" onclick="closeModal()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="loading">Загрузка комментариев...</div>
            </div>
        </div>
    `;
    
    // Закрытие при клике вне модального окна
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });
    
    document.body.appendChild(modal);
    
    // Загружаем комментарии
    loadUserComments(userId, type, modal.querySelector('.modal-body'));
}

/**
 * Показать модальное окно с лайками
 */
function showLikesModal(userId, userName, type) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Лайки пользователя: ${userName}</h3>
                <button class="modal-close" onclick="closeModal()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="loading">Загрузка лайков...</div>
            </div>
        </div>
    `;
    
    // Закрытие при клике вне модального окна
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });
    
    document.body.appendChild(modal);
    
    // Загружаем лайки
    loadUserLikes(userId, type, modal.querySelector('.modal-body'));
}

/**
 * Закрыть модальное окно
 */
function closeModal() {
    const modal = document.querySelector('.modal-overlay');
    if (modal) {
        modal.remove();
    }
}

/**
 * Загрузить комментарии пользователя
 */
async function loadUserComments(userId, type, container) {
    try {
        const endpoint = type === 'written' ? '/admin/comments/user' : '/admin/comments/received';
        const response = await fetch(`${endpoint}/${userId}`);
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        
        if (data.comments && data.comments.length > 0) {
            container.innerHTML = `
                <div class="comments-list">
                    ${data.comments.map(comment => `
                        <div class="comment-item">
                            <div class="comment-text">${comment.text}</div>
                            <div class="comment-meta">
                                <span>Видео: ${comment.video_description || 'ID: ' + comment.video_id}</span>
                                <span>Дата: ${new Date(comment.created_at).toLocaleString()}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        } else {
            container.innerHTML = '<div class="no-data">Комментарии не найдены</div>';
        }
    } catch (error) {
        console.error('Ошибка загрузки комментариев:', error);
        container.innerHTML = '<div class="error">Ошибка загрузки комментариев</div>';
    }
}

/**
 * Загрузить лайки пользователя
 */
async function loadUserLikes(userId, type, container) {
    try {
        const endpoint = type === 'given' ? '/admin/likes/given' : '/admin/likes/received';
        const response = await fetch(`${endpoint}/${userId}`);
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        
        console.log('📊 Получены данные лайков:', data);
        if (data.likes && data.likes.length > 0) {
            console.log('👤 Первый лайк:', data.likes[0]);
        }
        
        if (data.likes && data.likes.length > 0) {
            container.innerHTML = `
                <div class="likes-list">
                    ${data.likes.map(like => `
                        <div class="like-item">
                            ${type === 'given' ? `
                                <div class="like-video">Видео: ${like.video_description || 'ID: ' + like.video_id}</div>
                                <div class="like-meta">
                                    <span>Дата: ${new Date(like.created_at).toLocaleString()}</span>
                                </div>
                            ` : `
                                <div class="like-header">
                                    <div class="like-user">
                                        ${like.user_avatar ? 
                                            `<img src="${like.user_avatar}" alt="${like.user_name}" class="user-avatar-small">` : 
                                            `<div class="user-avatar-placeholder">${(like.user_name || 'U').charAt(0).toUpperCase()}</div>`
                                        }
                                        <span class="user-name">${like.user_name || 'Неизвестный пользователь'}</span>
                                    </div>
                                    <div class="like-date">${new Date(like.created_at).toLocaleString()}</div>
                                </div>
                                <div class="like-video">Видео: ${like.video_description || 'ID: ' + like.video_id}</div>
                            `}
                        </div>
                    `).join('')}
                </div>
            `;
        } else {
            container.innerHTML = '<div class="no-data">Лайки не найдены</div>';
        }
    } catch (error) {
        console.error('Ошибка загрузки лайков:', error);
        container.innerHTML = '<div class="error">Ошибка загрузки лайков</div>';
    }
}

/**
 * Загрузка пользователей
 */
async function loadUsers() {
    try {
        showNotification('Загрузка пользователей...', 'info');
        
        console.log('🔄 Загружаем пользователей...');
        const response = await fetch('/admin/users');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        console.log('📊 Получены данные пользователей:', data);
        
        if (data.users && data.users.length > 0) {
            console.log('👤 Первый пользователь:', data.users[0]);
            console.log('📈 Статистика первого пользователя:', {
                videosCount: data.users[0].videosCount,
                commentsWritten: data.users[0].commentsWritten,
                likesGiven: data.users[0].likesGiven,
                tagsCreated: data.users[0].tagsCreated
            });
        }
        
        displayUsers(data.users);
        
        showNotification('Пользователи загружены', 'success');
    } catch (error) {
        console.error('❌ Ошибка загрузки пользователей:', error);
        showNotification('Ошибка загрузки пользователей', 'error');
    }
}

/**
 * Отображение пользователей
 */
function displayUsers(users) {
    const container = document.getElementById('users-container');
    
    console.log('🎨 Отображаем пользователей:', users?.length || 0);
    
    if (!users || users.length === 0) {
        container.innerHTML = '<div class="no-data">Пользователи не найдены</div>';
        return;
    }
    
    if (users.length > 0) {
        console.log('👤 Данные первого пользователя для отображения:', {
            id: users[0].id,
            display_name: users[0].display_name,
            videosCount: users[0].videosCount,
            commentsWritten: users[0].commentsWritten,
            likesGiven: users[0].likesGiven,
            tagsCreated: users[0].tagsCreated
        });
    }
    
    container.innerHTML = `
        <div class="users-table-container">
        <table class="users-table">
            <thead>
                <tr>
                        <th title="Аватар пользователя">Аватар</th>
                        <th title="Имя пользователя">Логин</th>
                        <th title="Уникальный идентификатор">ID</th>
                        <th title="Количество загруженных видео">Видео</th>
                        <th title="Дата регистрации">Дата</th>
                        <th title="Комментарии созданные пользователем">Комм. созд.</th>
                        <th title="Комментарии полученные к видео пользователя">Комм. пол.</th>
                        <th title="Лайки созданные пользователем">Лайки созд.</th>
                        <th title="Лайки полученные за видео пользователя">Лайки пол.</th>
                        <th title="Теги созданные пользователем">Теги созд.</th>
                        <th title="Теги использованные в видео пользователя">Теги исп.</th>
                        <th title="Действия с пользователем">Действия</th>
                </tr>
            </thead>
            <tbody>
                ${users.map(user => `
                    <tr id="user-row-${user.id}">
                        <td class="user-avatar-cell">
                            <div class="user-avatar">
                                ${user.avatar_url ? `<img src="${user.avatar_url}" alt="Avatar">` : '👤'}
                            </div>
                        </td>
                        <td>
                            <div class="user-name">${user.display_name || 'Без имени'}</div>
                            <div class="user-id">Yandex: ${user.yandex_id}</div>
                        </td>
                        <td>
                            <div class="user-id">${user.id}</div>
                        </td>
                            <td class="user-stats ${(user.videosCount || 0) === 0 ? 'disabled' : ''}" ${(user.videosCount || 0) === 0 ? `onclick="handleDisabledClick('У пользователя ${user.display_name || 'Пользователь'} нет видео для отображения')"` : `onclick="navigateToUserVideos('${user.id}', '${user.display_name || 'Пользователь'}')"`} title="${(user.videosCount || 0) === 0 ? 'Нет видео для отображения' : 'Показать видео пользователя'}">${user.videosCount || 0}</td>
                        <td class="user-date">${new Date(user.created_at).toLocaleDateString()}</td>
                            <td class="user-stats user-stats-comments-written ${(user.commentsWritten || 0) === 0 ? 'disabled' : ''}" ${(user.commentsWritten || 0) === 0 ? `onclick="handleDisabledClick('У пользователя ${user.display_name || 'Пользователь'} нет написанных комментариев')"` : `onclick="navigateToUserComments('${user.id}', '${user.display_name || 'Пользователь'}', 'written')"`} title="${(user.commentsWritten || 0) === 0 ? 'Нет написанных комментариев' : 'Показать написанные комментарии'}">${user.commentsWritten || 0}</td>
                            <td class="user-stats user-stats-comments-received ${(user.commentsReceived || 0) === 0 ? 'disabled' : ''}" ${(user.commentsReceived || 0) === 0 ? `onclick="handleDisabledClick('У пользователя ${user.display_name || 'Пользователь'} нет полученных комментариев')"` : `onclick="navigateToUserComments('${user.id}', '${user.display_name || 'Пользователь'}', 'received')"`} title="${(user.commentsReceived || 0) === 0 ? 'Нет полученных комментариев' : 'Показать полученные комментарии'}">${user.commentsReceived || 0}</td>
                            <td class="user-stats user-stats-likes-given ${(user.likesGiven || 0) === 0 ? 'disabled' : ''}" ${(user.likesGiven || 0) === 0 ? `onclick="handleDisabledClick('У пользователя ${user.display_name || 'Пользователь'} нет поставленных лайков')"` : `onclick="navigateToUserLikes('${user.id}', '${user.display_name || 'Пользователь'}', 'given')"`} title="${(user.likesGiven || 0) === 0 ? 'Нет поставленных лайков' : 'Показать поставленные лайки'}">${user.likesGiven || 0}</td>
                            <td class="user-stats user-stats-likes-received ${(user.likesReceived || 0) === 0 ? 'disabled' : ''}" ${(user.likesReceived || 0) === 0 ? `onclick="handleDisabledClick('У пользователя ${user.display_name || 'Пользователь'} нет полученных лайков')"` : `onclick="navigateToUserLikes('${user.id}', '${user.display_name || 'Пользователь'}', 'received')"`} title="${(user.likesReceived || 0) === 0 ? 'Нет полученных лайков' : 'Показать полученные лайки'}">${user.likesReceived || 0}</td>
                            <td class="user-stats user-stats-tags-created ${(user.tagsCreated || 0) === 0 ? 'disabled' : ''}" ${(user.tagsCreated || 0) === 0 ? `onclick="handleDisabledClick('У пользователя ${user.display_name || 'Пользователь'} нет созданных тегов')"` : `onclick="navigateToUserTags('${user.id}', '${user.display_name || 'Пользователь'}', 'created')"`} title="${(user.tagsCreated || 0) === 0 ? 'Нет созданных тегов' : 'Показать созданные теги'}">${user.tagsCreated || 0}</td>
                            <td class="user-stats user-stats-tags-used ${(user.tagsUsed || 0) === 0 ? 'disabled' : ''}" ${(user.tagsUsed || 0) === 0 ? `onclick="handleDisabledClick('У пользователя ${user.display_name || 'Пользователь'} нет использованных тегов')"` : `onclick="navigateToUserTags('${user.id}', '${user.display_name || 'Пользователь'}', 'used')"`} title="${(user.tagsUsed || 0) === 0 ? 'Нет использованных тегов' : 'Показать использованные теги'}">${user.tagsUsed || 0}</td>
                        <td class="user-actions-cell">
                            <button class="btn btn-danger btn-small" onclick="deleteUser('${user.id}', '${user.display_name}')">
                                🗑️
                            </button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        </div>
    `;
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
        
        const params = new URLSearchParams({
            query: '',
            minViews: '',
            minLikes: '',
            sortBy: 'created_at',
            order: 'desc',
            limit: ITEMS_PER_PAGE,
            offset: 0
        });
        
        const response = await fetch(`/admin/videos/admin/search?${params}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        displayVideos(data.data);
        
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
    
    container.innerHTML = `
        <table class="videos-table">
            <thead>
                <tr>
                    <th></th>
                    <th>Описание</th>
                    <th>Автор</th>
                    <th>Просмотры</th>
                    <th>Лайки</th>
                    <th>Комментарии</th>
                    <th>Дата</th>
                    <th>Координаты</th>
                    <th>Теги</th>
                    <th>Действия</th>
                </tr>
            </thead>
            <tbody>
                ${videos.map(video => `
                    <tr id="video-row-${video.id}">
                        <td class="video-checkbox-cell">
                            <input type="checkbox" value="${video.id}" onchange="toggleVideoSelection('${video.id}')">
                        </td>
                        <td>
                            <div class="video-description">${video.description || 'Без описания'}</div>
                        </td>
                        <td>
                            <div class="video-author clickable" onclick="navigateToUserProfile('${video.users?.id || ''}', '${video.users?.display_name || 'Неизвестно'}')" title="Перейти к профилю пользователя">
                                ${video.users?.display_name || 'Неизвестно'}
                            </div>
                        </td>
                        <td class="video-stats video-views ${(video.views_count || 0) === 0 ? 'disabled' : ''}" ${(video.views_count || 0) === 0 ? `onclick="handleDisabledClick('У видео нет просмотров для отображения')"` : `onclick="showVideoViews('${video.id}', '${video.description || 'Без описания'}')"`} title="${(video.views_count || 0) === 0 ? 'Нет просмотров для отображения' : 'Показать просмотры видео'}">${video.views_count || 0}</td>
                        <td class="video-stats video-likes ${(video.likes_count || 0) === 0 ? 'disabled' : ''}" ${(video.likes_count || 0) === 0 ? `onclick="handleDisabledClick('У видео нет лайков для отображения')"` : `onclick="showVideoLikes('${video.id}', '${video.description || 'Без описания'}')"`} title="${(video.likes_count || 0) === 0 ? 'Нет лайков для отображения' : 'Показать лайки видео'}">${video.likes_count || 0}</td>
                        <td class="video-stats video-comments ${(video.comments_count || 0) === 0 ? 'disabled' : ''}" ${(video.comments_count || 0) === 0 ? `onclick="handleDisabledClick('У видео нет комментариев для отображения')"` : `onclick="showVideoComments('${video.id}', '${video.description || 'Без описания'}')"`} title="${(video.comments_count || 0) === 0 ? 'Нет комментариев для отображения' : 'Показать комментарии видео'}">${video.comments_count || 0}</td>
                        <td class="video-date">${new Date(video.created_at).toLocaleDateString()}</td>
                        <td class="video-coords">
                            ${video.latitude && video.longitude ? 
                                `${video.latitude.toFixed(4)}, ${video.longitude.toFixed(4)}` : 
                                'Не указаны'
                            }
                        </td>
                        <td class="video-tags-cell" onclick="openTagsModal('${video.id}', '${video.description || 'Без описания'}', '${video.users?.display_name || 'Неизвестно'}')">
                            <div class="video-tags" id="video-tags-${video.id}" >
                                <div class="loading-tags">Загрузка...</div>
                            </div>
                        </td>
                        <td class="video-actions-cell">
                            <button class="btn btn-danger btn-small" onclick="deleteVideo('${video.id}')">
                                🗑️
                            </button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    
    // Загружаем теги для каждого видео
    videos.forEach(video => {
        loadVideoTags(video.id);
    });
}

/**
 * Загрузка тегов для конкретного видео
 */
async function loadVideoTags(videoId) {
    try {
        const response = await fetch(`/admin/videos/${videoId}/tags`, { credentials: 'include' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        const tags = data.tags || [];
        
        const tagsContainer = document.getElementById(`video-tags-${videoId}`);
        if (tagsContainer) {
            if (tags.length === 0) {
                tagsContainer.innerHTML = '<span class="no-tags">Нет тегов</span>';
            } else {
                tagsContainer.innerHTML = tags.map(tag => 
                    `<span class="video-tag" title="Создатель: ${tag.creator_name || 'Неизвестно'}, Присвоил: ${tag.assigned_by_name || 'Система'}">${tag.name}</span>`
                ).join('');
            }
        }
    } catch (error) {
        console.error(`Ошибка загрузки тегов для видео ${videoId}:`, error);
        const tagsContainer = document.getElementById(`video-tags-${videoId}`);
        if (tagsContainer) {
            tagsContainer.innerHTML = '<span class="error-tags">Ошибка</span>';
        }
    }
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
        
        const response = await fetch(`/admin/videos/${videoId}`, { method: 'DELETE' });
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
    
    // Обновляем визуальное выделение
    const videoRow = document.getElementById(`video-row-${videoId}`);
    if (videoRow) {
        videoRow.classList.toggle('selected', selectedVideoIds.includes(videoId));
    }
    
    // Обновляем кнопку массового удаления
    const bulkDeleteBtn = document.getElementById('bulk-delete-videos-btn');
    if (bulkDeleteBtn) {
        bulkDeleteBtn.disabled = selectedVideoIds.length === 0;
    }
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
        
        const response = await fetch('/admin/videos/bulk', {
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

// Глобальные переменные для тегов
let selectedTagIds = [];

/**
 * Переключение выбора тега
 */
function toggleTagSelection(tagId) {
    const index = selectedTagIds.indexOf(tagId);
    if (index > -1) {
        selectedTagIds.splice(index, 1);
    } else {
        selectedTagIds.push(tagId);
    }
    
    // Обновляем визуальное выделение
    const tagRow = document.getElementById(`tag-row-${tagId}`);
    if (tagRow) {
        tagRow.classList.toggle('selected', selectedTagIds.includes(tagId));
    }
    
    // Обновляем кнопку массового удаления
    const bulkDeleteBtn = document.getElementById('bulk-delete-tags-btn');
    if (bulkDeleteBtn) {
        bulkDeleteBtn.disabled = selectedTagIds.length === 0;
    }
}

/**
 * Массовое удаление тегов
 */
async function bulkDeleteTags() {
    if (selectedTagIds.length === 0) {
        showNotification('Выберите теги для удаления', 'warning');
        return;
    }
    
    if (!confirm(`Вы уверены, что хотите удалить ${selectedTagIds.length} тегов?\n\nЭто действие нельзя отменить!`)) {
        return;
    }
    
    try {
        showNotification('Удаление тегов...', 'info');
        
        const response = await fetch('/admin/tags/bulk', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ tagIds: selectedTagIds })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            showNotification(`✅ Успешно удалено ${result.deletedCount} тегов`, 'success');
            selectedTagIds = [];
            await loadTags(); // Перезагружаем список тегов
        } else {
            throw new Error(result.error || 'Неизвестная ошибка');
        }
        
    } catch (error) {
        console.error('Ошибка массового удаления тегов:', error);
        showNotification(`❌ Ошибка массового удаления тегов: ${error.message}`, 'error');
    }
}

/**
 * Сброс выбора всех тегов
 */
function clearTagSelection() {
    selectedTagIds = [];
    
    // Снимаем визуальное выделение со всех строк
    const selectedRows = document.querySelectorAll('.tags-table tbody tr.selected');
    selectedRows.forEach(row => row.classList.remove('selected'));
    
    // Снимаем галочки со всех чекбоксов
    const checkboxes = document.querySelectorAll('.tags-table tbody input[type="checkbox"]');
    checkboxes.forEach(checkbox => checkbox.checked = false);
    
    // Обновляем кнопку массового удаления
    const bulkDeleteBtn = document.getElementById('bulk-delete-tags-btn');
    if (bulkDeleteBtn) {
        bulkDeleteBtn.disabled = true;
    }
    
    showNotification('Выбор тегов сброшен', 'info');
}

/**
 * Выбор всех тегов
 */
function selectAllTags() {
    const checkboxes = document.querySelectorAll('.tags-table tbody input[type="checkbox"]');
    const allTagIds = Array.from(checkboxes).map(checkbox => checkbox.value);
    
    selectedTagIds = [...allTagIds];
    
    // Ставим галочки на все чекбоксы
    checkboxes.forEach(checkbox => checkbox.checked = true);
    
    // Добавляем визуальное выделение ко всем строкам
    const rows = document.querySelectorAll('.tags-table tbody tr');
    rows.forEach(row => row.classList.add('selected'));
    
    // Обновляем кнопку массового удаления
    const bulkDeleteBtn = document.getElementById('bulk-delete-tags-btn');
    if (bulkDeleteBtn) {
        bulkDeleteBtn.disabled = false;
    }
    
    showNotification(`Выбрано ${selectedTagIds.length} тегов`, 'info');
}

/**
 * Переключение выбора всех тегов
 */
function toggleAllTags(headerCheckbox) {
    const checkboxes = document.querySelectorAll('.tags-table tbody input[type="checkbox"]');
    const isChecked = headerCheckbox.checked;
    
    if (isChecked) {
        // Выбираем все теги
        selectedTagIds = Array.from(checkboxes).map(checkbox => checkbox.value);
        checkboxes.forEach(checkbox => checkbox.checked = true);
        
        // Добавляем визуальное выделение ко всем строкам
        const rows = document.querySelectorAll('.tags-table tbody tr');
        rows.forEach(row => row.classList.add('selected'));
        
        showNotification(`Выбрано ${selectedTagIds.length} тегов`, 'info');
    } else {
        // Снимаем выбор со всех тегов
        selectedTagIds = [];
        checkboxes.forEach(checkbox => checkbox.checked = false);
        
        // Убираем визуальное выделение со всех строк
        const rows = document.querySelectorAll('.tags-table tbody tr');
        rows.forEach(row => row.classList.remove('selected'));
        
        showNotification('Выбор тегов сброшен', 'info');
    }
    
    // Обновляем кнопку массового удаления
    const bulkDeleteBtn = document.getElementById('bulk-delete-tags-btn');
    if (bulkDeleteBtn) {
        bulkDeleteBtn.disabled = selectedTagIds.length === 0;
    }
}

/**
 * Загрузка тегов
 */
async function loadTags() {
    try {
        showNotification('Загрузка тегов...', 'info');
        
        const response = await fetch('/admin/tags', { credentials: 'include' });
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
    
    container.innerHTML = `
        <table class="tags-table">
            <thead>
                <tr>
                    <th></th>
                    <th>Название</th>
                    <th>Использований</th>
                    <th>Создатель</th>
                    <th>Дата создания</th>
                    <th>Действия</th>
                </tr>
            </thead>
            <tbody>
                ${tags.map(tag => `
                    <tr id="tag-row-${tag.id}">
                        <td class="tag-checkbox-cell">
                            <input type="checkbox" value="${tag.id}" onchange="toggleTagSelection('${tag.id}')">
                        </td>
                        <td>
                            <div class="tag-name">${tag.name}</div>
                        </td>
                        <td class="tag-usage">${tag.usage_count || 0}</td>
                        <td>
                            <div class="tag-creator">${tag.creator_name || 'Неизвестно'}</div>
                        </td>
                        <td class="tag-date">${new Date(tag.created_at).toLocaleDateString()}</td>
                        <td class="tag-actions-cell">
                            <button class="btn btn-danger btn-small" onclick="deleteTag('${tag.id}', '${tag.name}')">
                                🗑️
                            </button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

/**
 * Создание тега
 */
async function createTag() {
    const nameInput = document.getElementById('new-tag-name');
    const tagForm = document.querySelector('.tag-form');
    const name = nameInput.value.trim();
    
    if (!name) {
        showNotification('Введите название тега', 'warning');
        nameInput.focus();
        return;
    }
    
    if (name.length > 50) {
        showNotification('Название тега не должно превышать 50 символов', 'warning');
        nameInput.focus();
        return;
    }
    
    // Проверяем, не существует ли уже такой тег
    const normalizedName = name.toLowerCase().trim();
    const existingTag = allTags.find(tag => tag.name.toLowerCase() === normalizedName);
    if (existingTag) {
        showNotification('Тег с таким названием уже существует', 'warning');
        nameInput.focus();
        return;
    }
    
    try {
        showNotification('Создание тега...', 'info');
        
        const response = await fetch('/admin/tags', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ name })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }
        
        const result = await response.json();
        
        // Анимация успеха
        if (tagForm) {
            tagForm.classList.add('success');
            setTimeout(() => tagForm.classList.remove('success'), 600);
        }
        
        showNotification(`✅ Тег "${result.tag?.name || name}" успешно создан`, 'success');
        
        // Очищаем поле и перезагружаем
        nameInput.value = '';
        await loadTags();
        
    } catch (error) {
        console.error('Ошибка создания тега:', error);
        showNotification(`❌ Ошибка создания тега: ${error.message}`, 'error');
    }
}

/**
 * Создание быстрого тега
 */
async function createQuickTag(tagName) {
    const nameInput = document.getElementById('new-tag-name');
    nameInput.value = tagName;
    await createTag();
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
        
        const response = await fetch(`/admin/tags/${tagId}`, { method: 'DELETE', credentials: 'include' });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }
        
        const result = await response.json();
        showNotification(`✅ Тег "${tagName}" успешно удален`, 'success');
        
        // Перезагружаем список
        await loadTags();
    } catch (error) {
        console.error('Ошибка удаления тега:', error);
        showNotification(`❌ Ошибка удаления тега: ${error.message}`, 'error');
    }
}

// ==================== МОДАЛЬНОЕ ОКНО ТЕГОВ ====================

let currentVideoId = null;
let currentVideoInfo = null;
let availableTags = [];
let selectedTagsForVideo = [];

/**
 * Открытие модального окна для добавления тегов к видео
 */
async function openTagsModal(videoId, videoDescription, videoAuthor) {
    currentVideoId = videoId;
    currentVideoInfo = {
        description: videoDescription,
        author: videoAuthor
    };
    
    try {
        // Загружаем все доступные теги
        const tagsResponse = await fetch('/admin/tags', { credentials: 'include' });
        if (!tagsResponse.ok) throw new Error(`HTTP ${tagsResponse.status}`);
        const tagsData = await tagsResponse.json();
        availableTags = tagsData.tags || [];
        
        // Загружаем текущие теги видео
        const videoTagsResponse = await fetch(`/admin/videos/${videoId}/tags`, { credentials: 'include' });
        if (!videoTagsResponse.ok) throw new Error(`HTTP ${videoTagsResponse.status}`);
        const videoTagsData = await videoTagsResponse.json();
        selectedTagsForVideo = videoTagsData.tags || [];
        
        // Создаем и показываем модальное окно
        createTagsModal();
        showTagsModal();
        
    } catch (error) {
        console.error('Ошибка загрузки тегов:', error);
        showNotification('Ошибка загрузки тегов', 'error');
    }
}

/**
 * Создание HTML модального окна
 */
function createTagsModal() {
    const modalHtml = `
        <div class="tags-modal" id="tags-modal">
            <div class="tags-modal-content">
                <div class="tags-modal-header">
                    <h3 class="tags-modal-title">🏷️ Управление тегами видео</h3>
                    <button class="tags-modal-close" onclick="closeTagsModal()">×</button>
                </div>
                
                <div class="tags-modal-body">
                    <div class="video-info">
                        <h4>${currentVideoInfo.description}</h4>
                        <p>Автор: ${currentVideoInfo.author}</p>                
                    </div>
                    
                    <div class="tags-search">
                        <input type="text" id="tags-search-input" placeholder="Поиск тегов..." onkeyup="filterTags()">
                    </div>
                    
                    <div class="tags-list" id="tags-list">
                        ${renderTagsList()}
                    </div>
                </div>
                
                <div class="tags-modal-footer">
                    <button class="btn btn-secondary" onclick="closeTagsModal()">Отмена</button>
                    <button class="btn btn-tags" onclick="saveVideoTags()">Сохранить теги</button>
                </div>
            </div>
        </div>
    `;
    
    // Удаляем существующее модальное окно если есть
    const existingModal = document.getElementById('tags-modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Добавляем новое модальное окно
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Добавляем обработчик для закрытия по клику вне модального окна
    const modal = document.getElementById('tags-modal');
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeTagsModal();
        }
    });
}

/**
 * Рендеринг списка тегов
 */
function renderTagsList() {
    const searchTerm = document.getElementById('tags-search-input')?.value.toLowerCase() || '';
    const filteredTags = availableTags.filter(tag => 
        tag.name.toLowerCase().includes(searchTerm)
    );
    
    return filteredTags.map(tag => {
        const isSelected = selectedTagsForVideo.some(selectedTag => selectedTag.id === tag.id);
        const selectedTagInfo = selectedTagsForVideo.find(selectedTag => selectedTag.id === tag.id);
        
        return `
            <div class="tag-item ${isSelected ? 'selected' : ''}" data-tag-id="${tag.id}">
                <div class="tag-item-info">
                    <div class="tag-item-name">${tag.name}</div>
                    <div class="tag-item-usage">Использований: ${tag.usage_count || 0}</div>
                    <div class="tag-item-creator">
                        <strong>Создатель:</strong> ${tag.creator_name || 'Неизвестно'}
                    </div>
                    ${isSelected && selectedTagInfo?.assigned_by_name ? `
                        <div class="tag-item-assigned">
                            <strong>Присвоил:</strong> ${selectedTagInfo.assigned_by_name}
                        </div>
                    ` : ''}
                </div>
                <input type="checkbox" class="tag-item-checkbox" ${isSelected ? 'checked' : ''} 
                       onchange="toggleTagSelection('${tag.id}')">
            </div>
        `;
    }).join('');
}

/**
 * Фильтрация тегов по поиску
 */
function filterTags() {
    const tagsList = document.getElementById('tags-list');
    if (tagsList) {
        tagsList.innerHTML = renderTagsList();
    }
}

/**
 * Переключение выбора тега
 */
function toggleTagSelection(tagId) {
    const tagIndex = selectedTagsForVideo.findIndex(tag => tag.id === tagId);
    const tag = availableTags.find(t => t.id === tagId);
    
    if (tagIndex > -1) {
        // Убираем тег
        selectedTagsForVideo.splice(tagIndex, 1);
    } else {
        // Добавляем тег
        selectedTagsForVideo.push(tag);
    }
    
    // Обновляем визуальное выделение
    const tagItem = document.querySelector(`[data-tag-id="${tagId}"]`);
    if (tagItem) {
        tagItem.classList.toggle('selected', selectedTagsForVideo.some(t => t.id === tagId));
    }
}

/**
 * Показать модальное окно
 */
function showTagsModal() {
    const modal = document.getElementById('tags-modal');
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

/**
 * Закрыть модальное окно
 */
function closeTagsModal() {
    const modal = document.getElementById('tags-modal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
        
        // Удаляем модальное окно через некоторое время
        setTimeout(() => {
            modal.remove();
        }, 300);
    }
}

/**
 * Сохранение тегов для видео
 */
async function saveVideoTags() {
    if (!currentVideoId) return;
    
    try {
        showNotification('Сохранение тегов...', 'info');
        
        const response = await fetch(`/admin/videos/${currentVideoId}/tags`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                tagIds: selectedTagsForVideo.map(tag => tag.id)
            })
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const result = await response.json();
        
        if (result.success) {
            showNotification(`Теги сохранены для видео`, 'success');
            closeTagsModal();
        } else {
            throw new Error(result.error || 'Неизвестная ошибка');
        }
        
    } catch (error) {
        console.error('Ошибка сохранения тегов:', error);
        showNotification('Ошибка сохранения тегов', 'error');
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
        
        const response = await fetch('/admin/tags/fix-counters', { method: 'POST', credentials: 'include' });
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

// ==================== КОММЕНТАРИИ ====================

/**
 * Загрузка комментариев
 */
async function loadComments() {
    try {
        showNotification('Загрузка комментариев...', 'info');
        
        // Получаем параметры фильтрации
        const videoFilter = document.getElementById('comment-video-filter')?.value || '';
        const sortValue = document.getElementById('comment-sort')?.value || 'created_at:desc';
        const [sortBy, order] = sortValue.split(':');
        
        // Формируем URL с параметрами
        let url = '/admin/comments/admin/all?limit=100';
        if (videoFilter) {
            url += `&videoId=${videoFilter}`;
        }
        url += `&sortBy=${sortBy}&order=${order}`;
        
        const response = await fetch(url, { credentials: 'include' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        const comments = data.comments || [];
        
        displayComments(comments);
        
        // Обновляем статистику
        document.getElementById('comments-total').textContent = data.total || 0;
        
        showNotification(`Комментарии загружены`, 'success');
    } catch (error) {
        console.error('Ошибка загрузки комментариев:', error);
        showNotification('Ошибка загрузки комментариев', 'error');
        document.getElementById('comments-container').innerHTML = 
            '<div class="error">Ошибка загрузки комментариев</div>';
    }
}

/**
 * Отображение списка комментариев
 */
function displayComments(comments) {
    const container = document.getElementById('comments-container');
    
    if (!comments || comments.length === 0) {
        container.innerHTML = '<div class="empty-state">📭 Комментариев пока нет</div>';
        return;
    }
    
    container.innerHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Автор</th>
                    <th>Текст</th>
                    <th>Видео</th>
                    <th>Дата</th>
                    <th>Действия</th>
                </tr>
            </thead>
            <tbody>
                ${comments.map(comment => `
                    <tr>
                        <td class="user-cell">
                            <div class="user-info">
                                ${comment.users?.avatar_url 
                                    ? `<img src="${comment.users.avatar_url}" alt="Avatar" class="user-avatar">` 
                                    : '<div class="user-avatar-placeholder">👤</div>'}
                                <span>${comment.users?.display_name || 'Неизвестно'}</span>
                            </div>
                        </td>
                        <td class="comment-text-cell">
                            <div class="comment-text">${escapeHtml(comment.text)}</div>
                        </td>
                        <td class="video-desc-cell">
                            <div class="video-desc-short">${escapeHtml(comment.videos?.description || 'Без описания')}</div>
                        </td>
                        <td class="date-cell">
                            ${formatDate(comment.created_at)}
                        </td>
                        <td class="actions-cell">
                            <button class="btn btn-danger btn-small" onclick="deleteComment('${comment.id}', '${escapeHtml(comment.text.substring(0, 30))}...')">
                                🗑️
                            </button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

/**
 * Удаление комментария
 */
async function deleteComment(commentId, commentPreview) {
    if (!confirm(`Удалить комментарий?\n\n"${commentPreview}"`)) {
        return;
    }
    
    try {
        showNotification('Удаление комментария...', 'info');
        
        const response = await fetch(`/admin/comments/admin/${commentId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        showNotification('Комментарий удален', 'success');
        loadComments(); // Перезагружаем список
    } catch (error) {
        console.error('Ошибка удаления комментария:', error);
        showNotification('Ошибка удаления комментария', 'error');
    }
}

/**
 * Экранирование HTML
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Форматирование даты
 */
function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'только что';
    if (diffMins < 60) return `${diffMins} мин назад`;
    if (diffHours < 24) return `${diffHours} ч назад`;
    if (diffDays < 7) return `${diffDays} д назад`;

    return date.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'short',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
}

// ==================== УТИЛИТЫ ====================

/**
 * Показать уведомление
 */
function showNotification(message, type = 'info') {
    // Создаем контейнер для уведомлений, если его нет
    let container = document.getElementById('notifications-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notifications-container';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 1000;
            display: flex;
            flex-direction: column;
            gap: 10px;
            max-width: 400px;
        `;
        document.body.appendChild(container);
    }
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Добавляем уведомление в контейнер
    container.appendChild(notification);
    
    // Анимация появления
    setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateX(0)';
    }, 10);
    
    // Удаляем уведомление через 3 секунды
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
            
            // Если контейнер пустой, удаляем его
            if (container && container.children.length === 0) {
                container.remove();
            }
        }, 300);
    }, 3000);
}

// ==================== МОДАЛЬНЫЕ ОКНА ДЛЯ ВИДЕО ====================

/**
 * Показать просмотры видео
 */
async function showVideoViews(videoId, videoDescription) {
    try {
        showNotification('Загрузка информации о просмотрах...', 'info');
        
        const response = await fetch(`/admin/videos/${videoId}/views`, { credentials: 'include' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        const views = data.views || [];
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>👁️ Просмотры видео: ${videoDescription}</h3>
                    <button class="modal-close" onclick="closeModal()">&times;</button>
                </div>
                <div class="modal-body">
                    ${views.length > 0 && views[0].viewers ? `
                        <div class="views-summary">
                            <div class="views-total">
                                <span class="total-count">${views[0].total_views}</span>
                                <span class="total-label">всего просмотров</span>
                            </div>
                        </div>
                        <div class="viewers-list">
                            <h4>👥 Пользователи, просмотревшие видео:</h4>
                            ${views[0].viewers.length > 0 ? `
                                <div class="viewers-grid">
                                    ${views[0].viewers.map(viewer => `
                                        <div class="viewer-item">
                                            <div class="viewer-avatar">
                                                ${viewer.user.avatar_url ? 
                                                    `<img src="${viewer.user.avatar_url}" alt="${viewer.user.display_name}" class="user-avatar-small">` : 
                                                    `<div class="user-avatar-placeholder">${(viewer.user.display_name || 'U').charAt(0).toUpperCase()}</div>`
                                                }
                                            </div>
                                            <div class="viewer-info">
                                                <div class="viewer-name">${viewer.user.display_name}</div>
                                                <div class="viewer-date">${formatDate(viewer.viewed_at)}</div>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            ` : '<div class="no-data">Нет данных о просмотрах</div>'}
                        </div>
                    ` : '<div class="no-data">Информация о просмотрах недоступна</div>'}
                </div>
            </div>
        `;
        
        // Закрытие при клике вне модального окна
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
        
        document.body.appendChild(modal);
        showNotification(`Загружена информация о ${views[0]?.total_views || 0} просмотрах от ${views[0]?.viewers?.length || 0} пользователей`, 'success');
        
    } catch (error) {
        console.error('Ошибка загрузки просмотров:', error);
        showNotification('Ошибка загрузки просмотров', 'error');
    }
}

/**
 * Показать комментарии видео
 */
async function showVideoComments(videoId, videoDescription) {
    try {
        showNotification('Загрузка комментариев...', 'info');
        
        const response = await fetch(`/admin/videos/${videoId}/comments`, { credentials: 'include' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        const comments = data.comments || [];
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>💬 Комментарии к видео: ${videoDescription}</h3>
                    <button class="modal-close" onclick="closeModal()">&times;</button>
                </div>
                <div class="modal-body">
                    ${comments.length > 0 ? `
                        <div class="comments-list">
                            ${comments.map(comment => `
                                <div class="comment-item">
                                    <div class="comment-header">
                                        <div class="comment-user">
                                            ${comment.users?.avatar_url ? 
                                                `<img src="${comment.users.avatar_url}" alt="${comment.users.display_name}" class="user-avatar-small">` : 
                                                `<div class="user-avatar-placeholder">${(comment.users?.display_name || 'U').charAt(0).toUpperCase()}</div>`
                                            }
                                            <span class="user-name">${comment.users?.display_name || 'Неизвестный пользователь'}</span>
                                        </div>
                                        <div class="comment-date">${new Date(comment.created_at).toLocaleString()}</div>
                                    </div>
                                    <div class="comment-text">${escapeHtml(comment.text)}</div>
                                </div>
                            `).join('')}
                        </div>
                    ` : '<div class="no-data">Комментариев пока нет</div>'}
                </div>
            </div>
        `;
        
        // Закрытие при клике вне модального окна
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
        
        document.body.appendChild(modal);
        showNotification(`Загружено ${comments.length} комментариев`, 'success');
        
    } catch (error) {
        console.error('Ошибка загрузки комментариев:', error);
        showNotification('Ошибка загрузки комментариев', 'error');
    }
}

/**
 * Показать лайки видео
 */
async function showVideoLikes(videoId, videoDescription) {
    try {
        showNotification('Загрузка лайков...', 'info');
        
        const response = await fetch(`/admin/videos/${videoId}/likes`, { credentials: 'include' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        const likes = data.likes || [];
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>❤️ Лайки к видео: ${videoDescription}</h3>
                    <button class="modal-close" onclick="closeModal()">&times;</button>
                </div>
                <div class="modal-body">
                    ${likes.length > 0 ? `
                        <div class="likes-list">
                            ${likes.map(like => `
                                <div class="like-item">
                                    <div class="like-header">
                                        <div class="like-user">
                                            ${like.users?.avatar_url ? 
                                                `<img src="${like.users.avatar_url}" alt="${like.users.display_name}" class="user-avatar-small">` : 
                                                `<div class="user-avatar-placeholder">${(like.users?.display_name || 'U').charAt(0).toUpperCase()}</div>`
                                            }
                                            <span class="user-name">${like.users?.display_name || 'Неизвестный пользователь'}</span>
                                        </div>
                                        <div class="like-date">${new Date(like.created_at).toLocaleString()}</div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    ` : '<div class="no-data">Лайков пока нет</div>'}
                </div>
            </div>
        `;
        
        // Закрытие при клике вне модального окна
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
        
        document.body.appendChild(modal);
        showNotification(`Загружено ${likes.length} лайков`, 'success');
        
    } catch (error) {
        console.error('Ошибка загрузки лайков:', error);
        showNotification('Ошибка загрузки лайков', 'error');
    }
}

/**
 * Инициализация админки
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('Админ-панель GeoClips инициализирована');
    
    // Загружаем пользователей по умолчанию (активная вкладка)
    loadUsers();
});

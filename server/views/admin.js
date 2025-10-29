// ===== GLOBAL STATE =====
const state = {
    currentView: 'dashboard',
    sidebarCollapsed: false,
    users: [],
    videos: [],
    tags: [],
    comments: [],
    dashboardStats: null,
    charts: {}
};

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    console.log('🚀 Initializing Admin Panel v2.0...');
    
    // Setup event listeners
    setupEventListeners();
    
    // Update time
    updateTime();
    setInterval(updateTime, 1000);
    
    // Load initial data
    await loadDashboard();
    
    console.log('✅ Admin Panel initialized');
}

function setupEventListeners() {
    // Sidebar toggle
    const sidebarToggle = document.getElementById('sidebarToggle');
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', toggleSidebar);
    }
    
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', toggleMobileSidebar);
    }
    
    // Close sidebar on mobile when clicking outside
    document.addEventListener('click', (e) => {
        const sidebar = document.querySelector('.sidebar');
        const mobileBtn = document.getElementById('mobileMenuBtn');
        if (window.innerWidth <= 1024 && sidebar && !sidebar.contains(e.target) && !mobileBtn.contains(e.target)) {
            sidebar.classList.remove('active');
        }
    });
}

// ===== SIDEBAR =====
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    sidebar.classList.toggle('collapsed');
    state.sidebarCollapsed = !state.sidebarCollapsed;
}

function toggleMobileSidebar() {
    const sidebar = document.querySelector('.sidebar');
    sidebar.classList.toggle('active');
}

// ===== VIEW SWITCHING =====
function switchView(viewName) {
    // Remove active class from all views and nav items
    document.querySelectorAll('.view-container').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    
    // Add active class to current view
    const viewElement = document.getElementById(`view-${viewName}`);
    if (viewElement) {
        viewElement.classList.add('active');
    }
    
    // Add active class to current nav item
    const navItem = document.querySelector(`[onclick="switchView('${viewName}')"]`);
    if (navItem) {
        navItem.classList.add('active');
    }
    
    state.currentView = viewName;
    
    // Load data for view
    switch(viewName) {
        case 'dashboard':
            loadDashboard();
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
        case 'comments':
            loadComments();
            break;
        case 'analytics':
            loadAnalytics();
            break;
    }
    
    // Close mobile sidebar
    if (window.innerWidth <= 1024) {
        document.querySelector('.sidebar').classList.remove('active');
    }
}

// ===== UTILITIES =====
function updateTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    const timeElement = document.getElementById('currentTime');
    if (timeElement) {
        timeElement.textContent = timeString;
    }
}

function showToast(message, type = 'info', title = '') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = '';
    switch(type) {
        case 'success':
            icon = '<i class="fas fa-check-circle"></i>';
            title = title || 'Успешно';
            break;
        case 'error':
            icon = '<i class="fas fa-exclamation-circle"></i>';
            title = title || 'Ошибка';
            break;
        case 'warning':
            icon = '<i class="fas fa-exclamation-triangle"></i>';
            title = title || 'Внимание';
            break;
        case 'info':
        default:
            icon = '<i class="fas fa-info-circle"></i>';
            title = title || 'Информация';
            break;
    }
    
    toast.innerHTML = `
        <div class="toast-icon">${icon}</div>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    container.appendChild(toast);
    
    // Auto remove after 5 seconds
    setTimeout(() => toast.remove(), 5000);
}

function showModal(title, content, onConfirm = null) {
    const overlay = document.getElementById('modal-overlay');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const confirmBtn = document.getElementById('modal-confirm');
    
    if (!overlay) return;
    
    modalTitle.textContent = title;
    modalBody.innerHTML = content;
    
    if (onConfirm) {
        confirmBtn.onclick = () => {
            onConfirm();
            closeModal();
        };
        confirmBtn.style.display = 'block';
    } else {
        confirmBtn.style.display = 'none';
    }
    
    overlay.classList.add('active');
}

function closeModal() {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) {
        overlay.classList.remove('active');
    }
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatRelativeTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} дн. назад`;
    if (hours > 0) return `${hours} ч. назад`;
    if (minutes > 0) return `${minutes} мин. назад`;
    return 'только что';
}

// ===== DASHBOARD =====
async function loadDashboard() {
    try {
        // Load stats
        await Promise.all([
            loadDashboardStats(),
            loadRecentActivity()
        ]);
        
        // Initialize charts (will destroy existing ones if present)
        initDashboardCharts();
        
    } catch (error) {
        console.error('Error loading dashboard:', error);
        showToast('Ошибка загрузки dashboard', 'error');
    }
}

async function loadDashboardStats() {
    try {
        // Load all data
        const [usersRes, videosRes, commentsRes] = await Promise.all([
            fetch('/admin/users'),
            fetch('/admin/videos'),
            fetch('/admin/comments')
        ]);
        
        const users = await usersRes.json();
        const videos = await videosRes.json();
        const comments = await commentsRes.json();
        
        // Calculate stats
        const stats = {
            usersTotal: users.users?.length || 0,
            videosTotal: videos.videos?.length || 0,
            commentsTotal: comments.comments?.length || 0,
            likesTotal: videos.videos?.reduce((sum, v) => sum + (v.likes_count || 0), 0) || 0
        };
        
        // Update UI
        updateElement('dash-users-total', stats.usersTotal);
        updateElement('dash-videos-total', stats.videosTotal);
        updateElement('dash-comments-total', stats.commentsTotal);
        updateElement('dash-likes-total', stats.likesTotal);
        
        // Update badges
        
        state.dashboardStats = stats;
        
    } catch (error) {
        console.error('Error loading dashboard stats:', error);
    }
}

async function loadRecentActivity() {
    try {
        const container = document.getElementById('recent-activity');
        if (!container) return;
        
        // For now, show placeholder
        container.innerHTML = `
            <div class="activity-item">
                <div class="activity-icon user">
                    <i class="fas fa-user-plus"></i>
                </div>
                <div class="activity-details">
                    <div class="activity-title">Новый пользователь зарегистрировался</div>
                    <div class="activity-time">5 минут назад</div>
                </div>
            </div>
            <div class="activity-item">
                <div class="activity-icon video">
                    <i class="fas fa-video"></i>
                </div>
                <div class="activity-details">
                    <div class="activity-title">Загружено новое видео</div>
                    <div class="activity-time">15 минут назад</div>
                </div>
            </div>
            <div class="activity-item">
                <div class="activity-icon comment">
                    <i class="fas fa-comment"></i>
                </div>
                <div class="activity-details">
                    <div class="activity-title">Добавлен комментарий</div>
                    <div class="activity-time">30 минут назад</div>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error loading recent activity:', error);
    }
}

function initDashboardCharts() {
    // Activity Chart - destroy old instance and recreate canvas
    const activityContainer = document.querySelector('.chart-container:first-of-type');
    if (activityContainer) {
        // Destroy existing chart if exists
        if (state.charts.activity) {
            state.charts.activity.destroy();
            state.charts.activity = null;
        }
        
        // Remove old canvas and create new one
        const oldCanvas = document.getElementById('activityChart');
        if (oldCanvas) {
            oldCanvas.remove();
        }
        
        // Create fresh canvas
        const newCanvas = document.createElement('canvas');
        newCanvas.id = 'activityChart';
        activityContainer.appendChild(newCanvas);
        
        state.charts.activity = new Chart(newCanvas, {
            type: 'line',
            data: {
                labels: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
                datasets: [{
                    label: 'Новые пользователи',
                    data: [12, 19, 3, 5, 2, 3, 7],
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    tension: 0.4
                }, {
                    label: 'Новые видео',
                    data: [7, 11, 5, 8, 3, 7, 4],
                    borderColor: '#8b5cf6',
                    backgroundColor: 'rgba(139, 92, 246, 0.1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: { color: '#cbd5e1' }
                    }
                },
                scales: {
                    y: {
                        ticks: { color: '#94a3b8' },
                        grid: { color: '#334155' }
                    },
                    x: {
                        ticks: { color: '#94a3b8' },
                        grid: { color: '#334155' }
                    }
                }
            }
        });
    }
    
    // Distribution Chart - destroy old instance and recreate canvas
    const distContainer = document.querySelector('.chart-container:last-of-type');
    if (distContainer) {
        // Destroy existing chart if exists
        if (state.charts.distribution) {
            state.charts.distribution.destroy();
            state.charts.distribution = null;
        }
        
        // Remove old canvas and create new one
        const oldCanvas = document.getElementById('distributionChart');
        if (oldCanvas) {
            oldCanvas.remove();
        }
        
        // Create fresh canvas
        const newCanvas = document.createElement('canvas');
        newCanvas.id = 'distributionChart';
        distContainer.appendChild(newCanvas);
        
        state.charts.distribution = new Chart(newCanvas, {
            type: 'doughnut',
            data: {
                labels: ['Видео', 'Пользователи', 'Комментарии', 'Лайки'],
                datasets: [{
                    data: [
                        state.dashboardStats?.videosTotal || 0,
                        state.dashboardStats?.usersTotal || 0,
                        state.dashboardStats?.commentsTotal || 0,
                        state.dashboardStats?.likesTotal || 0
                    ],
                    backgroundColor: ['#8b5cf6', '#3b82f6', '#10b981', '#ef4444']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: { color: '#cbd5e1' }
                    }
                }
            }
        });
    }
}

async function refreshDashboard() {
    showToast('Обновление данных...', 'info');
    await loadDashboard();
    showToast('Данные обновлены', 'success');
}

// ===== USERS =====
async function loadUsers() {
    try {
        const container = document.getElementById('users-table-body');
        if (!container) return;
        
        container.innerHTML = '<tr><td colspan="8" class="loading">Загрузка...</td></tr>';
        
        const response = await fetch('/admin/users');
        const data = await response.json();
        
        state.users = data.users || [];
        
        // Update total count
        updateElement('users-total-count', state.users.length);
        
        if (state.users.length === 0) {
            container.innerHTML = '<tr><td colspan="8" class="text-center text-muted">Нет пользователей</td></tr>';
            return;
        }
        
        container.innerHTML = state.users.map(user => `
            <tr>
                <td>
                    ${user.avatar_url 
                        ? `<img src="${user.avatar_url}" alt="${user.display_name}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">` 
                        : `<div style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #6366f1, #8b5cf6); display: flex; align-items: center; justify-content: center; color: white; font-weight: 600;">${user.display_name?.charAt(0) || '?'}</div>`
                    }
                </td>
                <td>${user.first_name || ''} ${user.last_name || ''}</td>
                <td><strong>${user.display_name || '-'}</strong></td>
                <td>${formatDate(user.created_at)}</td>
                <td><span class="badge">${user.videosCount || 0}</span></td>
                <td><span class="badge">${user.commentsWritten || 0}</span></td>
                <td><span class="badge">${user.likesGiven || 0}</span></td>
                <td>
                    <button class="icon-btn danger" onclick="deleteUser('${user.id}', '${user.display_name}')" title="Удалить">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
        
    } catch (error) {
        console.error('Error loading users:', error);
        showToast('Ошибка загрузки пользователей', 'error');
    }
}

function filterUsers() {
    // TODO: Implement filtering
    console.log('Filtering users...');
}

async function deleteUser(userId, userName) {
    showModal(
        'Удаление пользователя',
        `<p>Вы уверены, что хотите удалить пользователя <strong>${userName}</strong>?</p>
         <p class="text-muted mt-4">Это действие удалит все видео, комментарии и лайки пользователя.</p>`,
        async () => {
            try {
                const response = await fetch(`/admin/users/${userId}`, { method: 'DELETE' });
                const data = await response.json();
                
                if (data.success) {
                    showToast(`Пользователь ${userName} удален`, 'success');
                    loadUsers();
                } else {
                    showToast(data.error || 'Ошибка удаления', 'error');
                }
            } catch (error) {
                console.error('Error deleting user:', error);
                showToast('Ошибка удаления пользователя', 'error');
            }
        }
    );
}

// ===== VIDEOS =====
async function loadVideos() {
    try {
        const container = document.getElementById('videos-grid');
        if (!container) return;
        
        container.innerHTML = '<div class="loading">Загрузка...</div>';
        
        const response = await fetch('/admin/videos');
        const data = await response.json();
        
        state.videos = data.videos || [];
        
        // Update total count
        updateElement('videos-total-count', state.videos.length);
        
        if (state.videos.length === 0) {
            container.innerHTML = '<div class="text-center text-muted">Нет видео</div>';
            return;
        }
        
        container.innerHTML = state.videos.map(video => `
            <div class="video-card">
                <div class="video-thumbnail">
                    <video src="${video.video_url}" preload="metadata"></video>
                </div>
                <div class="video-info">
                    <div class="video-description">${video.description || 'Без описания'}</div>
                    <div class="video-stats">
                        <span><i class="fas fa-eye"></i> ${video.views_count || 0}</span>
                        <span><i class="fas fa-heart"></i> ${video.likes_count || 0}</span>
                        <span><i class="fas fa-comment"></i> ${video.comments_count || 0}</span>
                        <span><i class="fas fa-tags"></i> ${video.tags_count || 0}</span>
                    </div>
                    <div class="video-actions">
                        <button class="btn btn-secondary btn-sm" onclick="viewVideoDetails('${video.id}')" title="Подробнее">
                            <i class="fas fa-info-circle"></i>
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="deleteVideo('${video.id}')" title="Удалить">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error loading videos:', error);
        showToast('Ошибка загрузки видео', 'error');
    }
}

function filterVideos() {
    // TODO: Implement filtering
    console.log('Filtering videos...');
}

async function deleteVideo(videoId) {
    // TODO: Implement
    showToast('Функция в разработке', 'info');
}

function bulkDeleteVideos() {
    // TODO: Implement
    showToast('Функция в разработке', 'info');
}

async function viewVideoDetails(videoId) {
    try {
        showToast('Загрузка деталей...', 'info');
        
        // Загружаем детальную информацию о видео
        const [videoRes, tagsRes, likesRes, commentsRes, viewsRes] = await Promise.all([
            fetch(`/admin/videos/${videoId}`),
            fetch(`/admin/videos/${videoId}/tags`),
            fetch(`/admin/videos/${videoId}/likes`),
            fetch(`/admin/videos/${videoId}/comments`),
            fetch(`/admin/videos/${videoId}/views`)
        ]);
        
        const video = await videoRes.json();
        const tags = await tagsRes.json();
        const likes = await likesRes.json();
        const comments = await commentsRes.json();
        const views = await viewsRes.json();
        
        // Создаем контент для модального окна
        const modalContent = `
            <div class="video-details-modal">
                <div class="video-details-header">
                    ${video.video_url ? `<video src="${video.video_url}" controls style="width: 100%; max-height: 400px; border-radius: 8px; background: #000;"></video>` : '<p class="text-muted">Видео недоступно</p>'}
                </div>
                
                <div class="video-details-info">
                    <h3><i class="fas fa-info-circle"></i> Основная информация</h3>
                    <div class="info-grid">
                        <div class="info-item">
                            <span class="info-label">Описание:</span>
                            <span class="info-value">${video.description || 'Нет описания'}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Создано:</span>
                            <span class="info-value">${formatDate(video.created_at)}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Координаты:</span>
                            <span class="info-value">${video.latitude && video.longitude ? `${video.latitude.toFixed(6)}, ${video.longitude.toFixed(6)}` : 'Не указаны'}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Автор:</span>
                            <span class="info-value">${video.user_display_name || 'Неизвестно'}</span>
                        </div>
                    </div>
                </div>
                
                <div class="video-details-section">
                    <h3><i class="fas fa-tags"></i> Теги (${tags.tags?.length || 0})</h3>
                    <div class="tags-list">
                        ${tags.tags?.length > 0 
                            ? tags.tags.map(tag => `<span class="tag-badge">${tag.name}</span>`).join('') 
                            : '<p class="text-muted">Нет тегов</p>'}
                    </div>
                </div>
                
                <div class="video-details-section">
                    <h3><i class="fas fa-heart"></i> Лайки (${likes.likes?.length || 0})</h3>
                    <div class="users-list">
                        ${likes.likes?.length > 0 
                            ? likes.likes.map(like => `
                                <div class="user-item">
                                    <i class="fas fa-user-circle"></i>
                                    <span>${like.user_display_name || 'Пользователь'}</span>
                                    <span class="text-muted">${formatRelativeTime(like.created_at)}</span>
                                </div>
                            `).join('') 
                            : '<p class="text-muted">Нет лайков</p>'}
                    </div>
                </div>
                
                <div class="video-details-section">
                    <h3><i class="fas fa-comment"></i> Комментарии (${comments.comments?.length || 0})</h3>
                    <div class="comments-list-detail">
                        ${comments.comments?.length > 0 
                            ? comments.comments.map(comment => `
                                <div class="comment-detail-item">
                                    <div class="comment-detail-header">
                                        <strong>${comment.user_display_name || 'Пользователь'}</strong>
                                        <span class="text-muted">${formatRelativeTime(comment.created_at)}</span>
                                    </div>
                                    <div class="comment-detail-text">${comment.text}</div>
                                </div>
                            `).join('') 
                            : '<p class="text-muted">Нет комментариев</p>'}
                    </div>
                </div>
                
                <div class="video-details-section">
                    <h3><i class="fas fa-eye"></i> Просмотры (${views.views?.length || 0})</h3>
                    <div class="users-list">
                        ${views.views?.length > 0 
                            ? views.views.slice(0, 20).map(view => `
                                <div class="user-item">
                                    <i class="fas fa-user-circle"></i>
                                    <span>${view.user_display_name || 'Аноним'}</span>
                                    <span class="text-muted">${formatRelativeTime(view.created_at)}</span>
                                </div>
                            `).join('') 
                            : '<p class="text-muted">Нет просмотров</p>'}
                        ${views.views?.length > 20 ? `<p class="text-muted">...и еще ${views.views.length - 20}</p>` : ''}
                    </div>
                </div>
            </div>
        `;
        
        showModal('Детали видео', modalContent, null);
        
    } catch (error) {
        console.error('Error loading video details:', error);
        showToast('Ошибка загрузки деталей видео', 'error');
    }
}

// ===== TAGS =====
async function loadTags() {
    try {
        const container = document.getElementById('tags-grid');
        if (!container) return;
        
        container.innerHTML = '<div class="loading">Загрузка...</div>';
        
        const response = await fetch('/admin/tags');
        const data = await response.json();
        
        state.tags = data.tags || [];
        
        // Update total count
        updateElement('tags-total-count', state.tags.length);
        
        if (state.tags.length === 0) {
            container.innerHTML = '<div class="text-center text-muted">Нет тегов</div>';
            return;
        }
        
        container.innerHTML = state.tags.map(tag => `
            <div class="tag-item">
                <input type="checkbox" value="${tag.id}" onchange="toggleTagSelection()">
                <div class="tag-info">
                    <div class="tag-name">${tag.name}</div>
                    <div class="tag-meta">
                        <span class="tag-creator">
                            <i class="fas fa-user"></i> ${tag.creator_name}
                        </span>
                        <span class="tag-count-badge">
                            <i class="fas fa-hashtag"></i> ${tag.usage_count || 0}
                        </span>
                    </div>
                </div>
                <div class="tag-actions">
                    <button class="icon-btn danger" onclick="deleteTag('${tag.id}', '${tag.name}')" title="Удалить">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
        
        // Reset bulk delete button
        const deleteBtn = document.getElementById('bulk-delete-tags-btn');
        if (deleteBtn) {
            deleteBtn.disabled = true;
        }
        
    } catch (error) {
        console.error('Error loading tags:', error);
        showToast('Ошибка загрузки тегов', 'error');
    }
}

async function createTag() {
    const input = document.getElementById('new-tag-name');
    if (!input) return;
    
    const name = input.value.trim();
    if (!name) {
        showToast('Введите название тега', 'warning');
        return;
    }
    
    try {
        const response = await fetch('/admin/tags', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast(`Тег "${name}" создан`, 'success');
            input.value = '';
            loadTags();
        } else {
            showToast(data.error || 'Ошибка создания тега', 'error');
        }
    } catch (error) {
        console.error('Error creating tag:', error);
        showToast('Ошибка создания тега', 'error');
    }
}

function toggleTagSelection() {
    const checkboxes = document.querySelectorAll('#tags-grid input[type="checkbox"]:checked');
    const deleteBtn = document.getElementById('bulk-delete-tags-btn');
    if (deleteBtn) {
        deleteBtn.disabled = checkboxes.length === 0;
    }
}

function selectAllTags() {
    document.querySelectorAll('#tags-grid input[type="checkbox"]').forEach(cb => cb.checked = true);
    toggleTagSelection();
}

async function deleteTag(tagId, tagName) {
    showModal(
        'Удаление тега',
        `<p>Вы уверены, что хотите удалить тег <strong>${tagName}</strong>?</p>
         <p class="text-muted mt-4">Это действие также удалит все связи этого тега с видео.</p>`,
        async () => {
            try {
                const response = await fetch(`/admin/tags/${tagId}`, { 
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' }
                });
                
                const data = await response.json();
                
                if (data.success || response.ok) {
                    const deletedCount = data.deletedConnections || 0;
                    const message = deletedCount > 0 
                        ? `Тег "${tagName}" удален (удалено связей: ${deletedCount})`
                        : `Тег "${tagName}" удален`;
                    showToast(message, 'success');
                    loadTags();
                } else {
                    showToast(data.error || 'Ошибка удаления тега', 'error');
                }
            } catch (error) {
                console.error('Error deleting tag:', error);
                showToast('Ошибка удаления тега', 'error');
            }
        }
    );
}

async function bulkDeleteTags() {
    const checkboxes = document.querySelectorAll('#tags-grid input[type="checkbox"]:checked');
    const tagIds = Array.from(checkboxes).map(cb => cb.value);
    
    if (tagIds.length === 0) {
        showToast('Выберите теги для удаления', 'warning');
        return;
    }
    
    // Правильное склонение для русского языка
    const getTagWord = (count) => {
        const lastDigit = count % 10;
        const lastTwoDigits = count % 100;
        
        if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return 'тегов';
        if (lastDigit === 1) return 'тег';
        if (lastDigit >= 2 && lastDigit <= 4) return 'тега';
        return 'тегов';
    };
    
    const tagWord = getTagWord(tagIds.length);
    
    showModal(
        'Массовое удаление тегов',
        `<p>Вы уверены, что хотите удалить <strong>${tagIds.length}</strong> ${tagWord}?</p>
         <p class="text-muted mt-4">Это действие также удалит все связи этих тегов с видео.</p>`,
        async () => {
            try {
                const response = await fetch('/admin/tags/bulk', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ tagIds })
                });
                
                const data = await response.json();
                
                if (data.success || response.ok) {
                    const successCount = data.successCount || tagIds.length;
                    const errorCount = data.errorCount || 0;
                    
                    let message = `Удалено тегов: ${successCount}`;
                    if (errorCount > 0) {
                        message += ` (ошибок: ${errorCount})`;
                        showToast(message, 'warning');
                    } else {
                        showToast(message, 'success');
                    }
                    
                    loadTags();
                } else {
                    showToast(data.error || 'Ошибка массового удаления', 'error');
                }
            } catch (error) {
                console.error('Error bulk deleting tags:', error);
                showToast('Ошибка массового удаления тегов', 'error');
            }
        }
    );
}

// ===== COMMENTS =====
async function loadComments() {
    try {
        const container = document.getElementById('comments-list');
        if (!container) return;
        
        container.innerHTML = '<div class="loading">Загрузка...</div>';
        
        const response = await fetch('/admin/comments');
        const data = await response.json();
        
        state.comments = data.comments || [];
        
        // Update total count
        updateElement('comments-total-count', state.comments.length);
        
        if (state.comments.length === 0) {
            container.innerHTML = '<div class="text-center text-muted">Нет комментариев</div>';
            return;
        }
        
        container.innerHTML = state.comments.map(comment => `
            <div class="comment-item">
                <div class="comment-header">
                    <div class="comment-avatar">${comment.user_id?.charAt(0) || '?'}</div>
                    <div class="comment-meta">
                        <div class="comment-author">${comment.user_id || 'Unknown'}</div>
                        <div class="comment-date">${formatRelativeTime(comment.created_at)}</div>
                    </div>
                </div>
                <div class="comment-text">${comment.text || 'Без текста'}</div>
                <div class="comment-actions">
                    <button class="btn btn-secondary btn-sm" onclick="viewCommentVideo('${comment.video_id}')">
                        <i class="fas fa-video"></i> Видео
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="deleteComment('${comment.id}')">
                        <i class="fas fa-trash"></i> Удалить
                    </button>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error loading comments:', error);
        showToast('Ошибка загрузки комментариев', 'error');
    }
}

function filterComments() {
    // TODO: Implement filtering
    console.log('Filtering comments...');
}

async function deleteComment(commentId) {
    // TODO: Implement
    showToast('Функция в разработке', 'info');
}

function viewCommentVideo(videoId) {
    showToast('Переход к видео', 'info');
}

// ===== ANALYTICS =====
async function loadAnalytics() {
    showToast('Загрузка аналитики...', 'info');
    // TODO: Implement
}

function updateAnalytics() {
    // TODO: Implement
}

// ===== EXPORT =====
async function exportData(type, format) {
    try {
        showToast(`Экспорт ${type} в ${format.toUpperCase()}...`, 'info');
        
        let data = [];
        switch(type) {
            case 'users':
                data = state.users;
                break;
            case 'videos':
                data = state.videos;
                break;
            case 'tags':
                data = state.tags;
                break;
            case 'comments':
                data = state.comments;
                break;
        }
        
        if (format === 'json') {
            downloadJSON(data, `${type}_${Date.now()}.json`);
        } else if (format === 'csv') {
            downloadCSV(data, `${type}_${Date.now()}.csv`);
        }
        
        showToast(`${type} экспортированы`, 'success');
    } catch (error) {
        console.error('Export error:', error);
        showToast('Ошибка экспорта', 'error');
    }
}

function downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function downloadCSV(data, filename) {
    if (!data || data.length === 0) return;
    
    const headers = Object.keys(data[0]);
    const csv = [
        headers.join(','),
        ...data.map(row => headers.map(h => JSON.stringify(row[h] || '')).join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

// ===== SEARCH =====
function handleGlobalSearch(event) {
    const query = event.target.value.toLowerCase();
    if (query.length < 2) return;
    
    // TODO: Implement global search
    console.log('Searching for:', query);
}

// ===== LOGOUT =====
async function logout() {
    showModal(
        'Выйти из системы',
        '<p>Вы уверены, что хотите выйти?</p>',
        async () => {
            try {
                const response = await fetch('/admin/logout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                
                if (response.ok) {
                    window.location.href = '/auth/login';
                } else {
                    showToast('Ошибка при выходе', 'error');
                }
            } catch (error) {
                console.error('Logout error:', error);
                showToast('Ошибка при выходе', 'error');
            }
        }
    );
}

// ===== HELPER FUNCTIONS =====
function updateElement(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value;
    }
}


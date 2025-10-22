/**
 * Роуты системной информации и обслуживания
 */

const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/auth');
const supabase = require('../config/supabase');
const logger = require('../utils/logger');

/**
 * Системная информация и мониторинг
 */
router.get('/info', requireAdmin, async (req, res) => {
  try {
    logger.info('ADMIN', 'Запрос системной информации');

    const os = require('os');
    
    // Информация о памяти
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsagePercent = ((usedMemory / totalMemory) * 100).toFixed(2);

    // Информация о CPU
    const cpus = os.cpus();
    const cpuCount = cpus.length;
    const cpuModel = cpus[0]?.model || 'Unknown';

    // Информация о системе
    const platform = os.platform();
    const hostname = os.hostname();
    const uptime = os.uptime();
    const nodeVersion = process.version;

    // Информация о процессе Node.js
    const processMemory = process.memoryUsage();
    const processUptime = process.uptime();

    const systemInfo = {
      os: {
        platform,
        hostname,
        uptime: Math.floor(uptime),
        nodeVersion
      },
      memory: {
        total: totalMemory,
        free: freeMemory,
        used: usedMemory,
        usagePercent: parseFloat(memoryUsagePercent)
      },
      cpu: {
        count: cpuCount,
        model: cpuModel
      },
      process: {
        uptime: Math.floor(processUptime),
        memory: {
          rss: processMemory.rss,
          heapTotal: processMemory.heapTotal,
          heapUsed: processMemory.heapUsed,
          external: processMemory.external
        }
      }
    };

    logger.success('ADMIN', 'Системная информация получена');
    res.json(systemInfo);
  } catch (error) {
    logger.error('ADMIN', 'Ошибка получения системной информации', error);
    res.status(500).json({ error: 'Ошибка получения системной информации' });
  }
});

/**
 * Экспорт данных в CSV/JSON
 */
router.get('/export/:type', requireAdmin, async (req, res) => {
  try {
    const { type } = req.params;
    const { format = 'csv' } = req.query;
    
    logger.info('ADMIN', 'Экспорт данных', { type, format });

    let data, filename;

    switch (type) {
      case 'users':
        const { data: users } = await supabase
          .from('users')
          .select('id, yandex_id, first_name, last_name, display_name, created_at');
        data = users;
        filename = `users_export_${Date.now()}.${format}`;
        break;

      case 'videos':
        const { data: videos } = await supabase
          .from('videos')
          .select(`
            id, user_id, description, latitude, longitude, 
            views_count, likes_count, created_at,
            users(display_name)
          `);
        data = videos;
        filename = `videos_export_${Date.now()}.${format}`;
        break;

      case 'tags':
        const { data: tags } = await supabase
          .from('tags')
          .select('id, name, usage_count, created_at');
        data = tags;
        filename = `tags_export_${Date.now()}.${format}`;
        break;

      default:
        return res.status(400).json({ error: 'Неверный тип экспорта' });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Нет данных для экспорта' });
    }

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.json(data);
    }

    // CSV формат
    const fields = Object.keys(data[0]);
    const csvHeader = fields.join(',');
    const csvRows = data.map(row => 
      fields.map(field => {
        let value = row[field];
        if (typeof value === 'object' && value !== null) {
          value = JSON.stringify(value);
        }
        if (typeof value === 'string') {
          value = `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    );
    const csv = [csvHeader, ...csvRows].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\uFEFF' + csv); // BOM для правильного отображения кириллицы

    logger.success('ADMIN', 'Данные экспортированы', { type, format, count: data.length });
  } catch (error) {
    logger.error('ADMIN', 'Ошибка экспорта данных', error);
    res.status(500).json({ error: 'Ошибка экспорта данных' });
  }
});

module.exports = router;


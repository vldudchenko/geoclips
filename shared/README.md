# Shared Utilities

Общие утилиты и константы, используемые как на клиенте, так и на сервере.

## 📁 Содержимое

### `constants.js`

Централизованные константы для обеспечения консистентности между клиентом и сервером:

- **VIDEO_LIMITS** - лимиты для видео файлов
- **IMAGE_LIMITS** - лимиты для изображений
- **GEO_LIMITS** - географические лимиты
- **TEXT_LIMITS** - лимиты для текстовых полей
- **ERROR_CODES** - коды ошибок
- **ERROR_MESSAGES** - сообщения об ошибках
- **HTTP_STATUS** - HTTP статус коды
- **CACHE_CONFIG** - настройки кэширования
- **PAGINATION** - настройки пагинации
- **USER_ROLES** - роли пользователей
- **VIDEO_STATUS** - статусы видео
- **LOG_EVENTS** - события для логирования

### `validators.js`

Функции валидации данных:

- `isValidEmail(email)` - проверка email
- `isValidCoordinates(lat, lon)` - проверка координат
- `isValidVideoType(mimeType, filename)` - проверка типа видео
- `isValidFileSize(size, maxSize)` - проверка размера файла
- `isValidDescription(description)` - проверка описания
- `isValidTag(tag)` - проверка тега
- `isValidTags(tags)` - проверка массива тегов
- `isValidUUID(uuid)` - проверка UUID
- `isValidUrl(url)` - проверка URL
- `sanitizeString(str)` - очистка строки от опасных символов
- `validateVideoUpload(videoData)` - комплексная валидация данных видео

## 🔧 Использование

### На сервере (Node.js)

```javascript
const { VIDEO_LIMITS, ERROR_CODES } = require('../shared/constants');
const { isValidCoordinates, validateVideoUpload } = require('../shared/validators');

// Проверка координат
if (!isValidCoordinates(lat, lon)) {
  return res.status(400).json({ 
    error: 'Некорректные координаты',
    code: ERROR_CODES.INVALID_COORDINATES 
  });
}

// Проверка размера файла
if (file.size > VIDEO_LIMITS.MAX_FILE_SIZE) {
  return res.status(413).json({ 
    error: 'Файл слишком большой',
    code: ERROR_CODES.FILE_TOO_LARGE 
  });
}
```

### На клиенте (React)

```javascript
import { VIDEO_LIMITS, ERROR_MESSAGES } from '../../shared/constants';
import { validateVideoUpload, isValidVideoType } from '../../shared/validators';

// Проверка типа файла
if (!isValidVideoType(file.type, file.name)) {
  setError(ERROR_MESSAGES.INVALID_FILE_TYPE);
  return;
}

// Комплексная валидация
const { isValid, errors } = validateVideoUpload(videoData);
if (!isValid) {
  setErrors(errors);
  return;
}
```

## 🎯 Преимущества

1. **Консистентность** - одинаковая валидация на клиенте и сервере
2. **DRY** - нет дублирования кода
3. **Единый источник правды** - все лимиты и константы в одном месте
4. **Легкость изменений** - изменения в одном месте применяются везде
5. **Типобезопасность** - единые типы данных

## 📝 Добавление новых констант/валидаторов

### Добавить константу:

```javascript
// constants.js
const NEW_LIMITS = {
  MAX_VALUE: 100,
  MIN_VALUE: 0
};

module.exports = {
  // ...existing exports
  NEW_LIMITS
};
```

### Добавить валидатор:

```javascript
// validators.js
const isValidNewField = (value) => {
  return value >= NEW_LIMITS.MIN_VALUE && value <= NEW_LIMITS.MAX_VALUE;
};

module.exports = {
  // ...existing exports
  isValidNewField
};
```

## 🔄 Синхронизация

При изменении констант или валидаторов:

1. Обновить файл в папке `shared/`
2. Перезапустить сервер
3. Перезапустить клиент (hot reload должен сработать автоматически)

## ⚠️ Важно

- Не добавляйте серверные зависимости в shared файлы
- Код должен работать и в Node.js, и в браузере
- Используйте только vanilla JavaScript (без ES6 модулей в constants.js)


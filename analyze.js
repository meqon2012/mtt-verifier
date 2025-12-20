// ==========================================
// ANALYZE.JS - Правильная обработка документов
// ==========================================

// Конфигурация API (замените на ваши реальные значения)
const CONFIG = {
    API_KEY: 'ваш-api-key', // Получите на https://www.perplexity.ai/settings/home
    API_URL: 'https://api.perplexity.ai/chat/completions', // Или ваш бэкенд
};

// Хранилище данных
let appState = {
    prompts: JSON.parse(localStorage.getItem('prompts')) || [],
    selectedPrompt: null,
    uploadedFiles: [],
    filesContent: {}
};

// ==========================================
// ИНИЦИАЛИЗАЦИЯ
// ==========================================

document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    loadPrompts();
});

function initializeEventListeners() {
    // Промты
    document.getElementById('promptSelect').addEventListener('change', handlePromptSelect);
    document.getElementById('newPromptBtn').addEventListener('click', handleNewPrompt);
    document.getElementById('savePromptBtn').addEventListener('click', handleSavePrompt);
    document.getElementById('deletePromptBtn').addEventListener('click', handleDeletePrompt);
    document.getElementById('cancelPromptBtn').addEventListener('click', handleCancelPrompt);

    // Файлы
    const dropzone = document.getElementById('dropzone');
    dropzone.addEventListener('click', () => document.getElementById('fileInput').click());
    dropzone.addEventListener('dragover', handleDragOver);
    dropzone.addEventListener('dragleave', handleDragLeave);
    dropzone.addEventListener('drop', handleFileDrop);
    
    document.getElementById('fileInput').addEventListener('change', handleFileSelect);
    document.getElementById('analyzeBtn').addEventListener('click', handleAnalyze);
    document.getElementById('clearBtn').addEventListener('click', handleClear);
}

// ==========================================
// РАБОТА С ПРОМТАМИ
// ==========================================

function loadPrompts() {
    const select = document.getElementById('promptSelect');
    select.innerHTML = '<option value="">-- Выберите промт --</option>';
    
    appState.prompts.forEach((prompt, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = prompt.name;
        select.appendChild(option);
    });
}

function handlePromptSelect(e) {
    const index = e.target.value;
    if (index === '') {
        clearPromptForm();
        return;
    }
    
    const prompt = appState.prompts[index];
    appState.selectedPrompt = index;
    document.getElementById('promptName').value = prompt.name;
    document.getElementById('promptText').value = prompt.text;
}

function handleNewPrompt() {
    clearPromptForm();
    document.getElementById('promptSelect').value = '';
    appState.selectedPrompt = null;
}

function handleSavePrompt() {
    const name = document.getElementById('promptName').value.trim();
    const text = document.getElementById('promptText').value.trim();
    
    if (!name || !text) {
        showError('Заполните имя и текст промта');
        return;
    }
    
    if (appState.selectedPrompt !== null) {
        // Обновление
        appState.prompts[appState.selectedPrompt] = { name, text };
    } else {
        // Новый промт
        appState.prompts.push({ name, text });
    }
    
    localStorage.setItem('prompts', JSON.stringify(appState.prompts));
    loadPrompts();
    showSuccess('Промт сохранен');
    clearPromptForm();
}

function handleDeletePrompt() {
    if (appState.selectedPrompt === null) {
        showError('Сначала выберите промт для удаления');
        return;
    }
    
    appState.prompts.splice(appState.selectedPrompt, 1);
    localStorage.setItem('prompts', JSON.stringify(appState.prompts));
    loadPrompts();
    clearPromptForm();
    showSuccess('Промт удален');
}

function handleCancelPrompt() {
    clearPromptForm();
    document.getElementById('promptSelect').value = '';
    appState.selectedPrompt = null;
}

function clearPromptForm() {
    document.getElementById('promptName').value = '';
    document.getElementById('promptText').value = '';
    appState.selectedPrompt = null;
}

// ==========================================
// РАБОТА С ФАЙЛАМИ
// ==========================================

function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    document.getElementById('dropzone').classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    document.getElementById('dropzone').classList.remove('dragover');
}

function handleFileDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    document.getElementById('dropzone').classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    processFiles(files);
}

function handleFileSelect(e) {
    const files = e.target.files;
    processFiles(files);
}

function processFiles(files) {
    Array.from(files).forEach(file => {
        // Проверка размера
        if (file.size > 10 * 1024 * 1024) {
            showError(`Файл ${file.name} превышает максимальный размер (10 МБ)`);
            return;
        }
        
        // Проверка типа
        const allowedTypes = [
            'application/pdf',
            'text/plain',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'image/jpeg',
            'image/png'
        ];
        
        if (!allowedTypes.includes(file.type)) {
            showError(`Файл ${file.name} имеет недопустимый тип`);
            return;
        }
        
        // Добавляем файл
        appState.uploadedFiles.push({
            name: file.name,
            size: file.size,
            type: file.type,
            file: file
        });
    });
    
    renderFileList();
}

function renderFileList() {
    const fileList = document.getElementById('fileList');
    fileList.innerHTML = '';
    
    appState.uploadedFiles.forEach((fileData, index) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        
        const fileInfo = document.createElement('div');
        fileInfo.className = 'file-info';
        fileInfo.innerHTML = `
            <div class="file-name">📄 ${fileData.name}</div>
            <div class="file-size">${formatFileSize(fileData.size)}</div>
        `;
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'file-remove';
        removeBtn.innerHTML = '×';
        removeBtn.addEventListener('click', () => removeFile(index));
        
        fileItem.appendChild(fileInfo);
        fileItem.appendChild(removeBtn);
        fileList.appendChild(fileItem);
    });
}

function removeFile(index) {
    appState.uploadedFiles.splice(index, 1);
    delete appState.filesContent[index];
    renderFileList();
}

function handleClear() {
    appState.uploadedFiles = [];
    appState.filesContent = {};
    document.getElementById('fileInput').value = '';
    renderFileList();
    showSuccess('Файлы очищены');
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// ==========================================
// АНАЛИЗ ДОКУМЕНТОВ
// ==========================================

async function handleAnalyze() {
    // Валидация
    if (!document.getElementById('promptText').value.trim()) {
        showError('Пожалуйста, введите текст промта');
        return;
    }
    
    if (appState.uploadedFiles.length === 0) {
        showError('Пожалуйста, загрузите хотя бы один документ');
        return;
    }
    
    showLoading(true);
    clearResults();
    
    try {
        // 1. Извлекаем содержимое всех файлов
        const documentsContent = await extractAllFilesContent();
        
        // 2. Формируем запрос с содержимым документов
        const analysisRequest = buildAnalysisRequest(documentsContent);
        
        // 3. Отправляем в ИИ
        const result = await sendToAI(analysisRequest);
        
        // 4. Показываем результаты
        showResults(result);
        showSuccess('Анализ успешно завершен!');
        
    } catch (error) {
        console.error('Ошибка анализа:', error);
        showError(`Ошибка при анализе: ${error.message}`);
    } finally {
        showLoading(false);
    }
}

// Извлечение содержимого из всех типов файлов
async function extractAllFilesContent() {
    const documentsContent = [];
    
    for (const fileData of appState.uploadedFiles) {
        try {
            let content = '';
            
            if (fileData.type === 'application/pdf') {
                content = await extractPDFContent(fileData.file);
            } else if (fileData.type === 'text/plain') {
                content = await extractTextContent(fileData.file);
            } else if (fileData.type.includes('spreadsheetml') || fileData.type === 'application/vnd.ms-excel') {
                content = await extractExcelContent(fileData.file);
            } else if (fileData.type.includes('wordprocessingml')) {
                content = await extractDocxContent(fileData.file);
            } else if (fileData.type.includes('image')) {
                content = await extractImageContent(fileData.file);
            }
            
            if (content) {
                documentsContent.push({
                    name: fileData.name,
                    type: fileData.type,
                    content: content.substring(0, 5000) // Ограничиваем размер
                });
            }
        } catch (error) {
            console.error(`Ошибка при обработке ${fileData.name}:`, error);
            documentsContent.push({
                name: fileData.name,
                type: fileData.type,
                content: `[Ошибка при чтении файла: ${error.message}]`
            });
        }
    }
    
    return documentsContent;
}

// Извлечение из PDF
async function extractPDFContent(file) {
    try {
        // Используем встроенный FormData для чтения файла
        const arrayBuffer = await file.arrayBuffer();
        
        // Простой парсер PDF (извлекает текст)
        const text = new TextDecoder().decode(arrayBuffer);
        
        // Регулярное выражение для извлечения текста из PDF
        const match = text.match(/BT\s([\s\S]*?)ET/g);
        if (match) {
            return match.join('\n');
        }
        
        // Альтернатива: вернуть первые 1000 символов
        return text.substring(0, 1000);
    } catch (error) {
        throw new Error(`Ошибка чтения PDF: ${error.message}`);
    }
}

// Извлечение из TXT
async function extractTextContent(file) {
    return await file.text();
}

// Извлечение из Excel (базовое)
async function extractExcelContent(file) {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const text = new TextDecoder().decode(arrayBuffer);
        
        // Простая обработка: ищем текстовые строки
        const lines = text.split('\n');
        return lines
            .filter(line => line.trim().length > 0)
            .slice(0, 50)
            .join('\n');
    } catch (error) {
        throw new Error(`Ошибка чтения Excel: ${error.message}`);
    }
}

// Извлечение из DOCX (базовое)
async function extractDocxContent(file) {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const text = new TextDecoder().decode(arrayBuffer);
        
        // DOCX это ZIP архив с XML, ищем текст в XML
        const xmlMatch = text.match(/<w:t[^>]*>([^<]*)<\/w:t>/g);
        if (xmlMatch) {
            return xmlMatch
                .map(match => match.replace(/<[^>]*>/g, ''))
                .join('\n');
        }
        
        return text.substring(0, 1000);
    } catch (error) {
        throw new Error(`Ошибка чтения DOCX: ${error.message}`);
    }
}

// Извлечение из изображений (описание)
async function extractImageContent(file) {
    // Для изображений возвращаем информацию о файле
    return `[Изображение: ${file.name}, размер: ${file.size} байт]`;
}

// Формирование запроса для ИИ
function buildAnalysisRequest(documentsContent) {
    const prompt = document.getElementById('promptText').value;
    
    // Формируем строку со всем содержимым документов
    let documentsText = '\n\n=== СОДЕРЖИМОЕ ЗАГРУЖЕННЫХ ДОКУМЕНТОВ ===\n\n';
    
    documentsContent.forEach(doc => {
        documentsText += `\n--- Документ: ${doc.name} (${doc.type}) ---\n`;
        documentsText += doc.content;
        documentsText += '\n';
    });
    
    // Финальный запрос для ИИ
    const fullPrompt = `${prompt}${documentsText}`;
    
    return {
        prompt: fullPrompt,
        documents: documentsContent,
        timestamp: new Date().toISOString()
    };
}

// Отправка в ИИ
async function sendToAI(analysisRequest) {
    // ВАРИАНТ 1: Если отправляете на свой бэкенд
    const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(analysisRequest)
    });
    
    if (!response.ok) {
        throw new Error(`Ошибка сервера: ${response.status}`);
    }
    
    const result = await response.json();
    return result.analysis || result;
    
    /* ВАРИАНТ 2: Если отправляете в Perplexity API напрямую (замените на свой API ключ)
    
    const response = await fetch(CONFIG.API_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${CONFIG.API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'pplx-7b-online',
            messages: [
                {
                    role: 'user',
                    content: analysisRequest.prompt
                }
            ],
            temperature: 0.2
        })
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'API Error');
    }
    
    const data = await response.json();
    return {
        analysis: data.choices[0].message.content,
        model: data.model,
        usage: data.usage
    };
    */
}

// ==========================================
// ОТОБРАЖЕНИЕ РЕЗУЛЬТАТОВ
// ==========================================

function showResults(result) {
    const resultsSection = document.getElementById('resultsSection');
    const resultsContent = document.getElementById('resultsContent');
    
    if (typeof result === 'string') {
        resultsContent.textContent = result;
    } else if (result.analysis) {
        resultsContent.textContent = result.analysis;
    } else {
        resultsContent.innerHTML = `<pre>${JSON.stringify(result, null, 2)}</pre>`;
    }
    
    resultsSection.classList.add('show');
    resultsSection.scrollIntoView({ behavior: 'smooth' });
}

function clearResults() {
    const resultsSection = document.getElementById('resultsSection');
    const resultsContent = document.getElementById('resultsContent');
    resultsContent.textContent = '';
    resultsSection.classList.remove('show');
}

// ==========================================
// УВЕДОМЛЕНИЯ
// ==========================================

function showError(message) {
    const errorElement = document.getElementById('errorMessage');
    errorElement.textContent = '❌ ' + message;
    errorElement.classList.add('show');
    
    setTimeout(() => {
        errorElement.classList.remove('show');
    }, 5000);
}

function showSuccess(message) {
    const successElement = document.getElementById('successMessage');
    successElement.textContent = '✅ ' + message;
    successElement.classList.add('show');
    
    setTimeout(() => {
        successElement.classList.remove('show');
    }, 3000);
}

function showLoading(show) {
    const loadingModal = document.getElementById('loadingModal');
    if (show) {
        loadingModal.classList.add('show');
    } else {
        loadingModal.classList.remove('show');
    }
}
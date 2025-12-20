// ==========================================
// ANALYZE.JS - Исправленная версия с прямой отправкой в Perplexity API
// ==========================================

// Инициализация PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

let uploadedFiles = [];
let fileContents = {};
let prompts = {};
let currentPromptId = null;

// ВАЖНО: Замените на ваш реальный API ключ от Perplexity
const PERPLEXITY_API_KEY = 'ВАШ_API_KEY_ЗДЕСЬ';

// Используем правильное имя модели
// Доступные модели: sonar, sonar-pro, sonar-reasoning-pro, sonar-reasoning
const MODEL = 'sonar';

const DEFAULT_PROMPT = `Ты специалист МТС Exolve. Проведи проверку контрагента по чек-листу безопасности.

Файлы контрагента:
{files}

ОБЯЗАТЕЛЬНО верни ТОЛЬКО JSON (без текста перед и после) в точно этом формате:
{
  "summary": {
    "name": "ФИО контрагента или Не найдено",
    "birthDate": "Дата рождения или Не найдено",
    "egrip": "ЕГРНИП или Не найдено",
    "address": "Адрес или Не найдено"
  },
  "checks": [
    {"number": 1, "title": "ИП ликвидировано или в ликвидации", "status": "pass", "description": "По данным ЕГРИП статус активный"},
    {"number": 2, "title": "ИП зарегистрирован менее 3 месяцев", "status": "pass", "description": "Зарегистрирован более 3 месяцев назад"},
    {"number": 3, "title": "Дата рождения после 2000 года", "status": "fail", "description": "Дата рождения до 2000 года"},
    {"number": 4, "title": "Регион в черном списке", "status": "pass", "description": "Регион не в черном списке"},
    {"number": 5, "title": "Учредитель ликвидированной орг", "status": "unknown", "description": "Информация не найдена"},
    {"number": 6, "title": "2+ организации за 3 месяца", "status": "pass", "description": "Регистраций не найдено"}
  ],
  "recommendation": "ОДОБРИТЬ",
  "reasoning": "Контрагент прошел проверку по основным критериям безопасности."
}

ВАЖНО: НИКАКОГО текста перед JSON, НИКАКОГО текста после JSON!`;

// ==========================================
// ИНИЦИАЛИЗАЦИЯ
// ==========================================

document.addEventListener('DOMContentLoaded', function() {
    loadPrompts();
    setupEventListeners();
});

function setupEventListeners() {
    // Промты
    document.getElementById('promptSelect').addEventListener('change', handlePromptSelect);
    document.getElementById('newPromptBtn').addEventListener('click', handleNewPrompt);
    document.getElementById('savePromptBtn').addEventListener('click', handleSavePrompt);
    document.getElementById('deletePromptBtn').addEventListener('click', handleDeletePrompt);
    document.getElementById('cancelPromptBtn').addEventListener('click', handleCancelPrompt);

    // Файлы
    const fileUploadArea = document.getElementById('fileUploadArea');
    const fileInput = document.getElementById('fileInput');

    fileUploadArea.addEventListener('click', () => fileInput.click());
    fileUploadArea.addEventListener('dragover', handleDragOver);
    fileUploadArea.addEventListener('dragleave', handleDragLeave);
    fileUploadArea.addEventListener('drop', handleFileDrop);
    fileInput.addEventListener('change', handleFileSelect);

    // Анализ
    document.getElementById('analyzeBtn').addEventListener('click', analyze);
    document.getElementById('clearBtn').addEventListener('click', handleClear);
}

// ==========================================
// РАБОТА С ПРОМТАМИ
// ==========================================

function loadPrompts() {
    const saved = localStorage.getItem('mts_prompts');
    if (saved) {
        prompts = JSON.parse(saved);
        renderPromptSelect();
    } else {
        prompts = {
            'default': {
                id: 'default',
                name: 'Стандартный промт МТС',
                text: DEFAULT_PROMPT
            }
        };
        savePrompts();
        renderPromptSelect();
    }
}

function savePrompts() {
    localStorage.setItem('mts_prompts', JSON.stringify(prompts));
}

function renderPromptSelect() {
    const select = document.getElementById('promptSelect');
    select.innerHTML = '<option value="">-- Выберите промт --</option>';
    Object.keys(prompts).forEach(id => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = prompts[id].name;
        select.appendChild(option);
    });
}

function handlePromptSelect(e) {
    if (e.target.value) {
        currentPromptId = e.target.value;
        document.getElementById('promptEditor').classList.add('active');
        document.getElementById('promptName').value = prompts[currentPromptId].name;
        document.getElementById('promptText').value = prompts[currentPromptId].text;
        document.getElementById('deletePromptBtn').style.display = currentPromptId === 'default' ? 'none' : 'block';
    }
}

function handleNewPrompt() {
    currentPromptId = null;
    document.getElementById('promptEditor').classList.add('active');
    document.getElementById('promptName').value = '';
    document.getElementById('promptText').value = DEFAULT_PROMPT;
    document.getElementById('deletePromptBtn').style.display = 'none';
    document.getElementById('promptSelect').value = '';
}

function handleSavePrompt() {
    const name = document.getElementById('promptName').value.trim();
    const text = document.getElementById('promptText').value.trim();
    
    if (!name) {
        showError('Введите имя промта');
        return;
    }
    if (!text) {
        showError('Введите текст промта');
        return;
    }

    if (!currentPromptId) {
        currentPromptId = 'prompt_' + Date.now();
    }

    prompts[currentPromptId] = {
        id: currentPromptId,
        name: name,
        text: text
    };
    savePrompts();
    renderPromptSelect();
    document.getElementById('promptSelect').value = currentPromptId;
    document.getElementById('promptEditor').classList.remove('active');
    showSuccess('Промт сохранён');
}

function handleDeletePrompt() {
    if (confirm('Вы уверены? Промт будет удалён')) {
        delete prompts[currentPromptId];
        savePrompts();
        renderPromptSelect();
        document.getElementById('promptEditor').classList.remove('active');
        currentPromptId = null;
        showSuccess('Промт удалён');
    }
}

function handleCancelPrompt() {
    document.getElementById('promptEditor').classList.remove('active');
    currentPromptId = null;
    document.getElementById('promptSelect').value = '';
}

// ==========================================
// РАБОТА С ФАЙЛАМИ
// ==========================================

function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    document.getElementById('fileUploadArea').classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    document.getElementById('fileUploadArea').classList.remove('dragover');
}

function handleFileDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    document.getElementById('fileUploadArea').classList.remove('dragover');
    handleFiles(e.dataTransfer.files);
}

function handleFileSelect(e) {
    handleFiles(e.target.files);
}

function handleFiles(files) {
    for (let file of files) {
        if (file.size > 10 * 1024 * 1024) {
            showError('Файл "' + file.name + '" слишком большой (макс. 10 МБ)');
            continue;
        }
        uploadedFiles.push(file);
        readFileContent(file);
    }
    renderFileList();
}

async function readFileContent(file) {
    const fileName = file.name;
    const ext = fileName.split('.').pop().toLowerCase();

    try {
        if (ext === 'pdf') {
            await readPDF(file);
        } else if (ext === 'txt') {
            await readText(file);
        } else if (['docx', 'doc'].includes(ext)) {
            await readDocx(file);
        } else if (['xls', 'xlsx'].includes(ext)) {
            await readExcel(file);
        } else if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) {
            fileContents[fileName] = '[Изображение: ' + fileName + ']';
        }
        updatePreview();
    } catch (err) {
        console.error('Ошибка при чтении файла:', err);
        fileContents[fileName] = '[Ошибка при чтении файла: ' + err.message + ']';
    }
}

async function readPDF(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
    let text = '';
    for (let i = 1; i <= Math.min(pdf.numPages, 5); i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map(item => item.str).join(' ') + '\n';
    }
    fileContents[file.name] = text;
}

function readText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            fileContents[file.name] = e.target.result;
            resolve();
        };
        reader.onerror = reject;
        reader.readAsText(file);
    });
}

function readDocx(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            mammoth.extractText({ arrayBuffer: e.target.result })
                .then(result => {
                    fileContents[file.name] = result.value;
                    resolve();
                })
                .catch(reject);
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

function readExcel(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const workbook = XLSX.read(e.target.result, { type: 'binary' });
                let text = '';
                workbook.SheetNames.forEach(sheetName => {
                    const worksheet = workbook.Sheets[sheetName];
                    const csv = XLSX.utils.sheet_to_csv(worksheet);
                    text += '=== Лист: ' + sheetName + ' ===\n' + csv + '\n';
                });
                fileContents[file.name] = text;
                resolve();
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = reject;
        reader.readAsBinaryString(file);
    });
}

function renderFileList() {
    const fileList = document.getElementById('fileList');
    fileList.innerHTML = '';
    uploadedFiles.forEach((file, index) => {
        const item = document.createElement('div');
        item.className = 'file-item';
        item.innerHTML = '<span class="file-item-name" title="' + file.name + '">📎 ' + file.name + '</span><button class="file-item-remove" onclick="window.removeFile(' + index + ')">✕</button>';
        fileList.appendChild(item);
    });
}

window.removeFile = function(index) {
    const fileName = uploadedFiles[index].name;
    uploadedFiles.splice(index, 1);
    delete fileContents[fileName];
    renderFileList();
    updatePreview();
};

function updatePreview() {
    const contentKeys = Object.keys(fileContents);
    if (contentKeys.length > 0) {
        let allContent = '';
        contentKeys.forEach(key => {
            allContent += '=== ' + key + ' ===\n' + fileContents[key] + '\n\n';
        });
        document.getElementById('fileContentPreview').textContent = allContent.substring(0, 2000);
        document.getElementById('fileContentSection').style.display = 'block';
    } else {
        document.getElementById('fileContentSection').style.display = 'none';
    }
}

function handleClear() {
    uploadedFiles = [];
    fileContents = {};
    document.getElementById('fileList').innerHTML = '';
    document.getElementById('resultsPanel').classList.remove('active');
    document.getElementById('inputMessages').innerHTML = '';
    document.getElementById('fileContentSection').style.display = 'none';
    document.getElementById('fileInput').value = '';
}

// ==========================================
// АНАЛИЗ ДОКУМЕНТОВ
// ==========================================

async function analyze() {
    if (!currentPromptId) {
        showError('Пожалуйста, выберите или создайте промт');
        return;
    }
    if (uploadedFiles.length === 0) {
        showError('Пожалуйста, загрузите файлы контрагента');
        return;
    }

    if (PERPLEXITY_API_KEY === 'ВАШ_API_KEY_ЗДЕСЬ') {
        showError('❌ Ошибка: API ключ Perplexity не установлен. Откройте analyze.js и вставьте ваш API ключ.');
        return;
    }
    
    const loading = document.getElementById('loading');
    const resultsPanel = document.getElementById('resultsPanel');
    
    loading.classList.add('active');
    resultsPanel.classList.remove('active');

    try {
        // Формируем содержимое файлов
        let filesText = '';
        Object.keys(fileContents).forEach(key => {
            const content = fileContents[key].substring(0, 3000);
            filesText += '\n=== Файл: ' + key + ' ===\n' + content + '\n';
        });

        // Берем текст промта и вставляем содержимое файлов
        let promptText = prompts[currentPromptId].text;
        promptText = promptText.replace('{files}', filesText).replace('{info}', '');

        console.log('📤 Отправляю запрос в Perplexity API...');
        console.log('Используемая модель:', MODEL);
        console.log('Количество файлов:', uploadedFiles.length);
        console.log('Размер содержимого:', filesText.length, 'символов');

        // Отправляем в Perplexity API напрямую с правильной моделью
        const response = await fetch('https://api.perplexity.ai/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + PERPLEXITY_API_KEY,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: MODEL,
                messages: [
                    {
                        role: 'user',
                        content: promptText
                    }
                ],
                temperature: 0.2,
                top_p: 0.9,
                top_k: 0,
                frequency_penalty: 1,
                presence_penalty: 0
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            if (response.status === 401) {
                throw new Error('❌ API ключ неверный или истек. Проверьте PERPLEXITY_API_KEY в analyze.js');
            } else if (response.status === 400) {
                throw new Error('❌ ' + (errorData.error?.message || 'Неверные параметры запроса'));
            }
            throw new Error(errorData.error?.message || 'API ошибка: ' + response.status);
        }

        const data = await response.json();
        console.log('📥 Полный ответ от API:', data);

        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error('Неожиданный формат ответа от API');
        }

        const rawContent = data.choices[0].message.content;
        console.log('📋 Содержимое ответа ИИ:', rawContent);

        displayResults(rawContent);
        showSuccess('✅ Ответ получен от Perplexity AI');

    } catch (error) {
        console.error('❌ Ошибка:', error);
        showError('❌ ' + error.message);
    } finally {
        loading.classList.remove('active');
    }
}

// ==========================================
// ОТОБРАЖЕНИЕ РЕЗУЛЬТАТОВ
// ==========================================

function displayResults(content) {
    const resultsContent = document.getElementById('resultsContent');
    const resultsPanel = document.getElementById('resultsPanel');

    const html = `
        <div class="ai-response-box">
            <div class="ai-response-label">🤖 Ответ от Perplexity AI (модель: ${MODEL}):</div>
            <div class="ai-response-content">${escapeHtml(content)}</div>
        </div>
    `;

    resultsContent.innerHTML = html;
    resultsPanel.classList.add('active');
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// ==========================================
// УВЕДОМЛЕНИЯ
// ==========================================

function showError(message) {
    const container = document.getElementById('inputMessages');
    const msg = document.createElement('div');
    msg.className = 'error-message';
    msg.textContent = message;
    container.appendChild(msg);
    setTimeout(() => msg.remove(), 5000);
}

function showSuccess(message) {
    const container = document.getElementById('inputMessages');
    const msg = document.createElement('div');
    msg.className = 'success-message';
    msg.textContent = message;
    container.appendChild(msg);
    setTimeout(() => msg.remove(), 5000);
}
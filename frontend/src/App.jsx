import React, { useState } from 'react';

export default function App() {
  const [step, setStep] = useState(1); 
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [mode, setMode] = useState('direct'); // 'direct' или 'manual'
  const [generatedCommand, setGeneratedCommand] = useState('');
  const [copied, setCopied] = useState(false);
  
  const [sshData, setSshData] = useState({ ip: '', port: '22', username: 'root', password: '' });

  const handleVerifySSH = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.target);
    const currentSshData = Object.fromEntries(formData.entries());

    try {
      const response = await fetch('/api/verify_ssh', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      
      if (data.success) {
        setSshData(currentSshData);
        setMode(data.mode); // 'direct' или 'manual'
        setStep(2); 
        if (data.warning) {
          setError(data.warning); // Показываем предупреждение о ручном режиме
        }
      } else {
        setError(data.error || 'Ошибка подключения к серверу.');
      }
    } catch (err) {
      setError('Ошибка сети. Бэкенд недоступен.');
    } finally {
      setLoading(false);
    }
  };

  const handleInstall = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.target);

    if (mode === 'manual') {
      // Ручной режим — генерируем команду
      try {
        const response = await fetch('/api/generate_command', {
          method: 'POST',
          body: formData,
        });
        const data = await response.json();
        
        if (data.success) {
          setGeneratedCommand(data.command);
          setStep(3);
        } else {
          setError(data.error || 'Ошибка генерации команды');
        }
      } catch (err) {
        setError('Ошибка сети.');
      } finally {
        setLoading(false);
      }
    } else {
      // Автоматический режим — SSH
      formData.append('ip', sshData.ip);
      formData.append('port', sshData.port);
      formData.append('username', sshData.username);
      formData.append('password', sshData.password);

      try {
        const response = await fetch('/api/install', {
          method: 'POST',
          body: formData,
        });
        const data = await response.json();
        
        if (data.success) {
          setResult(data.link);
          setStep(4); // Успех автоматической установки
        } else {
          setError(data.error || 'Произошла ошибка при установке');
        }
      } catch (err) {
        setError('Ошибка сети при установке.');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedCommand).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const resetApp = () => {
    setStep(1);
    setResult(null);
    setError(null);
    setMode('direct');
    setGeneratedCommand('');
    setCopied(false);
  };

  return (
    <div className="app-container">
      <style>{`
        :root {
          --bg-color: #0f172a; --card-bg: #1e293b; --text-main: #f8fafc;
          --text-muted: #94a3b8; --accent: #10b981; --accent-hover: #059669;
          --input-bg: #334155; --input-border: #475569;
          --error-bg: rgba(239, 68, 68, 0.1); --error-text: #f87171; --error-border: #ef4444;
          --warning-bg: rgba(251, 191, 36, 0.1); --warning-text: #fbbf24; --warning-border: rgba(251, 191, 36, 0.3);
        }
        body { margin: 0; font-family: 'Inter', system-ui, sans-serif; background-color: var(--bg-color); color: var(--text-main); }
        .app-container { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; box-sizing: border-box; }
        .glass-card { background: var(--card-bg); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 20px; padding: 40px; width: 100%; max-width: 520px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); position: relative; overflow: hidden; }
        .header-title { text-align: center; color: var(--accent); font-size: 28px; font-weight: 700; margin: 0 0 5px 0; }
        .header-subtitle { text-align: center; color: var(--text-muted); font-size: 14px; margin-bottom: 30px; }
        .form-group { margin-bottom: 20px; }
        .form-label { display: block; font-size: 14px; font-weight: 500; color: var(--text-muted); margin-bottom: 8px; }
        .form-input, .form-select { width: 100%; padding: 14px 16px; background-color: var(--input-bg); border: 1px solid var(--input-border); border-radius: 12px; color: var(--text-main); font-size: 16px; box-sizing: border-box; transition: all 0.2s ease; outline: none; }
        .ip-port-row { display: flex; gap: 12px; }
        .ip-port-row .ip-field { flex: 1; }
        .ip-port-row .port-field { width: 100px; }
        .form-input:focus, .form-select:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2); }
        .submit-btn { width: 100%; padding: 16px; background-color: var(--accent); color: white; border: none; border-radius: 12px; font-size: 16px; font-weight: 600; cursor: pointer; transition: 0.2s; margin-top: 10px; }
        .submit-btn:hover:not(:disabled) { background-color: var(--accent-hover); }
        .submit-btn:disabled { background-color: #047857; cursor: not-allowed; opacity: 0.8; }
        .back-btn { width: 100%; padding: 14px; background-color: transparent; color: var(--text-muted); border: 1px solid var(--input-border); border-radius: 12px; font-size: 15px; cursor: pointer; margin-top: 10px; transition: 0.2s; }
        .back-btn:hover { background-color: rgba(255,255,255,0.05); color: white; }
        .error-box { margin-top: 20px; padding: 16px; background: var(--error-bg); border: 1px solid var(--error-border); border-radius: 12px; color: var(--error-text); text-align: center; font-size: 14px; animation: fadeIn 0.3s; }
        .warning-box { margin-top: 20px; padding: 16px; background: var(--warning-bg); border: 1px solid var(--warning-border); border-radius: 12px; color: var(--warning-text); text-align: center; font-size: 13px; animation: fadeIn 0.3s; }
        .loading-state { text-align: center; margin-top: 20px; padding: 20px; background: rgba(251, 191, 36, 0.1); border-radius: 12px; border: 1px solid rgba(251, 191, 36, 0.3); }
        .loading-spinner { display: inline-block; width: 24px; height: 24px; border: 3px solid rgba(251, 191, 36, 0.3); border-radius: 50%; border-top-color: #fbbf24; animation: spin 1s infinite; margin-bottom: 10px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .result-box { padding: 30px 20px; text-align: center; animation: fadeIn 0.5s; }
        .result-link { margin-top: 20px; padding: 15px; background: rgba(0,0,0,0.3); border-radius: 8px; word-break: break-all; color: var(--accent); font-family: monospace; }
        .command-box { margin-top: 20px; padding: 16px; background: rgba(0,0,0,0.4); border-radius: 12px; font-family: 'JetBrains Mono', 'Fira Code', monospace; font-size: 12px; color: #a5f3fc; word-break: break-all; line-height: 1.6; max-height: 200px; overflow-y: auto; text-align: left; user-select: all; border: 1px solid rgba(255,255,255,0.1); }
        .copy-btn { width: 100%; padding: 14px; background-color: #3b82f6; color: white; border: none; border-radius: 12px; font-size: 15px; font-weight: 600; cursor: pointer; margin-top: 15px; transition: 0.2s; }
        .copy-btn:hover { background-color: #2563eb; }
        .copy-btn.copied { background-color: var(--accent); }
        .mode-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-bottom: 20px; }
        .mode-badge.manual { background: rgba(251, 191, 36, 0.15); color: #fbbf24; border: 1px solid rgba(251, 191, 36, 0.3); }
        .mode-badge.direct { background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); }
        .instructions { margin-top: 20px; padding: 16px; background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.2); border-radius: 12px; text-align: left; }
        .instructions ol { margin: 8px 0 0 0; padding-left: 20px; color: var(--text-muted); font-size: 13px; line-height: 1.8; }
        .instructions li { margin-bottom: 4px; }
        @media (max-width: 480px) { .glass-card { padding: 25px 20px; border-radius: 16px; } .command-box { font-size: 11px; } }
      `}</style>

      <div className="glass-card">
        
        {/* ШАГ 1: Подключение */}
        {step === 1 && (
          <div style={{ animation: 'fadeIn 0.3s' }}>
            <h2 className="header-title">Подключение</h2>
            <p className="header-subtitle">Шаг 1: Доступ к серверу</p>

            <form onSubmit={handleVerifySSH}>
              <div className="form-group">
                <label className="form-label">IP-адрес сервера и порт SSH</label>
                <div className="ip-port-row">
                  <div className="ip-field">
                    <input type="text" name="ip" className="form-input" required placeholder="185.65.x.x" defaultValue={sshData.ip} />
                  </div>
                  <div className="port-field">
                    <input type="number" name="port" className="form-input" required placeholder="22" defaultValue={sshData.port} min="1" max="65535" />
                  </div>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Пользователь SSH</label>
                <input type="text" name="username" className="form-input" required defaultValue={sshData.username} />
              </div>
              <div className="form-group">
                <label className="form-label">Пароль</label>
                <input type="password" name="password" className="form-input" required placeholder="••••••••" defaultValue={sshData.password} />
              </div>
              
              <button disabled={loading} type="submit" className="submit-btn">
                {loading ? 'Проверка связи...' : 'Войти'}
              </button>
            </form>
          </div>
        )}

        {/* ШАГ 2: Настройки */}
        {step === 2 && (
          <div style={{ animation: 'fadeIn 0.3s' }}>
            <h2 className="header-title">Настройки</h2>
            <p className="header-subtitle">Шаг 2: Конфигурация OlcRTC на {sshData.ip}</p>
            
            <div style={{ textAlign: 'center' }}>
              <span className={`mode-badge ${mode}`}>
                {mode === 'direct' ? '🟢 Автоматический режим' : '🟡 Ручной режим'}
              </span>
            </div>

            <form onSubmit={handleInstall}>
              <div className="form-group">
                <label className="form-label">Провайдер</label>
                <select name="provider" className="form-select">
                  <option value="3">Sber SaluteJazz</option>
                  <option value="1">Yandex Telemost</option>
                  <option value="2">WB Stream</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Ссылка на комнату</label>
                <input type="text" name="room" className="form-input" required placeholder="https://..." />
              </div>
              <div className="form-group">
                <label className="form-label">Транспорт</label>
                <select name="transport" className="form-select">
                  <option value="1">vp8channel (Рекомендуется)</option>
                  <option value="2">videochannel</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Имя бота</label>
                <input type="text" name="bot_name" className="form-input" defaultValue="Бот-Помощник" required />
              </div>

              <button disabled={loading} type="submit" className="submit-btn">
                {loading 
                  ? (mode === 'direct' ? 'Установка...' : 'Генерация...') 
                  : (mode === 'direct' ? 'Запустить установку' : 'Сгенерировать команду')
                }
              </button>
              
              {!loading && (
                <button type="button" onClick={() => { setStep(1); setError(null); }} className="back-btn">
                  Назад к подключению
                </button>
              )}
            </form>
          </div>
        )}

        {/* ШАГ 3: Результат ручного режима — показываем команду */}
        {step === 3 && (
          <div className="result-box">
            <div style={{ fontSize: '48px', marginBottom: '10px' }}>📋</div>
            <h2 className="header-title" style={{ marginBottom: '10px' }}>Команда готова</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
              Скопируйте команду и выполните её на сервере {sshData.ip}
            </p>
            
            <div className="command-box">{generatedCommand}</div>
            
            <button onClick={handleCopy} className={`copy-btn ${copied ? 'copied' : ''}`}>
              {copied ? '✓ Скопировано!' : '📋 Скопировать команду'}
            </button>

            <div className="instructions">
              <strong style={{ color: 'var(--text-main)', fontSize: '14px' }}>Как использовать:</strong>
              <ol>
                <li>Подключитесь к серверу через SSH (PuTTY, терминал)</li>
                <li>Вставьте скопированную команду</li>
                <li>Нажмите Enter и дождитесь завершения</li>
              </ol>
            </div>

            <button onClick={resetApp} className="back-btn" style={{ marginTop: '20px' }}>
              Установить на другой сервер
            </button>
          </div>
        )}

        {/* ШАГ 4: Успех автоматической установки */}
        {step === 4 && (
          <div className="result-box">
            <div style={{ fontSize: '64px', marginBottom: '10px' }}>✅</div>
            <h2 className="header-title" style={{ marginBottom: '10px' }}>Готово!</h2>
            <p style={{ color: 'var(--text-muted)' }}>OlcRTC успешно установлен и запущен.</p>
            <div className="result-link">{result}</div>
            <button onClick={resetApp} className="submit-btn" style={{ marginTop: '30px' }}>
              Установить на другой сервер
            </button>
          </div>
        )}

        {loading && step === 2 && mode === 'direct' && (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p style={{ color: '#fbbf24', fontWeight: '500', margin: '0 0 5px 0' }}>Идет сборка и настройка...</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>Не закрывайте страницу. Это займет около 1-2 минут.</p>
          </div>
        )}

        {error && (
          <div className={mode === 'manual' && step === 2 ? 'warning-box' : 'error-box'}>
            {mode === 'manual' && step === 2 ? '⚡' : '⚠️'} {error}
          </div>
        )}
        
      </div>
    </div>
  );
}
import React, { useState, useEffect, useRef } from 'react';

export default function App() {
  const [page, setPage] = useState('loading'); // loading, install, dashboard
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [installResult, setInstallResult] = useState(null);
  const [logs, setLogs] = useState('');
  const [showLogs, setShowLogs] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installProgress, setInstallProgress] = useState('');
  const logsRef = useRef(null);

  // Загрузка статуса при старте
  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      setStatus(data);
      
      if (data.installed && data.config) {
        setPage('dashboard');
      } else {
        setPage('install');
      }
    } catch (err) {
      setPage('install');
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/logs?lines=100');
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs);
        setTimeout(() => {
          if (logsRef.current) logsRef.current.scrollTop = logsRef.current.scrollHeight;
        }, 100);
      }
    } catch (err) {
      setLogs('Ошибка загрузки логов');
    }
  };

  const handleInstall = async (e) => {
    e.preventDefault();
    setInstalling(true);
    setError(null);
    setInstallProgress('Запускаем установку... Это может занять 5-30 минут.');

    const formData = new FormData(e.target);

    try {
      const res = await fetch('/api/install', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (data.success) {
        setInstallResult(data.config);
        setSuccess('OlcRTC успешно установлен и запущен!');
        await fetchStatus();
        setPage('dashboard');
      } else {
        setError(`Ошибка на этапе "${data.step}": ${data.error}`);
      }
    } catch (err) {
      setError('Ошибка сети. Сервер недоступен.');
    } finally {
      setInstalling(false);
      setInstallProgress('');
    }
  };

  const handleAction = async (action) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/${action}`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setSuccess(action === 'uninstall' 
          ? 'OlcRTC полностью удалён.' 
          : `Действие "${action}" выполнено.`
        );
        if (action === 'uninstall') {
          setPage('install');
          setInstallResult(null);
        }
        await fetchStatus();
      } else {
        setError(data.error || 'Ошибка');
      }
    } catch (err) {
      setError('Ошибка сети');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      setSuccess('Скопировано в буфер обмена!');
      setTimeout(() => setSuccess(null), 2000);
    });
  };

  return (
    <div className="app-container">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        :root {
          --bg: #0a0e1a; --card: #111827; --card-hover: #1a2035;
          --text: #f1f5f9; --muted: #64748b; --accent: #10b981; --accent-hover: #059669;
          --blue: #3b82f6; --red: #ef4444; --yellow: #f59e0b; --purple: #8b5cf6;
          --border: rgba(255,255,255,0.06); --input-bg: #1e293b; --input-border: #334155;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', system-ui, sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; }
        .app-container { max-width: 720px; margin: 0 auto; padding: 24px 16px; min-height: 100vh; }

        /* Header */
        .header { text-align: center; padding: 32px 0 24px; }
        .logo { font-size: 32px; font-weight: 700; background: linear-gradient(135deg, #10b981, #3b82f6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; letter-spacing: -0.5px; }
        .subtitle { color: var(--muted); font-size: 14px; margin-top: 4px; }
        .server-ip { display: inline-block; margin-top: 8px; padding: 4px 14px; background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.2); border-radius: 20px; font-size: 12px; color: var(--accent); font-family: 'JetBrains Mono', monospace; }

        /* Cards */
        .card { background: var(--card); border: 1px solid var(--border); border-radius: 16px; padding: 28px; margin-bottom: 16px; transition: all 0.2s; }
        .card-title { font-size: 18px; font-weight: 600; margin-bottom: 16px; display: flex; align-items: center; gap: 10px; }
        
        /* Status indicator */
        .status-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: rgba(0,0,0,0.2); border-radius: 12px; margin-bottom: 12px; }
        .status-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; margin-right: 8px; }
        .status-dot.active { background: #10b981; box-shadow: 0 0 8px rgba(16,185,129,0.5); animation: pulse 2s infinite; }
        .status-dot.inactive { background: #ef4444; box-shadow: 0 0 8px rgba(239,68,68,0.3); }
        .status-dot.unknown { background: #64748b; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

        /* Config items */
        .config-grid { display: grid; gap: 8px; }
        .config-item { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: rgba(0,0,0,0.15); border-radius: 10px; font-size: 14px; }
        .config-label { color: var(--muted); font-size: 13px; }
        .config-value { font-family: 'JetBrains Mono', monospace; font-size: 13px; color: var(--accent); cursor: pointer; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .config-value:hover { color: #34d399; }

        /* URI box */
        .uri-box { margin-top: 16px; padding: 14px; background: rgba(139,92,246,0.08); border: 1px solid rgba(139,92,246,0.2); border-radius: 12px; }
        .uri-label { font-size: 12px; color: var(--purple); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
        .uri-value { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #c4b5fd; word-break: break-all; line-height: 1.5; cursor: pointer; }
        .uri-value:hover { color: #e0d5ff; }

        /* Form */
        .form-group { margin-bottom: 18px; }
        .form-label { display: block; font-size: 13px; font-weight: 500; color: var(--muted); margin-bottom: 6px; }
        .form-input, .form-select { width: 100%; padding: 12px 14px; background: var(--input-bg); border: 1px solid var(--input-border); border-radius: 10px; color: var(--text); font-size: 15px; font-family: 'Inter', sans-serif; outline: none; transition: 0.2s; }
        .form-input:focus, .form-select:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(16,185,129,0.15); }
        .form-select option { background: var(--card); }
        .form-hint { font-size: 11px; color: var(--muted); margin-top: 4px; }

        /* Buttons */
        .btn { padding: 12px 20px; border: none; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s; font-family: 'Inter', sans-serif; display: inline-flex; align-items: center; gap: 8px; justify-content: center; }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-primary { width: 100%; background: var(--accent); color: white; padding: 14px; font-size: 15px; }
        .btn-primary:hover:not(:disabled) { background: var(--accent-hover); transform: translateY(-1px); }
        .btn-sm { padding: 8px 16px; font-size: 13px; border-radius: 8px; }
        .btn-green { background: rgba(16,185,129,0.15); color: var(--accent); border: 1px solid rgba(16,185,129,0.2); }
        .btn-green:hover:not(:disabled) { background: rgba(16,185,129,0.25); }
        .btn-blue { background: rgba(59,130,246,0.15); color: var(--blue); border: 1px solid rgba(59,130,246,0.2); }
        .btn-blue:hover:not(:disabled) { background: rgba(59,130,246,0.25); }
        .btn-red { background: rgba(239,68,68,0.1); color: var(--red); border: 1px solid rgba(239,68,68,0.15); }
        .btn-red:hover:not(:disabled) { background: rgba(239,68,68,0.2); }
        .btn-yellow { background: rgba(245,158,11,0.1); color: var(--yellow); border: 1px solid rgba(245,158,11,0.15); }
        .btn-yellow:hover:not(:disabled) { background: rgba(245,158,11,0.2); }
        .btn-row { display: flex; gap: 8px; flex-wrap: wrap; }

        /* Alerts */
        .alert { padding: 14px 16px; border-radius: 12px; font-size: 14px; margin-bottom: 16px; animation: slideIn 0.3s; display: flex; align-items: flex-start; gap: 10px; }
        .alert-error { background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); color: #fca5a5; }
        .alert-success { background: rgba(16,185,129,0.08); border: 1px solid rgba(16,185,129,0.2); color: #6ee7b7; }
        .alert-warning { background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.2); color: #fcd34d; }
        @keyframes slideIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }

        /* Logs */
        .logs-container { background: #0d1117; border: 1px solid var(--border); border-radius: 12px; padding: 16px; margin-top: 12px; max-height: 400px; overflow-y: auto; }
        .logs-text { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #8b949e; line-height: 1.7; white-space: pre-wrap; word-break: break-all; }

        /* Install progress */
        .install-progress { text-align: center; padding: 40px 20px; }
        .spinner { width: 48px; height: 48px; border: 4px solid rgba(16,185,129,0.2); border-radius: 50%; border-top-color: var(--accent); animation: spin 1s linear infinite; margin: 0 auto 20px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .progress-text { color: var(--accent); font-weight: 500; font-size: 16px; }
        .progress-sub { color: var(--muted); font-size: 13px; margin-top: 8px; }

        /* Loading */
        .loading-screen { text-align: center; padding: 80px 20px; }

        /* Responsive */
        @media (max-width: 480px) {
          .app-container { padding: 16px 12px; }
          .card { padding: 20px 16px; }
          .btn-row { flex-direction: column; }
          .config-value { max-width: 180px; }
        }
      `}</style>

      {/* Header */}
      <div className="header">
        <div className="logo">OlcRTC Panel</div>
        <div className="subtitle">Панель управления прокси-сервером</div>
        {status?.server_ip && (
          <div className="server-ip">🖥 {status.server_ip}</div>
        )}
      </div>

      {/* Alerts */}
      {error && (
        <div className="alert alert-error">
          <span>⚠️</span><span>{error}</span>
        </div>
      )}
      {success && (
        <div className="alert alert-success">
          <span>✅</span><span>{success}</span>
        </div>
      )}

      {/* Loading */}
      {page === 'loading' && (
        <div className="loading-screen">
          <div className="spinner"></div>
          <div className="progress-text">Загрузка панели...</div>
        </div>
      )}

      {/* ===================== INSTALL PAGE ===================== */}
      {page === 'install' && !installing && (
        <div className="card">
          <div className="card-title">🚀 Установка OlcRTC</div>
          
          <form onSubmit={handleInstall}>
            <div className="form-group">
              <label className="form-label">Провайдер</label>
              <select name="provider" className="form-select" defaultValue="3">
                <option value="3">Sber SaluteJazz</option>
                <option value="1">Yandex Telemost</option>
                <option value="2">WB Stream</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Транспорт</label>
              <select name="transport" className="form-select" defaultValue="1">
                <option value="1">vp8channel (Рекомендуется)</option>
                <option value="2">videochannel</option>
                <option value="3">seichannel</option>
                <option value="4">datachannel</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Ссылка на комнату или ID</label>
              <input type="text" name="room" className="form-input" required placeholder="https://salutejazz.ru/calls/xxxxx или ID" />
              <div className="form-hint">Вставьте полную ссылку — ID и пароль извлекутся автоматически</div>
            </div>

            <div className="form-group">
              <label className="form-label">Имя бота (для Jazz)</label>
              <input type="text" name="bot_name" className="form-input" placeholder="Оставьте пустым для случайного имени" />
            </div>

            <button type="submit" className="btn btn-primary" disabled={installing}>
              🚀 Установить и запустить OlcRTC
            </button>
          </form>
        </div>
      )}

      {/* Install Progress */}
      {installing && (
        <div className="card">
          <div className="install-progress">
            <div className="spinner"></div>
            <div className="progress-text">Установка OlcRTC</div>
            <div className="progress-sub">{installProgress}</div>
            <div className="progress-sub" style={{ marginTop: '16px', fontSize: '12px' }}>
              ⚡ Первая установка включает компиляцию Go-бинарника.<br/>
              Это может занять 5–30 минут в зависимости от мощности сервера.<br/>
              Не закрывайте страницу!
            </div>
          </div>
        </div>
      )}

      {/* ===================== DASHBOARD ===================== */}
      {page === 'dashboard' && status && (
        <>
          {/* Status Card */}
          <div className="card">
            <div className="card-title">📊 Статус</div>
            <div className="status-row">
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span className={`status-dot ${status.running ? 'active' : 'inactive'}`}></span>
                <span style={{ fontWeight: 600 }}>
                  {status.running ? 'Работает' : 'Остановлен'}
                </span>
              </div>
              {status.uptime && (
                <span style={{ color: 'var(--muted)', fontSize: '13px' }}>{status.uptime}</span>
              )}
            </div>
            
            <div className="btn-row">
              {status.running ? (
                <>
                  <button className="btn btn-sm btn-yellow" disabled={loading} onClick={() => handleAction('restart')}>
                    🔄 Перезапуск
                  </button>
                  <button className="btn btn-sm btn-red" disabled={loading} onClick={() => handleAction('stop')}>
                    ⏹ Стоп
                  </button>
                </>
              ) : (
                <button className="btn btn-sm btn-green" disabled={loading} onClick={() => handleAction('start')}>
                  ▶️ Запуск
                </button>
              )}
              <button className="btn btn-sm btn-blue" onClick={() => { setShowLogs(!showLogs); if (!showLogs) fetchLogs(); }}>
                📋 {showLogs ? 'Скрыть логи' : 'Логи'}
              </button>
            </div>

            {showLogs && (
              <div className="logs-container" ref={logsRef}>
                <pre className="logs-text">{logs || 'Загрузка...'}</pre>
                <button className="btn btn-sm btn-blue" style={{ marginTop: '10px' }} onClick={fetchLogs}>
                  🔄 Обновить
                </button>
              </div>
            )}
          </div>

          {/* Config Card */}
          {status.config && (
            <div className="card">
              <div className="card-title">⚙️ Конфигурация</div>
              <div className="config-grid">
                <div className="config-item">
                  <span className="config-label">Провайдер</span>
                  <span className="config-value">{status.config.S_PROVIDER}</span>
                </div>
                <div className="config-item">
                  <span className="config-label">Транспорт</span>
                  <span className="config-value">{status.config.S_TRANSPORT}</span>
                </div>
                <div className="config-item">
                  <span className="config-label">ID звонка</span>
                  <span className="config-value" title="Нажмите для копирования" onClick={() => copyToClipboard(status.config.S_ROOM_ID)}>
                    {status.config.S_ROOM_ID}
                  </span>
                </div>
                <div className="config-item">
                  <span className="config-label">Ключ шифрования</span>
                  <span className="config-value" title="Нажмите для копирования" onClick={() => copyToClipboard(status.config.S_ENC_KEY)}>
                    {status.config.S_ENC_KEY}
                  </span>
                </div>
                <div className="config-item">
                  <span className="config-label">ID клиента</span>
                  <span className="config-value" title="Нажмите для копирования" onClick={() => copyToClipboard(status.config.S_CLIENT_ID)}>
                    {status.config.S_CLIENT_ID}
                  </span>
                </div>
                {status.config.S_BOT_NAME && (
                  <div className="config-item">
                    <span className="config-label">Имя бота</span>
                    <span className="config-value">{status.config.S_BOT_NAME}</span>
                  </div>
                )}
              </div>

              {/* URI */}
              <div className="uri-box" onClick={() => copyToClipboard(`olcrtc://${status.config.S_PROVIDER}?${status.config.S_TRANSPORT}@${status.config.S_ROOM_ID}#${status.config.S_ENC_KEY}%${status.config.S_CLIENT_ID}$OlcRTC_Server`)}>
                <div className="uri-label">📥 URI для Olcbox (нажмите для копирования)</div>
                <div className="uri-value">
                  olcrtc://{status.config.S_PROVIDER}?{status.config.S_TRANSPORT}@{status.config.S_ROOM_ID}#{status.config.S_ENC_KEY}%{status.config.S_CLIENT_ID}$OlcRTC_Server
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="card">
            <div className="card-title">🛠 Управление</div>
            <div className="btn-row">
              <button className="btn btn-sm btn-blue" onClick={() => { setPage('install'); setError(null); setSuccess(null); }}>
                ⚙️ Переконфигурировать
              </button>
              <button className="btn btn-sm btn-red" disabled={loading} onClick={() => {
                if (window.confirm('Вы уверены? Это полностью удалит OlcRTC с сервера.')) {
                  handleAction('uninstall');
                }
              }}>
                🗑 Удалить OlcRTC
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
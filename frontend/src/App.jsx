import React, { useState, useEffect, useRef } from 'react';

const TRANSPORT_INFO = {
  vp8channel: { label: 'vp8channel', desc: 'Высокая скорость', rec: true },
  datachannel: { label: 'datachannel', desc: 'Максимальная скорость' },
  seichannel: { label: 'seichannel', desc: 'Средняя скорость' },
  videochannel: { label: 'videochannel', desc: 'Низкая скорость' },
};

const PROVIDER_WARN = {
  jazz: { datachannel: '⚠️ Jazz забанит IP за datachannel!' },
  telemost: { datachannel: '❌ Не поддерживается', seichannel: '❌ Не поддерживается' },
};

const PROVIDER_REC = { telemost: 'vp8channel', wbstream: 'datachannel', jazz: 'vp8channel' };

export default function App() {
  const [page, setPage] = useState('loading');
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [logs, setLogs] = useState('');
  const [showLogs, setShowLogs] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [provTransports, setProvTransports] = useState({});
  const [selProvider, setSelProvider] = useState('telemost');
  const [copied, setCopied] = useState('');
  const [installMode, setInstallMode] = useState('full');
  const logsRef = useRef(null);

  useEffect(() => { fetchStatus(); fetchTransports(); }, []);

  const fetchStatus = async () => {
    try {
      const r = await fetch('/api/status');
      const d = await r.json();
      setStatus(d);
      setPage('menu');
    } catch { setPage('menu'); }
  };

  const fetchTransports = async () => {
    try {
      const r = await fetch('/api/provider_transports');
      setProvTransports(await r.json());
    } catch {}
  };

  const fetchLogs = async () => {
    try {
      const r = await fetch('/api/logs?lines=100');
      const d = await r.json();
      setLogs(d.logs || d.error || '');
      setTimeout(() => { if (logsRef.current) logsRef.current.scrollTop = logsRef.current.scrollHeight; }, 50);
    } catch { setLogs('Ошибка загрузки'); }
  };

  const handleInstall = async (e) => {
    e.preventDefault();
    setInstalling(true); setError(null); setSuccess(null);
    const fd = new FormData(e.target);
    const endpoint = installMode === 'reconfig' ? '/api/reconfigure' : '/api/install';
    try {
      const r = await fetch(endpoint, { method: 'POST', body: fd });
      const d = await r.json();
      if (d.success) {
        setSuccess(installMode === 'reconfig' ? 'Конфигурация обновлена!' : 'OlcRTC установлен и запущен!');
        await fetchStatus(); setPage('dashboard');
      } else { setError(`Ошибка (${d.step || '?'}): ${d.error}`); }
    } catch { setError('Ошибка сети'); }
    finally { setInstalling(false); }
  };

  const doAction = async (action, body) => {
    setLoading(true); setError(null); setSuccess(null);
    try {
      const r = await fetch(`/api/${action}`, { method: 'POST', ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
      const d = await r.json();
      if (d.success) {
        const msgs = { stop: 'Остановлен', start: 'Запущен', restart: 'Перезапущен', uninstall: 'Удалён', update_binary: 'Обновлён' };
        setSuccess(msgs[action] || 'Готово');
        if (action === 'uninstall') { setPage('menu'); }
        await fetchStatus();
      } else { setError(d.error || 'Ошибка'); }
    } catch { setError('Ошибка сети'); }
    finally { setLoading(false); }
  };

  const copy = (text, label) => {
    navigator.clipboard.writeText(text);
    setCopied(label); setTimeout(() => setCopied(''), 1500);
  };

  const providerLabel = { telemost: 'Yandex Telemost', wbstream: 'WB Stream', jazz: 'Sber SaluteJazz' };
  const cfg = status?.config || {};
  const uri = cfg.S_PROVIDER ? `olcrtc://${cfg.S_PROVIDER}?${cfg.S_TRANSPORT}@${cfg.S_ROOM_ID}#${cfg.S_ENC_KEY}%${cfg.S_CLIENT_ID}$OlcRTC_Server` : '';
  const availTransports = provTransports[selProvider] || ['vp8channel', 'videochannel'];

  return (
    <div className="root">
      <style>{`
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400&display=swap');
:root{--bg:#0a0e1a;--card:#111827;--text:#f1f5f9;--muted:#64748b;--accent:#10b981;--ah:#059669;--blue:#3b82f6;--red:#ef4444;--yellow:#f59e0b;--purple:#8b5cf6;--border:rgba(255,255,255,.06);--ibg:#1e293b;--ib:#334155}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',system-ui,sans-serif;background:var(--bg);color:var(--text);min-height:100vh}
.root{width:100%;max-width:700px;min-width:0;margin:0 auto;padding:20px 14px}
.hdr{text-align:center;padding:28px 0 20px}
.logo{font-size:30px;font-weight:700;background:linear-gradient(135deg,#10b981,#3b82f6);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.sub{color:var(--muted);font-size:13px;margin-top:3px}
.chip{display:inline-block;margin-top:8px;padding:3px 12px;background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.2);border-radius:16px;font-size:11px;color:var(--accent);font-family:'JetBrains Mono',monospace}
.sysinfo{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:6px}
.card{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:24px;margin-bottom:14px;width:100%}
.menu-item{display:flex;align-items:center;gap:12px;padding:14px 18px;background:rgba(0,0,0,.15);border:1px solid var(--border);border-radius:12px;margin-bottom:8px;cursor:pointer;transition:.2s;font-size:14px;font-weight:500}
.menu-item:hover{background:rgba(16,185,129,.08);border-color:rgba(16,185,129,.2)}
.menu-item .mi-icon{font-size:20px;width:32px;text-align:center}
.menu-item .mi-desc{font-size:11px;color:var(--muted);font-weight:400;margin-top:2px}
.menu-sep{border:none;border-top:1px solid var(--border);margin:12px 0}
.ct{font-size:17px;font-weight:600;margin-bottom:14px;display:flex;align-items:center;gap:8px}
.sr{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:rgba(0,0,0,.2);border-radius:10px;margin-bottom:10px}
.dot{width:9px;height:9px;border-radius:50%;display:inline-block;margin-right:7px}
.dot.on{background:#10b981;box-shadow:0 0 8px rgba(16,185,129,.5);animation:pulse 2s infinite}
.dot.off{background:#ef4444;box-shadow:0 0 6px rgba(239,68,68,.3)}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
.cg{display:grid;gap:6px}
.ci{display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:rgba(0,0,0,.15);border-radius:8px;font-size:13px}
.cl{color:var(--muted);font-size:12px}
.cv{font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--accent);cursor:pointer;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cv:hover{color:#34d399}
.ub{margin-top:14px;padding:12px;background:rgba(139,92,246,.08);border:1px solid rgba(139,92,246,.2);border-radius:10px;cursor:pointer}
.ub:hover{background:rgba(139,92,246,.14)}
.ul{font-size:11px;color:var(--purple);font-weight:600;text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px}
.uv{font-family:'JetBrains Mono',monospace;font-size:10px;color:#c4b5fd;word-break:break-all;line-height:1.4}
.fg{margin-bottom:16px}
.fl{display:block;font-size:12px;font-weight:500;color:var(--muted);margin-bottom:5px}
.fi,.fs{width:100%;padding:11px 12px;background:var(--ibg);border:1px solid var(--ib);border-radius:9px;color:var(--text);font-size:14px;font-family:'Inter',sans-serif;outline:none;transition:.2s}
.fi:focus,.fs:focus{border-color:var(--accent);box-shadow:0 0 0 2px rgba(16,185,129,.15)}
.fs option{background:var(--card)}
.fh{font-size:10px;color:var(--muted);margin-top:3px}
.fw{font-size:11px;color:var(--yellow);margin-top:3px}
.btn{padding:10px 16px;border:none;border-radius:9px;font-size:13px;font-weight:600;cursor:pointer;transition:.2s;font-family:'Inter',sans-serif;display:inline-flex;align-items:center;gap:6px;justify-content:center}
.btn:disabled{opacity:.4;cursor:not-allowed}
.bp{width:100%;background:var(--accent);color:#fff;padding:13px;font-size:14px;margin-top:4px}
.bp:hover:not(:disabled){background:var(--ah);transform:translateY(-1px)}
.bs{padding:7px 14px;font-size:12px;border-radius:7px}
.bg{background:rgba(16,185,129,.12);color:var(--accent);border:1px solid rgba(16,185,129,.2)}
.bg:hover:not(:disabled){background:rgba(16,185,129,.22)}
.bb{background:rgba(59,130,246,.12);color:var(--blue);border:1px solid rgba(59,130,246,.2)}
.bb:hover:not(:disabled){background:rgba(59,130,246,.22)}
.br{background:rgba(239,68,68,.08);color:var(--red);border:1px solid rgba(239,68,68,.15)}
.br:hover:not(:disabled){background:rgba(239,68,68,.18)}
.by{background:rgba(245,158,11,.08);color:var(--yellow);border:1px solid rgba(245,158,11,.15)}
.by:hover:not(:disabled){background:rgba(245,158,11,.18)}
.brow{display:flex;gap:7px;flex-wrap:wrap}
.alert{padding:12px 14px;border-radius:10px;font-size:13px;margin-bottom:14px;animation:si .3s;display:flex;align-items:flex-start;gap:8px}
.ae{background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);color:#fca5a5}
.as{background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.2);color:#6ee7b7}
@keyframes si{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
.lc{background:#0d1117;border:1px solid var(--border);border-radius:10px;padding:14px;margin-top:10px;max-height:350px;overflow-y:auto}
.lt{font-family:'JetBrains Mono',monospace;font-size:11px;color:#8b949e;line-height:1.6;white-space:pre-wrap;word-break:break-all}
.spinner{width:44px;height:44px;border:3px solid rgba(16,185,129,.2);border-radius:50%;border-top-color:var(--accent);animation:spin 1s linear infinite;margin:0 auto 16px}
@keyframes spin{to{transform:rotate(360deg)}}
.ip{text-align:center;padding:36px 16px}
.tabs{display:flex;gap:4px;margin-bottom:16px;background:rgba(0,0,0,.2);padding:4px;border-radius:10px}
.tab{flex:1;padding:8px;text-align:center;border-radius:7px;font-size:12px;font-weight:500;cursor:pointer;color:var(--muted);transition:.2s}
.tab.active{background:var(--accent);color:#fff}
.tab:hover:not(.active){color:var(--text)}
@media(max-width:480px){.root{padding:14px 10px}.card{padding:18px 14px}.brow{flex-direction:column}.cv{max-width:160px}}
      `}</style>

      <div className="hdr">
        <div className="logo">OlcRTC Panel</div>
        <div className="sub">Панель управления прокси-сервером</div>
        {status?.server_ip && <div className="chip">🖥 {status.server_ip}</div>}
        {status && (
          <div className="sysinfo">
            {status.ram && <div className="chip">RAM {status.ram}</div>}
            {status.disk && <div className="chip">Диск {status.disk}</div>}
          </div>
        )}
      </div>

      {error && <div className="alert ae"><span>⚠️</span><span>{error}</span></div>}
      {success && <div className="alert as"><span>✅</span><span>{success}</span></div>}

      {page === 'loading' && <div className="ip"><div className="spinner"/><div style={{color:'var(--accent)',fontWeight:500}}>Загрузка...</div></div>}

      {/* ══════ MAIN MENU ══════ */}
      {page === 'menu' && (
        <div className="card">
          <div className="ct">📋 Главное меню</div>
          <div className="menu-item" onClick={() => { setInstallMode(status?.installed ? 'reconfig' : 'full'); setPage('install'); setError(null); setSuccess(null); }}>
            <span className="mi-icon">🚀</span>
            <div><div>{status?.installed ? 'Настроить OlcRTC' : 'Установить OlcRTC'}</div><div className="mi-desc">{status?.installed ? 'Изменить конфигурацию или переустановить' : 'Полная установка и настройка'}</div></div>
          </div>
          {status?.installed && (<>
            <div className="menu-item" onClick={() => { setPage('dashboard'); setError(null); setSuccess(null); }}>
              <span className="mi-icon">📊</span>
              <div><div>Статус и реквизиты</div><div className="mi-desc">Посмотреть конфигурацию, URI, ключи</div></div>
            </div>
            <div className="menu-item" onClick={() => { setShowLogs(true); fetchLogs(); setPage('logs'); setError(null); }}>
              <span className="mi-icon">📋</span>
              <div><div>Логи сервера</div><div className="mi-desc">Просмотр журнала работы OlcRTC</div></div>
            </div>
            <hr className="menu-sep"/>
            <div className="menu-item" onClick={() => { if(window.confirm('Полностью удалить OlcRTC?')) doAction('uninstall'); }}>
              <span className="mi-icon">🗑</span>
              <div><div style={{color:'var(--red)'}}>Удалить OlcRTC</div><div className="mi-desc">Остановить и удалить все файлы</div></div>
            </div>
          </>)}
        </div>
      )}

      {/* ══════ LOGS PAGE ══════ */}
      {page === 'logs' && (
        <div className="card">
          <div className="ct">📋 Логи сервера</div>
          <div className="brow" style={{marginBottom:10}}>
            <button className="btn bs bb" onClick={fetchLogs}>🔄 Обновить</button>
            <button className="btn bs" style={{background:'transparent',border:'1px solid var(--ib)',color:'var(--muted)'}} onClick={() => setPage('menu')}>← Меню</button>
          </div>
          <div className="lc" ref={logsRef} style={{maxHeight:500}}>
            <pre className="lt">{logs || 'Загрузка...'}</pre>
          </div>
        </div>
      )}

      {/* ══════ INSTALL / RECONFIG ══════ */}
      {page === 'install' && !installing && (
        <div className="card">
          <div className="ct">🚀 {installMode === 'reconfig' ? 'Изменить конфигурацию' : 'Установка OlcRTC'}</div>

          {status?.installed && (
            <div className="tabs">
              <div className={`tab ${installMode==='reconfig'?'active':''}`} onClick={()=>setInstallMode('reconfig')}>⚙️ Переконфигурация</div>
              <div className={`tab ${installMode==='full'?'active':''}`} onClick={()=>setInstallMode('full')}>🔄 Переустановка</div>
            </div>
          )}

          <form onSubmit={handleInstall}>
            {/* Провайдер */}
            <div className="fg">
              <label className="fl">Провайдер</label>
              <select name="provider" className="fs" value={selProvider} onChange={e => setSelProvider(e.target.value)}>
                <option value="telemost">Yandex Telemost — стабильно работает</option>
                <option value="wbstream">WB Stream — стабильно работает</option>
                <option value="jazz">Sber SaluteJazz — работает нестабильно</option>
              </select>
            </div>

            {/* Транспорт */}
            <div className="fg">
              <label className="fl">Транспорт</label>
              <select name="transport" className="fs" defaultValue={PROVIDER_REC[selProvider]}>
                {availTransports.map(t => {
                  const info = TRANSPORT_INFO[t] || {};
                  const warn = PROVIDER_WARN[selProvider]?.[t];
                  return (
                    <option key={t} value={t}>
                      {info.label || t} — {info.desc || ''} {info.rec || t === PROVIDER_REC[selProvider] ? '(рекомендуется)' : ''} {warn || ''}
                    </option>
                  );
                })}
              </select>
              {selProvider === 'jazz' && <div className="fw">⚠️ datachannel — Jazz банит IP за этот трафик!</div>}
              {selProvider === 'telemost' && <div className="fw">ℹ️ Telemost поддерживает только vp8channel и videochannel</div>}
            </div>

            {/* Ссылка на комнату */}
            <div className="fg">
              <label className="fl">Ссылка на комнату или ID</label>
              <input name="room" className="fi" required placeholder={
                selProvider === 'jazz' ? 'https://salutejazz.ru/calls/xxxxx?psw=...' :
                selProvider === 'telemost' ? 'https://telemost.yandex.ru/j/xxxxx' :
                'https://stream.wb.ru/room/xxxxx'
              } defaultValue={cfg.S_ROOM_ID || ''} />
              <div className="fh">Вставьте полную ссылку — ID и пароль будут извлечены автоматически</div>
            </div>

            {/* Имя бота (Jazz) */}
            {selProvider === 'jazz' && (
              <div className="fg">
                <label className="fl">Имя бота в конференции</label>
                <input name="bot_name" className="fi" placeholder="Случайное русское имя" defaultValue={cfg.S_BOT_NAME || ''} />
              </div>
            )}

            {/* Ключ шифрования */}
            <div className="fg">
              <label className="fl">Ключ шифрования (hex, 64 символа)</label>
              <input name="enc_key" className="fi" placeholder="Оставьте пустым для авто-генерации" defaultValue={installMode==='reconfig' ? (cfg.S_ENC_KEY||'') : ''} />
              <div className="fh">Автоматически сгенерируется надёжный ключ</div>
            </div>

            {/* ID клиента */}
            <div className="fg">
              <label className="fl">ID клиента</label>
              <input name="client_id" className="fi" placeholder="Оставьте пустым для авто-генерации" defaultValue={installMode==='reconfig' ? (cfg.S_CLIENT_ID||'') : ''} />
            </div>

            <button type="submit" className="btn bp" disabled={installing}>
              {installMode === 'reconfig' ? '⚙️ Применить конфигурацию' : '🚀 Установить и запустить'}
            </button>

            {status?.installed && (
              <button type="button" className="btn bp" style={{marginTop:8,background:'transparent',border:'1px solid var(--ib)',color:'var(--muted)'}} onClick={() => { setPage('menu'); setError(null); setSuccess(null); }}>
                ← Назад в меню
              </button>
            )}
          </form>
        </div>
      )}

      {/* Install progress */}
      {installing && (
        <div className="card"><div className="ip">
          <div className="spinner"/>
          <div style={{color:'var(--accent)',fontWeight:500,fontSize:15}}>
            {installMode === 'reconfig' ? 'Применяем конфигурацию...' : 'Установка OlcRTC'}
          </div>
          {installMode !== 'reconfig' && (
            <div style={{color:'var(--muted)',fontSize:12,marginTop:10,lineHeight:1.6}}>
              Первая установка включает компиляцию Go-бинарника.<br/>
              Это может занять 5–30 минут. Не закрывайте страницу!
            </div>
          )}
        </div></div>
      )}

      {/* ══════ DASHBOARD ══════ */}
      {page === 'dashboard' && status && (<>
        {/* Status */}
        <div className="card">
          <div className="ct">📊 Статус</div>
          <div className="sr">
            <div style={{display:'flex',alignItems:'center'}}>
              <span className={`dot ${status.running?'on':'off'}`}/>
              <span style={{fontWeight:600}}>{status.running ? 'Работает' : 'Остановлен'}</span>
            </div>
            {status.uptime && <span style={{color:'var(--muted)',fontSize:12}}>{status.uptime}</span>}
          </div>
          {status.has_update && (
            <div className="alert" style={{background:'rgba(59,130,246,.08)',border:'1px solid rgba(59,130,246,.2)',color:'#93c5fd',marginBottom:10}}>
              <span>🔄</span><span>Доступно обновление OlcRTC</span>
            </div>
          )}
          <div className="brow">
            {status.running ? (<>
              <button className="btn bs by" disabled={loading} onClick={()=>doAction('restart')}>🔄 Перезапуск</button>
              <button className="btn bs br" disabled={loading} onClick={()=>doAction('stop')}>⏹ Стоп</button>
            </>) : (
              <button className="btn bs bg" disabled={loading} onClick={()=>doAction('start')}>▶️ Запуск</button>
            )}
            <button className="btn bs bb" onClick={()=>{setShowLogs(!showLogs);if(!showLogs)fetchLogs();}}>📋 {showLogs?'Скрыть':'Логи'}</button>
            {status.has_update && (
              <button className="btn bs bb" disabled={loading} onClick={()=>{if(window.confirm('Обновить бинарник? Это займёт 5-30 минут.'))doAction('update_binary')}}>⬆️ Обновить</button>
            )}
          </div>
          {showLogs && (
            <div className="lc" ref={logsRef}>
              <pre className="lt">{logs||'Загрузка...'}</pre>
              <button className="btn bs bb" style={{marginTop:8}} onClick={fetchLogs}>🔄 Обновить</button>
            </div>
          )}
        </div>

        {/* Config */}
        {cfg.S_PROVIDER && (
          <div className="card">
            <div className="ct">⚙️ Конфигурация</div>
            <div className="cg">
              {[
                ['Провайдер', providerLabel[cfg.S_PROVIDER]||cfg.S_PROVIDER, cfg.S_PROVIDER],
                ['Транспорт', cfg.S_TRANSPORT, cfg.S_TRANSPORT],
                ['ID звонка', cfg.S_ROOM_ID, cfg.S_ROOM_ID],
                ['Ключ шифрования', cfg.S_ENC_KEY, cfg.S_ENC_KEY],
                ['ID клиента', cfg.S_CLIENT_ID, cfg.S_CLIENT_ID],
              ].map(([label, display, val]) => (
                <div className="ci" key={label}>
                  <span className="cl">{label}</span>
                  <span className="cv" title="Копировать" onClick={()=>copy(val,label)}>
                    {copied===label ? '✓' : display}
                  </span>
                </div>
              ))}
              {cfg.S_BOT_NAME && (
                <div className="ci"><span className="cl">Имя бота</span><span className="cv">{cfg.S_BOT_NAME}</span></div>
              )}
            </div>

            {uri && (
              <div className="ub" onClick={()=>copy(uri,'uri')}>
                <div className="ul">📥 URI для Olcbox {copied==='uri'?'— Скопировано!':'(нажмите)'}</div>
                <div className="uv">{uri}</div>
              </div>
            )}

            <div style={{marginTop:12,padding:10,background:'rgba(0,0,0,.15)',borderRadius:8}}>
              <div style={{fontSize:11,color:'var(--muted)',marginBottom:4}}>📥 Скачайте Olcbox:</div>
              <a href="https://github.com/alananisimov/olcbox/releases" target="_blank" rel="noreferrer" style={{fontSize:12,color:'var(--blue)'}}>github.com/alananisimov/olcbox/releases</a>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="card">
          <div className="ct">🛠 Управление</div>
          <div className="brow">
            <button className="btn bs bb" onClick={()=>{setInstallMode('reconfig');setPage('install');setError(null);setSuccess(null);}}>⚙️ Изменить настройки</button>
            <button className="btn bs br" disabled={loading} onClick={()=>{if(window.confirm('Полностью удалить OlcRTC?'))doAction('uninstall')}}>🗑 Удалить</button>
            <button className="btn bs" style={{background:'transparent',border:'1px solid var(--ib)',color:'var(--muted)'}} onClick={()=>setPage('menu')}>← Меню</button>
          </div>
        </div>
      </>)}
    </div>
  );
}
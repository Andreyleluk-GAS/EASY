import React, { useState, useEffect, useRef } from 'react';
const TREC = { telemost:'vp8channel', wbstream:'datachannel', jazz:'vp8channel' };
const TINFO = { vp8channel:'Высокая скорость', datachannel:'Макс. скорость', seichannel:'Средняя скорость', videochannel:'Низкая скорость' };
const PCOLORS = { telemost:'#ffcc00', wbstream:'#cb11ab', jazz:'#2196f3' };
const PLABELS = { telemost:'Yandex Telemost', wbstream:'WB Stream', jazz:'Sber SaluteJazz' };

export default function App() {
  const [page, setPage] = useState('loading');
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [logs, setLogs] = useState('');
  const [installing, setInstalling] = useState(false);
  const [pt, setPt] = useState({});
  const [prov, setProv] = useState('telemost');
  const [copied, setCopied] = useState('');
  const [mode, setMode] = useState('full');
  const [room, setRoom] = useState('');
  const [encKey, setEncKey] = useState('');
  const [clientId, setClientId] = useState('');
  const [botName, setBotName] = useState('');
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const logsRef = useRef(null);

  useEffect(() => { load(); fetch('/api/provider_transports').then(r=>r.json()).then(setPt).catch(()=>{}); }, []);

  const load = async () => {
    try { const r = await fetch('/api/status'); const d = await r.json(); setStatus(d); setPage('menu'); }
    catch { setPage('menu'); }
  };

  const getLogs = async () => {
    try { const r = await fetch('/api/logs?lines=100'); const d = await r.json(); setLogs(d.logs||d.error||''); setTimeout(()=>{if(logsRef.current)logsRef.current.scrollTop=logsRef.current.scrollHeight;},50); } catch { setLogs('Ошибка'); }
  };

  const handleInstall = async (e) => {
    e.preventDefault(); setInstalling(true); setError(null); setSuccess(null);
    const fd = new FormData(e.target);
    const ep = mode==='reconfig' ? '/api/reconfigure' : '/api/install';
    try { const r = await fetch(ep,{method:'POST',body:fd}); const d = await r.json();
      if(d.success){setSuccess(mode==='reconfig'?'Конфигурация обновлена!':'OlcRTC установлен!'); await load(); setPage('dashboard');}
      else setError(`Ошибка (${d.step||'?'}): ${d.error}`);
    } catch { setError('Ошибка сети'); } finally { setInstalling(false); }
  };

  const act = async (a) => {
    setLoading(true); setError(null); setSuccess(null);
    try { const r = await fetch(`/api/${a}`,{method:'POST'}); const d = await r.json();
      if(d.success){setSuccess({stop:'Остановлен',start:'Запущен',restart:'Перезапущен',uninstall:'Удалён',update_binary:'Обновлён'}[a]||'OK');if(a==='uninstall')setPage('menu'); await load();}
      else setError(d.error||'Ошибка');
    } catch { setError('Ошибка сети'); } finally { setLoading(false); }
  };

  const copy = (t,l) => { navigator.clipboard.writeText(t); setCopied(l); setTimeout(()=>setCopied(''),2000); };

  // Ссылка на конференцию из сохранённого конфига
  const getInviteLink = () => {
    if (!cfg.S_PROVIDER || !cfg.S_ROOM_ID) return '';
    const links = { telemost:`https://telemost.yandex.ru/j/${cfg.S_ROOM_ID}`, wbstream:`https://stream.wb.ru/room/${cfg.S_ROOM_ID}`, jazz:`https://salutejazz.ru/calls/${cfg.S_ROOM_ID}` };
    return links[cfg.S_PROVIDER] || '';
  };
  const clearFields = () => { setRoom(''); setEncKey(''); setClientId(''); setBotName(''); };
  const onProvChange = (v) => { setProv(v); setRoom(''); setEncKey(''); setClientId(''); setBotName(''); };

  const checkUpdate = async () => {
    setCheckingUpdate(true); setError(null); setSuccess(null);
    try { const r = await fetch('/api/status'); const d = await r.json(); setStatus(d);
      if(d.has_update) { if(window.confirm('Доступно обновление OlcRTC!\nОбновить сейчас? Настройки сохранятся.\nЭто может занять 5-30 минут.')) { await act('update_binary'); } else { setSuccess('Обновление отложено'); } }
      else setSuccess('У вас актуальная версия OlcRTC');
    } catch { setError('Не удалось проверить обновления'); } finally { setCheckingUpdate(false); }
  };

  const cfg = status?.config || {};
  const uri = cfg.S_PROVIDER ? `olcrtc://${cfg.S_PROVIDER}?${cfg.S_TRANSPORT}@${cfg.S_ROOM_ID}#${cfg.S_ENC_KEY}%${cfg.S_CLIENT_ID}$OlcRTC_Server` : '';
  const avail = pt[prov] || ['vp8channel','videochannel'];

  return (
    <div className="root">
      <style>{`
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400&display=swap');
:root{--bg:#d6dae0;--card:#fff;--text:#1a1a2e;--muted:#52575e;--accent:#0ea5e9;--ah:#0284c7;--green:#22c55e;--red:#ef4444;--yellow:#eab308;--purple:#8b5cf6;--border:#c8cdd3;--ibg:#eef0f3;--ib:#b8bdc4}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',system-ui,sans-serif;background:var(--bg);color:var(--text);min-height:100vh}
.root{width:100%;max-width:680px;margin:0 auto;padding:20px 14px}
.hdr{text-align:center;padding:24px 0 16px}
.logo{font-size:32px;font-weight:700;color:var(--text)}
.logo span{background:linear-gradient(135deg,#0ea5e9,#8b5cf6);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.sub{color:var(--muted);font-size:14px;margin-top:3px}
.chips{display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin-top:8px}
.chip{padding:3px 10px;background:#e0f2fe;border-radius:12px;font-size:10px;color:#0369a1;font-family:'JetBrains Mono',monospace}
.card{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:24px;margin-bottom:14px;width:100%;box-shadow:0 1px 3px rgba(0,0,0,.04)}
.ct{font-size:18px;font-weight:600;margin-bottom:14px;display:flex;align-items:center;gap:8px}
.mi{display:flex;align-items:center;gap:14px;padding:15px 18px;background:var(--ibg);border:1px solid var(--border);border-radius:12px;margin-bottom:8px;cursor:pointer;transition:.15s;font-size:15px;font-weight:500}
.mi:hover{background:#e0f2fe;border-color:#bae6fd;transform:translateX(2px)}
.mi .ic{font-size:22px;width:36px;min-width:36px;text-align:center;flex-shrink:0}
.mi .ds{font-size:12px;color:var(--muted);font-weight:400;margin-top:2px}
.sep{border:none;border-top:1px solid var(--border);margin:10px 0}
.sr{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--ibg);border-radius:10px;margin-bottom:10px}
.dot{width:9px;height:9px;border-radius:50%;display:inline-block;margin-right:6px}
.dot.on{background:var(--green);box-shadow:0 0 6px rgba(34,197,94,.4);animation:p 2s infinite}
.dot.off{background:var(--red);box-shadow:0 0 4px rgba(239,68,68,.3)}
@keyframes p{0%,100%{opacity:1}50%{opacity:.5}}
.cg{display:grid;gap:5px}
.ci{display:flex;justify-content:space-between;align-items:center;padding:9px 14px;background:var(--ibg);border-radius:8px;font-size:14px;cursor:pointer;transition:.1s;position:relative;overflow:visible}
.ci:hover{background:#e0f2fe}
.cl{color:var(--muted);font-size:13px}
.cv{font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--accent);max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.toast{position:absolute;top:-30px;right:10px;background:#1e293b;color:#22c55e;padding:4px 12px;border-radius:7px;font-size:12px;font-weight:500;opacity:0;transform:translateY(6px);transition:.25s;pointer-events:none;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,.15)}
.toast.show{opacity:1;transform:translateY(0)}
.join-btn{display:inline-flex;align-items:center;gap:6px;padding:6px 14px;background:linear-gradient(135deg,rgba(14,165,233,.1),rgba(139,92,246,.1));border:1px solid rgba(14,165,233,.25);border-radius:8px;color:var(--accent);font-size:12px;font-weight:500;cursor:pointer;transition:.15s;text-decoration:none;font-family:'Inter',sans-serif;margin-left:auto}
.join-btn:hover{background:linear-gradient(135deg,rgba(14,165,233,.2),rgba(139,92,246,.18));border-color:rgba(14,165,233,.4);transform:translateY(-1px);box-shadow:0 2px 8px rgba(14,165,233,.15)}
.ub{margin-top:12px;padding:14px;background:#f0f0ff;border:1px solid #e0e0ff;border-radius:10px;cursor:pointer;transition:.15s;position:relative}
.ub:hover{background:#e8e8ff;border-color:#c7c7ff}
.ub .toast-uri{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:#1e293b;color:#22c55e;padding:8px 20px;border-radius:10px;font-size:14px;font-weight:600;opacity:0;transition:.2s;pointer-events:none;z-index:2}
.ub.copied-uri .toast-uri{opacity:1}
.ul{font-size:11px;color:var(--purple);font-weight:600;text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px}
.uv{font-family:'JetBrains Mono',monospace;font-size:11px;color:#6366f1;word-break:break-all;line-height:1.5}
.fg{margin-bottom:16px}
.fl{display:block;font-size:13px;font-weight:500;color:var(--muted);margin-bottom:5px}
.fi,.fs{width:100%;padding:12px 14px;background:var(--ibg);border:1px solid var(--ib);border-radius:10px;color:var(--text);font-size:15px;font-family:'Inter',sans-serif;outline:none;transition:.2s}
.fi:focus,.fs:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(14,165,233,.12)}
.fs option{background:#fff}
.fh{font-size:10px;color:var(--muted);margin-top:3px}
.fw{font-size:11px;color:#b45309;margin-top:3px;background:#fef3c7;padding:4px 8px;border-radius:6px;display:inline-block}
.btn{padding:10px 16px;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;transition:.15s;font-family:'Inter',sans-serif;display:inline-flex;align-items:center;gap:6px;justify-content:center}
.btn:disabled{opacity:.4;cursor:not-allowed}
.bp{width:100%;background:var(--accent);color:#fff;padding:13px;font-size:14px;margin-top:4px;border-radius:12px}
.bp:hover:not(:disabled){background:var(--ah);transform:translateY(-1px);box-shadow:0 4px 12px rgba(14,165,233,.2)}
.bs{padding:7px 14px;font-size:12px;border-radius:8px}
.bg{background:#dcfce7;color:#15803d;border:1px solid #bbf7d0}
.bg:hover:not(:disabled){background:#bbf7d0}
.bb{background:#dbeafe;color:#1d4ed8;border:1px solid #bfdbfe}
.bb:hover:not(:disabled){background:#bfdbfe}
.br{background:#fee2e2;color:#dc2626;border:1px solid #fecaca}
.br:hover:not(:disabled){background:#fecaca}
.by{background:#fef9c3;color:#a16207;border:1px solid #fde68a}
.by:hover:not(:disabled){background:#fde68a}
.brow{display:flex;gap:7px;flex-wrap:wrap}
.bghost{background:transparent;border:1px solid var(--ib);color:var(--muted)}
.bghost:hover{background:var(--ibg)}
.alert{padding:12px 14px;border-radius:10px;font-size:13px;margin-bottom:14px;animation:si .3s;display:flex;align-items:flex-start;gap:8px}
.ae{background:#fee2e2;border:1px solid #fecaca;color:#b91c1c}
.as{background:#dcfce7;border:1px solid #bbf7d0;color:#15803d}
@keyframes si{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
.lc{background:#1e293b;border-radius:10px;padding:14px;margin-top:10px;max-height:400px;overflow-y:auto}
.lt{font-family:'JetBrains Mono',monospace;font-size:11px;color:#94a3b8;line-height:1.6;white-space:pre-wrap;word-break:break-all;text-align:left}
.spinner{width:40px;height:40px;border:3px solid #e5e7eb;border-radius:50%;border-top-color:var(--accent);animation:spin 1s linear infinite;margin:0 auto 14px}
@keyframes spin{to{transform:rotate(360deg)}}
.ip{text-align:center;padding:30px 16px}
.tabs{display:flex;gap:3px;margin-bottom:16px;background:var(--ibg);padding:3px;border-radius:10px;border:1px solid var(--border)}
.tab{flex:1;padding:8px;text-align:center;border-radius:8px;font-size:12px;font-weight:500;cursor:pointer;color:var(--muted);transition:.2s}
.tab.active{background:var(--accent);color:#fff;box-shadow:0 2px 6px rgba(14,165,233,.2)}
.prov-badge{display:inline-block;padding:2px 8px;border-radius:5px;font-size:11px;font-weight:600;color:#fff;margin-left:6px}
.prov-badge.yandex{color:#1a1a2e}
.clear-row{display:flex;justify-content:flex-end;margin-bottom:8px}
.clear-btn{background:none;border:1px solid var(--ib);padding:5px 12px;border-radius:8px;font-size:11px;color:var(--muted);cursor:pointer;font-family:'Inter',sans-serif;transition:.15s}
.clear-btn:hover{background:#fee2e2;border-color:#fecaca;color:#dc2626}
@media(max-width:480px){.root{padding:14px 10px}.card{padding:18px 14px}.brow{flex-direction:column}.cv{max-width:150px}}
      `}</style>

      <div className="hdr">
        <div className="logo"><span>OlcRTC</span> Panel</div>
        <div className="sub">Панель управления прокси-сервером</div>
        {status && <div className="chips">
          {status.server_ip && <div className="chip">🖥 {status.server_ip}</div>}
          {status.ram && <div className="chip">RAM {status.ram}</div>}
          {status.disk && <div className="chip">💾 {status.disk}</div>}
        </div>}
      </div>

      {error && <div className="alert ae"><span>⚠️</span><span>{error}</span></div>}
      {success && <div className="alert as"><span>✅</span><span>{success}</span></div>}

      {page==='loading' && <div className="ip"><div className="spinner"/><div style={{color:'var(--accent)',fontWeight:500}}>Загрузка...</div></div>}

      {/* ══ MENU ══ */}
      {page==='menu' && <div className="card">
        <div className="ct">📋 Главное меню</div>
        <div className="mi" onClick={()=>{setMode(status?.installed?'reconfig':'full');setPage('install');setError(null);setSuccess(null);clearFields();}}>
          <span className="ic">🚀</span>
          <div><div>{status?.installed?'Настроить OlcRTC':'Установить OlcRTC'}</div><div className="ds">{status?.installed?'Изменить конфигурацию или переустановить':'Полная установка и настройка'}</div></div>
        </div>
        {status?.installed && <>
          <div className="mi" onClick={()=>{setPage('dashboard');setError(null);setSuccess(null);}}>
            <span className="ic">📊</span><div><div>Статус и реквизиты</div><div className="ds">Конфигурация, URI, ключи</div></div>
          </div>
          <div className="mi" onClick={()=>{getLogs();setPage('logs');setError(null);}}>
            <span className="ic">📋</span><div><div>Логи сервера</div><div className="ds">Журнал работы OlcRTC</div></div>
          </div>
          <div className="mi" onClick={checkUpdate} style={{opacity:checkingUpdate?.5:1}}>
            <span className="ic">🔄</span><div><div>Проверить обновления</div><div className="ds">{checkingUpdate?'Проверяем...':'Обновить ядро OlcRTC без удаления настроек'}</div></div>
          </div>
          <hr className="sep"/>
          <div className="mi" onClick={()=>{if(window.confirm('Полностью удалить OlcRTC?'))act('uninstall');}}>
            <span className="ic">🗑</span><div><div style={{color:'var(--red)'}}>Удалить OlcRTC</div><div className="ds">Остановить и удалить все файлы</div></div>
          </div>
        </>}
      </div>}

      {/* ══ LOGS ══ */}
      {page==='logs' && <div className="card">
        <div className="ct">📋 Логи сервера</div>
        <div className="brow" style={{marginBottom:10}}>
          <button className="btn bs bb" onClick={getLogs}>🔄 Обновить</button>
          <button className="btn bs bghost" onClick={()=>setPage('menu')}>← Меню</button>
        </div>
        <div className="lc" ref={logsRef} style={{maxHeight:500}}><pre className="lt">{logs||'Загрузка...'}</pre></div>
      </div>}

      {/* ══ INSTALL ══ */}
      {page==='install' && !installing && <div className="card">
        <div className="ct">🚀 {mode==='reconfig'?'Изменить конфигурацию':'Установка OlcRTC'}</div>
        {status?.installed && <div className="tabs">
          <div className={`tab ${mode==='reconfig'?'active':''}`} onClick={()=>setMode('reconfig')}>⚙️ Переконфигурация</div>
          <div className={`tab ${mode==='full'?'active':''}`} onClick={()=>setMode('full')}>🔄 Переустановка</div>
        </div>}
        <form onSubmit={handleInstall}>
          <div className="fg">
            <label className="fl">Провайдер</label>
            <select name="provider" className="fs" value={prov} onChange={e=>onProvChange(e.target.value)} style={{borderLeft:`4px solid ${PCOLORS[prov]}`}}>
              <option value="telemost">Yandex Telemost — стабильно работает</option>
              <option value="wbstream">WB Stream — стабильно работает</option>
              <option value="jazz">Sber SaluteJazz — работает нестабильно</option>
            </select>
          </div>
          <div className="fg">
            <label className="fl">Транспорт</label>
            <select name="transport" className="fs" defaultValue={TREC[prov]}>
              {avail.map(t=><option key={t} value={t}>{t} — {TINFO[t]||''} {t===TREC[prov]?'(рекомендуется)':''}</option>)}
            </select>
            {prov==='jazz' && <div className="fw">⚠️ datachannel — Jazz банит IP!</div>}
            {prov==='telemost' && <div className="fw">ℹ️ Telemost: только vp8channel и videochannel</div>}
          </div>

          <div className="clear-row"><button type="button" className="clear-btn" onClick={clearFields}>🧹 Очистить поля</button></div>

          <div className="fg">
            <label className="fl">Ссылка на комнату или ID</label>
            <input name="room" className="fi" required value={room} onChange={e=>setRoom(e.target.value)} placeholder={prov==='jazz'?'https://salutejazz.ru/calls/xxxxx?psw=...':prov==='telemost'?'https://telemost.yandex.ru/j/xxxxx':'https://stream.wb.ru/room/xxxxx'}/>
            <div className="fh">Вставьте полную ссылку — ID и пароль извлекутся автоматически</div>
          </div>
          {prov==='jazz' && <div className="fg">
            <label className="fl">Имя бота в конференции</label>
            <input name="bot_name" className="fi" value={botName} onChange={e=>setBotName(e.target.value)} placeholder="Случайное русское имя"/>
          </div>}
          <div className="fg">
            <label className="fl">Ключ шифрования (hex, 64 символа)</label>
            <input name="enc_key" className="fi" value={encKey} onChange={e=>setEncKey(e.target.value)} placeholder="Авто-генерация"/>
            <div className="fh">Оставьте пустым — сгенерируется надёжный ключ</div>
          </div>
          <div className="fg">
            <label className="fl">ID клиента</label>
            <input name="client_id" className="fi" value={clientId} onChange={e=>setClientId(e.target.value)} placeholder="Авто-генерация"/>
          </div>
          <button type="submit" className="btn bp">{mode==='reconfig'?'⚙️ Применить конфигурацию':'🚀 Установить и запустить'}</button>
          <button type="button" className="btn bp bghost" style={{marginTop:8}} onClick={()=>{setPage('menu');setError(null);setSuccess(null);}}>← Назад в меню</button>
        </form>
      </div>}

      {installing && <div className="card"><div className="ip">
        <div className="spinner"/>
        <div style={{color:'var(--accent)',fontWeight:500,fontSize:15}}>{mode==='reconfig'?'Применяем конфигурацию...':'Установка OlcRTC'}</div>
        {mode!=='reconfig' && <div style={{color:'var(--muted)',fontSize:12,marginTop:10,lineHeight:1.6}}>Первая установка: 5–30 мин. Не закрывайте страницу!</div>}
      </div></div>}

      {/* ══ DASHBOARD ══ */}
      {page==='dashboard' && status && <>
        <div className="card">
          <div className="ct">📊 Статус</div>
          <div className="sr">
            <div style={{display:'flex',alignItems:'center'}}>
              <span className={`dot ${status.running?'on':'off'}`}/>
              <span style={{fontWeight:600}}>{status.running?'Работает':'Остановлен'}</span>
            </div>
            {status.uptime && <span style={{color:'var(--muted)',fontSize:12}}>{status.uptime}</span>}
          </div>
          {status.has_update && <div className="alert" style={{background:'#dbeafe',border:'1px solid #bfdbfe',color:'#1e40af',marginBottom:10}}><span>🔄</span><span>Доступно обновление</span></div>}
          <div className="brow">
            {status.running ? <>
              <button className="btn bs by" disabled={loading} onClick={()=>act('restart')}>🔄 Перезапуск</button>
              <button className="btn bs br" disabled={loading} onClick={()=>act('stop')}>⏹ Стоп</button>
            </> : <button className="btn bs bg" disabled={loading} onClick={()=>act('start')}>▶️ Запуск</button>}
            {status.has_update && <button className="btn bs bb" disabled={loading} onClick={()=>{if(window.confirm('Обновить? 5-30 мин.'))act('update_binary')}}>⬆️ Обновить</button>}
          </div>
        </div>

        {cfg.S_PROVIDER && <div className="card">
          <div className="ct" style={{flexWrap:'wrap',gap:'8px'}}>⚙️ Конфигурация <span className={`prov-badge ${cfg.S_PROVIDER==='telemost'?'yandex':''}`} style={{background:PCOLORS[cfg.S_PROVIDER]||'#666'}}>{PLABELS[cfg.S_PROVIDER]||cfg.S_PROVIDER}</span>{getInviteLink() && <a href={getInviteLink()} target="_blank" rel="noreferrer" className="join-btn">🌐 Войти в конференцию</a>}</div>
          <div className="cg">
            {[['Провайдер',PLABELS[cfg.S_PROVIDER]||cfg.S_PROVIDER],['Транспорт',cfg.S_TRANSPORT],['ID звонка',cfg.S_ROOM_ID],['Ключ шифрования',cfg.S_ENC_KEY],['ID клиента',cfg.S_CLIENT_ID]].map(([l,v])=>
              <div className="ci" key={l} onClick={()=>copy(v,l)}><span className="cl">{l}</span><span className="cv">{v}</span><span className={`toast ${copied===l?'show':''}`}>✓ Скопировано</span></div>
            )}
            {cfg.S_BOT_NAME && <div className="ci" onClick={()=>copy(cfg.S_BOT_NAME,'bot')}><span className="cl">Имя бота</span><span className="cv">{cfg.S_BOT_NAME}</span><span className={`toast ${copied==='bot'?'show':''}`}>✓ Скопировано</span></div>}
          </div>
          {uri && <div className={`ub ${copied==='uri'?'copied-uri':''}`} onClick={()=>copy(uri,'uri')}>
            <div className="toast-uri">✓ Скопировано в буфер!</div>
            <div className="ul">📥 URI для Olcbox (нажмите для копирования)</div>
            <div className="uv">{uri}</div>
          </div>}
          <div style={{marginTop:10,padding:8,background:'var(--ibg)',borderRadius:8}}>
            <div style={{fontSize:11,color:'var(--muted)',marginBottom:3}}>📥 Olcbox:</div>
            <a href="https://github.com/alananisimov/olcbox/releases" target="_blank" rel="noreferrer" style={{fontSize:12,color:'var(--accent)'}}>github.com/alananisimov/olcbox/releases</a>
          </div>
        </div>}

        <div className="card">
          <div className="ct">🛠 Управление</div>
          <div className="brow">
            <button className="btn bs bb" onClick={()=>{setMode('reconfig');setPage('install');setError(null);setSuccess(null);clearFields();}}>⚙️ Настройки</button>
            <button className="btn bs br" disabled={loading} onClick={()=>{if(window.confirm('Удалить OlcRTC?'))act('uninstall')}}>🗑 Удалить</button>
            <button className="btn bs bghost" onClick={()=>setPage('menu')}>← Меню</button>
          </div>
        </div>
      </>}
    </div>
  );
}
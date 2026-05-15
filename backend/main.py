import paramiko
import time
import os
import socket
import logging
from fastapi import FastAPI, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse

# Настраиваем логирование для отладки
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SSH_TIMEOUT = 20  # секунд — увеличен для облачных сред


def create_ipv4_socket(hostname, port):
    """Создаёт сокет с принудительным IPv4 (Railway может использовать IPv6 по умолчанию)."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(SSH_TIMEOUT)
    sock.connect((hostname, port))
    return sock


def ssh_connect(ip, username, password, timeout=SSH_TIMEOUT):
    """Подключение SSH с принудительным IPv4."""
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    logger.info(f"Попытка SSH подключения к {ip}:22 (IPv4, таймаут {timeout}с)")
    
    try:
        # Принудительно используем IPv4-сокет
        sock = create_ipv4_socket(ip, 22)
        logger.info(f"TCP соединение с {ip}:22 установлено, запускаем SSH-хэндшейк")
        
        ssh.connect(
            hostname=ip,
            username=username,
            password=password,
            timeout=timeout,
            sock=sock,
            look_for_keys=False,
            allow_agent=False
        )
        logger.info(f"SSH подключение к {ip} успешно")
        return ssh
    except Exception:
        ssh.close()
        raise


@app.post("/api/verify_ssh")
def verify_ssh(
    ip: str = Form(...),
    username: str = Form(...),
    password: str = Form(...)
):
    try:
        ssh = ssh_connect(ip, username, password)
        ssh.close()
        return {"success": True}
    except paramiko.AuthenticationException:
        return {"success": False, "error": "Неверный логин или пароль."}
    except socket.timeout:
        return {"success": False, "error": f"Таймаут при подключении к {ip}:22. Сервер не отвечает (порт 22 недоступен из облака)."}
    except ConnectionRefusedError:
        return {"success": False, "error": f"Соединение отклонено {ip}:22. SSH-сервер не запущен или порт закрыт."}
    except OSError as e:
        return {"success": False, "error": f"Сетевая ошибка при подключении к {ip}: {str(e)}"}
    except Exception as e:
        logger.error(f"SSH ошибка для {ip}: {type(e).__name__}: {e}")
        return {"success": False, "error": f"Не удалось подключиться: {type(e).__name__}: {str(e)}"}


@app.get("/api/diagnose/{ip}")
def diagnose_connectivity(ip: str):
    """Диагностический эндпоинт — проверяет сетевое подключение к серверу."""
    results = {}
    
    # 1. DNS-резолвинг
    try:
        resolved = socket.getaddrinfo(ip, 22, socket.AF_INET, socket.SOCK_STREAM)
        results["dns_resolve"] = {"ok": True, "addresses": [r[4][0] for r in resolved]}
    except Exception as e:
        results["dns_resolve"] = {"ok": False, "error": str(e)}
    
    # 2. TCP подключение к порту 22
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(10)
        start = time.time()
        sock.connect((ip, 22))
        elapsed = round(time.time() - start, 2)
        
        # Попробуем прочитать SSH-баннер
        banner = ""
        try:
            banner = sock.recv(256).decode("utf-8", errors="replace").strip()
        except Exception:
            pass
        sock.close()
        results["tcp_port_22"] = {"ok": True, "latency_sec": elapsed, "ssh_banner": banner}
    except socket.timeout:
        results["tcp_port_22"] = {"ok": False, "error": "Таймаут — порт 22 недоступен (фаервол или сервер не отвечает)"}
    except ConnectionRefusedError:
        results["tcp_port_22"] = {"ok": False, "error": "Порт 22 закрыт (Connection Refused)"}
    except Exception as e:
        results["tcp_port_22"] = {"ok": False, "error": str(e)}
    
    # 3. Собственный IP Railway-контейнера
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        results["container_ip"] = s.getsockname()[0]
        s.close()
    except Exception:
        results["container_ip"] = "не определён"
    
    return results


def run_ssh_install(ip, username, password, provider, transport, room, bot_name):
    try:
        ssh = ssh_connect(ip, username, password)
        
        ssh.exec_command("wget -qO install.sh 'https://raw.githubusercontent.com/Andreyleluk-GAS/LE-Olcrtc/main/install-olcrtc.sh' && chmod +x install.sh")
        time.sleep(2)
        
        install_cmd = f'(echo "{provider}"; sleep 1; echo "{transport}"; sleep 1; echo "{room}"; sleep 1; echo "{bot_name}") | ./install.sh'
        
        stdin, stdout, stderr = ssh.exec_command(install_cmd)
        
        exit_status = stdout.channel.recv_exit_status()
        ssh.exec_command("rm -f install.sh")
        ssh.close()
        
        if exit_status == 0:
            return True, None
        else:
            return False, stderr.read().decode("utf-8")

    except Exception as e:
        logger.error(f"Ошибка установки на {ip}: {type(e).__name__}: {e}")
        return False, f"{type(e).__name__}: {str(e)}"

@app.post("/api/install")
def install_bot(
    ip: str = Form(...),
    username: str = Form(...),
    password: str = Form(...),
    provider: str = Form(...),
    transport: str = Form(...),
    room: str = Form(...),
    bot_name: str = Form(...)
):
    success, error = run_ssh_install(ip, username, password, provider, transport, room, bot_name)
    
    if success:
        return {"success": True, "link": room}
    else:
        return {"success": False, "error": error}


# --- РАЗДАЧА ФРОНТЕНДА (REACT) ---
frontend_dist = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")

if os.path.exists(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="static")

@app.exception_handler(404)
async def custom_404_handler(request, exc):
    index_path = os.path.join(frontend_dist, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return JSONResponse({"error": "Frontend not built yet or API route not found"}, status_code=404)
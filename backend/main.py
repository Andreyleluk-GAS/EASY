import subprocess
import os
import time
import logging
import shutil
from fastapi import FastAPI, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse

# Настраиваем логирование
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

# ==========================================
# Утилиты
# ==========================================

ENV_FILE = "/opt/olcrtc/.env"
SERVICE_FILE = "/etc/systemd/system/olcrtc.service"
BINARY_PATH = "/opt/olcrtc/olcrtc"
INSTALL_SCRIPT_URL = "https://raw.githubusercontent.com/Andreyleluk-GAS/LE-Olcrtc/main/install-olcrtc.sh"


def run_cmd(cmd, timeout=600):
    """Выполняет команду локально и возвращает (success, stdout, stderr)."""
    try:
        result = subprocess.run(
            cmd, shell=True, capture_output=True, text=True, timeout=timeout
        )
        return result.returncode == 0, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        return False, "", "Команда превысила таймаут"
    except Exception as e:
        return False, "", str(e)


def get_status():
    """Получает текущий статус OlcRTC."""
    info = {
        "installed": os.path.exists(BINARY_PATH),
        "service_exists": os.path.exists(SERVICE_FILE),
        "running": False,
        "config": None,
    }

    if info["service_exists"]:
        ok, stdout, _ = run_cmd("systemctl is-active olcrtc")
        info["running"] = stdout.strip() == "active"

    if os.path.exists(ENV_FILE):
        config = {}
        try:
            with open(ENV_FILE, "r") as f:
                for line in f:
                    line = line.strip()
                    if "=" in line and not line.startswith("#"):
                        key, val = line.split("=", 1)
                        config[key] = val.strip('"').strip("'")
            info["config"] = config
        except Exception:
            pass

    return info


# ==========================================
# API Эндпоинты
# ==========================================

@app.get("/api/status")
def api_status():
    """Возвращает статус установки OlcRTC."""
    status = get_status()

    # Добавляем системную информацию
    ok, stdout, _ = run_cmd("hostname -I 2>/dev/null | awk '{print $1}'")
    status["server_ip"] = stdout.strip() if ok else "неизвестно"

    ok, stdout, _ = run_cmd("uptime -p 2>/dev/null || uptime")
    status["uptime"] = stdout.strip() if ok else "неизвестно"

    # Лог последних строк
    if status["service_exists"]:
        ok, stdout, _ = run_cmd("journalctl -u olcrtc -n 10 --no-pager 2>/dev/null")
        status["recent_logs"] = stdout.strip() if ok else ""

    return status


@app.get("/api/logs")
def api_logs(lines: int = 50):
    """Возвращает логи OlcRTC."""
    ok, stdout, stderr = run_cmd(f"journalctl -u olcrtc -n {lines} --no-pager 2>/dev/null")
    if ok:
        return {"success": True, "logs": stdout}
    return {"success": False, "error": stderr or "Не удалось получить логи"}


@app.post("/api/install")
def api_install(
    provider: str = Form(...),
    transport: str = Form(...),
    room: str = Form(...),
    bot_name: str = Form(""),
    enc_key: str = Form(""),
    client_id: str = Form(""),
):
    """Запускает установку OlcRTC на этом сервере."""
    logger.info(f"Начинаем установку: provider={provider}, transport={transport}")

    # Маппинг провайдеров
    provider_map = {"1": "telemost", "2": "wbstream", "3": "jazz"}
    provider_name = provider_map.get(provider, provider)

    # Маппинг транспорта
    transport_map = {
        "1": "vp8channel", "2": "videochannel",
        "3": "seichannel", "4": "datachannel"
    }
    transport_name = transport_map.get(transport, transport)

    # Парсинг Room ID из ссылки
    room_id = room
    full_invite_link = room
    s_room_psw_hash = ""
    s_room_password = ""

    if "http" in room:
        # Извлекаем ID из ссылки
        parts = room.split("?")[0].rstrip("/").split("/")
        room_id = parts[-1] if parts else room

        # Для Jazz — извлекаем psw hash
        if provider_name == "jazz" and "?psw=" in room:
            s_room_psw_hash = room.split("?psw=")[1].split("&")[0]
    else:
        # Формируем ссылку из ID
        if provider_name == "telemost":
            full_invite_link = f"https://telemost.yandex.ru/j/{room_id}"
        elif provider_name == "wbstream":
            full_invite_link = f"https://stream.wb.ru/room/{room_id}"
        elif provider_name == "jazz":
            full_invite_link = f"https://salutejazz.ru/calls/{room_id}"

    # Генерация ключа и client_id если не заданы
    if not enc_key:
        ok, stdout, _ = run_cmd("openssl rand -hex 32")
        enc_key = stdout.strip() if ok else "0" * 64
    if not client_id:
        ok, stdout, _ = run_cmd("openssl rand -hex 4")
        client_id = stdout.strip() if ok else "abcd1234"

    # Генерация имени бота для Jazz
    if provider_name == "jazz" and not bot_name:
        import random
        names = ["Александр", "Мария", "Иван", "Елена", "Дмитрий", "Анна", "Сергей", "Ольга"]
        bot_name = random.choice(names)

    # --- Шаг 1: Проверяем, установлен ли бинарник ---
    need_build = not os.path.exists(BINARY_PATH)

    if need_build:
        logger.info("Бинарник не найден, запускаем полную установку...")

        # Загрузка и запуск install-olcrtc.sh в неинтерактивном режиме
        # Для этого используем переменные окружения вместо интерактивного ввода
        install_env = os.environ.copy()
        install_env["DEBIAN_FRONTEND"] = "noninteractive"
        install_env["NEEDRESTART_MODE"] = "a"

        # Сначала ставим зависимости
        logger.info("Установка зависимостей...")
        run_cmd("apt-get update -q && apt-get install -yq git build-essential ffmpeg", timeout=300)

        # Проверяем Go
        ok, _, _ = run_cmd("go version")
        if not ok:
            logger.info("Установка Go...")
            go_cmds = """
            GO_VERSION=$(curl -sL https://go.dev/VERSION?m=text | head -n 1 | tr -d '[:space:]')
            rm -rf /usr/local/go
            wget -q -O /tmp/go.tar.gz "https://go.dev/dl/${GO_VERSION}.linux-amd64.tar.gz"
            tar -C /usr/local -xzf /tmp/go.tar.gz
            rm -f /tmp/go.tar.gz
            ln -sf /usr/local/go/bin/go /usr/bin/go
            ln -sf /usr/local/go/bin/gofmt /usr/bin/gofmt
            """
            ok, _, err = run_cmd(go_cmds, timeout=300)
            if not ok:
                return {"success": False, "error": f"Ошибка установки Go: {err}", "step": "go"}

        # Устанавливаем Mage
        logger.info("Установка Mage...")
        mage_cmds = """
        export PATH="/usr/local/go/bin:$PATH"
        export GOPATH=~/go
        mkdir -p ~/go/bin ~/go/tmp ~/go/cache
        cd ~ && rm -rf mage && git clone -q https://github.com/magefile/mage && cd mage && /usr/local/go/bin/go run bootstrap.go
        """
        ok, _, err = run_cmd(mage_cmds, timeout=300)
        if not ok:
            return {"success": False, "error": f"Ошибка установки Mage: {err}", "step": "mage"}

        # Клонируем и собираем OlcRTC
        logger.info("Сборка OlcRTC...")

        # Jazz-патч если нужно
        jazz_patch = ""
        if provider_name == "jazz":
            jazz_patch = f"""
            if wget -qO jazz_patcher.sh "https://raw.githubusercontent.com/Andreyleluk-GAS/LE-Olcrtc/main/jazz_patcher.sh" 2>/dev/null; then
                chmod +x jazz_patcher.sh
                ./jazz_patcher.sh "{bot_name}" "{s_room_psw_hash}" "{s_room_password}"
                rm -f jazz_patcher.sh
            fi
            """

        build_cmds = f"""
        export PATH="/usr/local/go/bin:$HOME/go/bin:$PATH"
        export GOPATH=~/go
        export GOTMPDIR=~/go/tmp
        export GOCACHE=~/go/cache
        export GOMAXPROCS=1
        export GOFLAGS="-p=1"
        mkdir -p ~/go/tmp ~/go/cache
        cd ~ && rm -rf olcrtc
        git clone -q https://github.com/openlibrecommunity/olcrtc.git --recurse-submodules
        cd ~/olcrtc
        {jazz_patch}
        ~/go/bin/mage build
        mkdir -p /opt/olcrtc/data
        cp build/olcrtc-linux-amd64 /opt/olcrtc/olcrtc
        cd ~/olcrtc && git rev-parse HEAD > /opt/olcrtc/.local_version
        cd ~ && rm -rf olcrtc mage ~/go/tmp ~/go/cache
        """
        ok, stdout, err = run_cmd(build_cmds, timeout=1800)  # до 30 минут на сборку
        if not ok:
            return {"success": False, "error": f"Ошибка сборки OlcRTC: {err[-500:]}", "step": "build"}

    # --- Шаг 2: Применяем конфигурацию ---
    logger.info("Применяем конфигурацию...")

    # Формирование флагов транспорта
    transport_flags = {
        "vp8channel": "-vp8-fps 60 -vp8-batch 64",
        "seichannel": "-fps 60 -batch 64 -frag 900 -ack-ms 2000",
        "videochannel": "-video-codec qrcode -video-w 1080 -video-h 1080 -video-fps 60 -video-bitrate 5000k -video-hw none",
        "datachannel": "",
    }.get(transport_name, "")

    # Создаём systemd сервис
    service_content = f"""[Unit]
Description=OlcRTC Proxy Server
After=network.target

# FullLink={full_invite_link}
[Service]
Type=simple
User=root
WorkingDirectory=/opt/olcrtc
ExecStart=/opt/olcrtc/olcrtc -mode srv -carrier {provider_name} -transport {transport_name} -link direct -dns 1.1.1.1:53 -data data -id "{room_id}" -key "{enc_key}" -client-id "{client_id}" {transport_flags}
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
"""
    try:
        with open(SERVICE_FILE, "w") as f:
            f.write(service_content)
    except Exception as e:
        return {"success": False, "error": f"Не удалось создать сервис: {e}", "step": "service"}

    # Сохраняем конфигурацию
    env_content = f"""S_PROVIDER="{provider_name}"
S_TRANSPORT="{transport_name}"
S_ROOM_ID="{room_id}"
S_ENC_KEY="{enc_key}"
S_CLIENT_ID="{client_id}"
S_ROOM_PASSWORD="{s_room_password}"
S_ROOM_PSW_HASH="{s_room_psw_hash}"
S_BOT_NAME="{bot_name}"
"""
    os.makedirs("/opt/olcrtc", exist_ok=True)
    with open(ENV_FILE, "w") as f:
        f.write(env_content)
    os.chmod(ENV_FILE, 0o600)

    # Перезапускаем сервис
    run_cmd("systemctl daemon-reload")
    run_cmd("systemctl enable olcrtc")
    run_cmd("systemctl restart olcrtc")
    time.sleep(2)

    # Проверяем статус
    ok, stdout, _ = run_cmd("systemctl is-active olcrtc")
    is_running = stdout.strip() == "active"

    # Формируем URI для Olcbox
    olcrtc_uri = f"olcrtc://{provider_name}?{transport_name}@{room_id}#{enc_key}%{client_id}$OlcRTC_Server"

    return {
        "success": True,
        "running": is_running,
        "config": {
            "provider": provider_name,
            "transport": transport_name,
            "room_id": room_id,
            "enc_key": enc_key,
            "client_id": client_id,
            "bot_name": bot_name,
            "invite_link": full_invite_link,
            "olcrtc_uri": olcrtc_uri,
        }
    }


@app.post("/api/stop")
def api_stop():
    """Останавливает OlcRTC."""
    run_cmd("systemctl stop olcrtc")
    return {"success": True}


@app.post("/api/start")
def api_start():
    """Запускает OlcRTC."""
    run_cmd("systemctl start olcrtc")
    time.sleep(1)
    ok, stdout, _ = run_cmd("systemctl is-active olcrtc")
    return {"success": True, "running": stdout.strip() == "active"}


@app.post("/api/restart")
def api_restart():
    """Перезапускает OlcRTC."""
    run_cmd("systemctl restart olcrtc")
    time.sleep(2)
    ok, stdout, _ = run_cmd("systemctl is-active olcrtc")
    return {"success": True, "running": stdout.strip() == "active"}


@app.post("/api/uninstall")
def api_uninstall():
    """Полностью удаляет OlcRTC."""
    run_cmd("systemctl stop olcrtc")
    run_cmd("systemctl disable olcrtc")
    run_cmd(f"rm -f {SERVICE_FILE}")
    run_cmd("systemctl daemon-reload")
    run_cmd("rm -rf /opt/olcrtc")
    return {"success": True}


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
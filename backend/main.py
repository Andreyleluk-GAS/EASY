import subprocess
import os
import time
import logging
import random
import re
from fastapi import FastAPI, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

ENV_FILE = "/opt/olcrtc/.env"
SERVICE_FILE = "/etc/systemd/system/olcrtc.service"
BINARY_PATH = "/opt/olcrtc/olcrtc"
VERSION_FILE = "/opt/olcrtc/.local_version"
REPO_URL = "https://github.com/openlibrecommunity/olcrtc.git"
JAZZ_PATCHER_URL = "https://raw.githubusercontent.com/Andreyleluk-GAS/LE-Olcrtc/main/jazz_patcher.sh"

RU_NAMES = ["Александр","Мария","Иван","Елена","Дмитрий","Анна","Сергей","Ольга","Михаил","Екатерина","Виктор","Наталья"]

TRANSPORT_FLAGS = {
    "vp8channel": "-vp8-fps 60 -vp8-batch 64",
    "seichannel": "-fps 60 -batch 64 -frag 900 -ack-ms 2000",
    "videochannel": "-video-codec qrcode -video-w 1080 -video-h 1080 -video-fps 60 -video-bitrate 5000k -video-hw none",
    "datachannel": "",
}

# Допустимые транспорты для каждого провайдера (из install-olcrtc.sh)
PROVIDER_TRANSPORTS = {
    "telemost": ["vp8channel", "videochannel"],
    "wbstream": ["datachannel", "vp8channel", "seichannel", "videochannel"],
    "jazz": ["vp8channel", "seichannel", "videochannel", "datachannel"],
}


def run_cmd(cmd, timeout=600):
    try:
        r = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=timeout)
        return r.returncode == 0, r.stdout, r.stderr
    except subprocess.TimeoutExpired:
        return False, "", "Таймаут"
    except Exception as e:
        return False, "", str(e)


def parse_room_url(url, provider):
    """Парсит ссылку на комнату, как в install-olcrtc.sh."""
    room_id = url
    full_link = url
    psw_hash = ""
    password = ""

    if "http" in url:
        full_link = url
        if provider == "jazz":
            # parse_jazz_url logic
            if "?psw=" in url:
                psw_hash = url.split("?psw=")[1].split("&")[0]
                if len(psw_hash) < 10:
                    psw_hash = ""
            if "pwd=" in url:
                pwd_part = url.split("pwd=")[1].split("&")[0]
                if not psw_hash and pwd_part:
                    password = pwd_part
            temp = url.split("?")[0]
            room_id = temp.rstrip("/").split("/")[-1]
        else:
            parts = url.split("?")[0].rstrip("/").split("/")
            room_id = parts[-1] if parts else url
    else:
        links = {
            "telemost": f"https://telemost.yandex.ru/j/{url}",
            "wbstream": f"https://stream.wb.ru/room/{url}",
            "jazz": f"https://salutejazz.ru/calls/{url}",
        }
        full_link = links.get(provider, url)

    return room_id, full_link, psw_hash, password


def read_env():
    config = {}
    if os.path.exists(ENV_FILE):
        try:
            with open(ENV_FILE) as f:
                for line in f:
                    line = line.strip()
                    if "=" in line and not line.startswith("#"):
                        k, v = line.split("=", 1)
                        config[k] = v.strip('"').strip("'")
        except Exception:
            pass
    return config


def get_full_status():
    info = {
        "installed": os.path.exists(BINARY_PATH),
        "service_exists": os.path.exists(SERVICE_FILE),
        "running": False,
        "config": None,
        "has_update": False,
    }
    if info["service_exists"]:
        ok, out, _ = run_cmd("systemctl is-active olcrtc")
        info["running"] = out.strip() == "active"
    cfg = read_env()
    if cfg:
        info["config"] = cfg
    # Проверка обновлений
    if os.path.exists(VERSION_FILE):
        ok, remote, _ = run_cmd(f'git ls-remote "{REPO_URL}" HEAD 2>/dev/null | awk \'{{print $1}}\'')
        if ok and remote.strip():
            try:
                local = open(VERSION_FILE).read().strip()
                info["has_update"] = local != remote.strip()
            except Exception:
                info["has_update"] = True
    elif info["installed"]:
        info["has_update"] = True
    return info


# ─────── API ───────

@app.get("/api/status")
def api_status():
    status = get_full_status()
    ok, out, _ = run_cmd("hostname -I 2>/dev/null | awk '{print $1}'")
    status["server_ip"] = out.strip() if ok else ""
    ok, out, _ = run_cmd("uptime -p 2>/dev/null || uptime")
    status["uptime"] = out.strip() if ok else ""
    # Disk
    ok, out, _ = run_cmd("df -h / --output=avail,size,pcent | tail -1")
    status["disk"] = out.strip() if ok else ""
    # RAM
    ok, out, _ = run_cmd("free -h | awk '/Mem:/{print $3\"/\"$2}'")
    status["ram"] = out.strip() if ok else ""
    return status


@app.get("/api/logs")
def api_logs(lines: int = 50):
    ok, out, err = run_cmd(f"journalctl -u olcrtc -n {lines} --no-pager 2>/dev/null")
    return {"success": ok, "logs": out if ok else "", "error": err if not ok else ""}


@app.get("/api/provider_transports")
def api_provider_transports():
    """Возвращает допустимые транспорты для каждого провайдера."""
    return PROVIDER_TRANSPORTS


@app.post("/api/install")
def api_install(
    provider: str = Form(...),
    transport: str = Form(...),
    room: str = Form(...),
    bot_name: str = Form(""),
    enc_key: str = Form(""),
    client_id: str = Form(""),
):
    logger.info(f"Установка: provider={provider}, transport={transport}, room={room}")

    prov_map = {"1": "telemost", "2": "wbstream", "3": "jazz"}
    prov = prov_map.get(provider, provider)

    trans_map = {"1": "vp8channel", "2": "videochannel", "3": "seichannel", "4": "datachannel"}
    trans = trans_map.get(transport, transport)

    # Валидация транспорта
    allowed = PROVIDER_TRANSPORTS.get(prov, [])
    if allowed and trans not in allowed:
        return {"success": False, "error": f"Транспорт {trans} не поддерживается для {prov}. Допустимые: {', '.join(allowed)}", "step": "validate"}

    room_id, full_link, psw_hash, password = parse_room_url(room, prov)
    if not room_id:
        return {"success": False, "error": "ID комнаты не может быть пустым", "step": "validate"}

    if not enc_key:
        ok, out, _ = run_cmd("openssl rand -hex 32")
        enc_key = out.strip() if ok else os.urandom(32).hex()
    if not client_id:
        ok, out, _ = run_cmd("openssl rand -hex 4")
        client_id = out.strip() if ok else os.urandom(4).hex()
    if prov == "jazz" and not bot_name:
        bot_name = random.choice(RU_NAMES)

    # ── Сборка если нужно ──
    need_build = not os.path.exists(BINARY_PATH)

    if need_build:
        logger.info("Бинарник не найден → полная установка")

        # 1. Зависимости
        run_cmd("apt-get update -q && apt-get install -yq git build-essential ffmpeg", timeout=300)

        # 2. Go
        ok, _, _ = run_cmd("/usr/local/go/bin/go version 2>/dev/null || go version")
        if not ok:
            logger.info("Установка Go...")
            ok, _, err = run_cmd("""
                GO_VERSION=$(curl -sL https://go.dev/VERSION?m=text | head -n 1 | tr -d '[:space:]')
                rm -rf /usr/local/go
                wget -q -O /tmp/go.tar.gz "https://go.dev/dl/${GO_VERSION}.linux-amd64.tar.gz"
                tar -C /usr/local -xzf /tmp/go.tar.gz && rm -f /tmp/go.tar.gz
                ln -sf /usr/local/go/bin/go /usr/bin/go
                ln -sf /usr/local/go/bin/gofmt /usr/bin/gofmt
            """, timeout=300)
            if not ok:
                return {"success": False, "error": f"Ошибка установки Go: {err[:300]}", "step": "go"}

        # 3. Mage
        logger.info("Установка Mage...")
        ok, _, err = run_cmd("""
            export PATH="/usr/local/go/bin:$PATH" && export GOPATH=~/go
            mkdir -p ~/go/bin ~/go/tmp ~/go/cache
            cd ~ && rm -rf mage && git clone -q https://github.com/magefile/mage && cd mage && /usr/local/go/bin/go run bootstrap.go
        """, timeout=300)
        if not ok:
            return {"success": False, "error": f"Ошибка Mage: {err[:300]}", "step": "mage"}

        # 4. Swap для защиты от OOM
        run_cmd("""
            swapoff -a 2>/dev/null || true; rm -f /swapfile 2>/dev/null || true
            fallocate -l 2G /swapfile 2>/dev/null || true; chmod 600 /swapfile 2>/dev/null || true
            mkswap /swapfile >/dev/null 2>&1 || true; swapon /swapfile 2>/dev/null || true
        """)

        # 5. Очистка перед сборкой
        run_cmd("apt-get clean -q 2>/dev/null; /usr/local/go/bin/go clean -cache 2>/dev/null; journalctl --vacuum-size=50M 2>/dev/null")

        # 6. Клонирование + Jazz-патч + Сборка
        jazz_patch = ""
        if prov == "jazz":
            jazz_patch = f"""
                if wget -qO jazz_patcher.sh "{JAZZ_PATCHER_URL}" 2>/dev/null; then
                    chmod +x jazz_patcher.sh && ./jazz_patcher.sh "{bot_name}" "{psw_hash}" "{password}" && rm -f jazz_patcher.sh
                fi
            """

        ok, _, err = run_cmd(f"""
            export PATH="/usr/local/go/bin:$HOME/go/bin:$PATH"
            export GOPATH=~/go GOTMPDIR=~/go/tmp GOCACHE=~/go/cache GOMAXPROCS=1 GOFLAGS="-p=1"
            mkdir -p ~/go/tmp ~/go/cache
            cd ~ && rm -rf olcrtc
            git clone -q {REPO_URL} --recurse-submodules && cd ~/olcrtc
            {jazz_patch}
            ~/go/bin/mage build
            mkdir -p /opt/olcrtc/data
            cp build/olcrtc-linux-amd64 /opt/olcrtc/olcrtc
            cd ~/olcrtc && git rev-parse HEAD > {VERSION_FILE}
            cd ~ && rm -rf olcrtc mage ~/go/tmp ~/go/cache
        """, timeout=1800)
        if not ok:
            return {"success": False, "error": f"Ошибка сборки: {err[-400:]}", "step": "build"}

    # ── Применяем конфигурацию ──
    flags = TRANSPORT_FLAGS.get(trans, "")
    service = f"""[Unit]
Description=OlcRTC Proxy Server
After=network.target

# FullLink={full_link}
[Service]
Type=simple
User=root
WorkingDirectory=/opt/olcrtc
ExecStart=/opt/olcrtc/olcrtc -mode srv -carrier {prov} -transport {trans} -link direct -dns 1.1.1.1:53 -data data -id "{room_id}" -key "{enc_key}" -client-id "{client_id}" {flags}
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
"""
    os.makedirs("/opt/olcrtc", exist_ok=True)
    with open(SERVICE_FILE, "w") as f:
        f.write(service)

    env = f'S_PROVIDER="{prov}"\nS_TRANSPORT="{trans}"\nS_ROOM_ID="{room_id}"\nS_ENC_KEY="{enc_key}"\nS_CLIENT_ID="{client_id}"\nS_ROOM_PASSWORD="{password}"\nS_ROOM_PSW_HASH="{psw_hash}"\nS_BOT_NAME="{bot_name}"\n'
    with open(ENV_FILE, "w") as f:
        f.write(env)
    os.chmod(ENV_FILE, 0o600)

    run_cmd("systemctl daemon-reload && systemctl enable olcrtc && systemctl restart olcrtc")
    time.sleep(2)

    ok, out, _ = run_cmd("systemctl is-active olcrtc")
    uri = f"olcrtc://{prov}?{trans}@{room_id}#{enc_key}%{client_id}$OlcRTC_Server"

    return {
        "success": True,
        "running": out.strip() == "active",
        "config": {
            "provider": prov, "transport": trans, "room_id": room_id,
            "enc_key": enc_key, "client_id": client_id, "bot_name": bot_name,
            "invite_link": full_link, "olcrtc_uri": uri,
            "psw_hash": psw_hash,
        }
    }


@app.post("/api/reconfigure")
def api_reconfigure(
    provider: str = Form(...),
    transport: str = Form(...),
    room: str = Form(...),
    bot_name: str = Form(""),
    enc_key: str = Form(""),
    client_id: str = Form(""),
):
    """Только изменить конфигурацию без пересборки бинарника."""
    if not os.path.exists(BINARY_PATH):
        return {"success": False, "error": "OlcRTC не установлен. Сначала выполните установку."}
    return api_install(provider=provider, transport=transport, room=room, bot_name=bot_name, enc_key=enc_key, client_id=client_id)


@app.post("/api/update_binary")
def api_update_binary():
    """Обновить только бинарник без изменения настроек."""
    if not os.path.exists(BINARY_PATH):
        return {"success": False, "error": "OlcRTC не установлен"}

    cfg = read_env()
    prov = cfg.get("S_PROVIDER", "telemost")
    bot_name = cfg.get("S_BOT_NAME", "")
    psw_hash = cfg.get("S_ROOM_PSW_HASH", "")
    password = cfg.get("S_ROOM_PASSWORD", "")

    jazz_patch = ""
    if prov == "jazz" and bot_name:
        jazz_patch = f"""
            if wget -qO jazz_patcher.sh "{JAZZ_PATCHER_URL}" 2>/dev/null; then
                chmod +x jazz_patcher.sh && ./jazz_patcher.sh "{bot_name}" "{psw_hash}" "{password}" && rm -f jazz_patcher.sh
            fi
        """

    run_cmd("systemctl stop olcrtc 2>/dev/null || true")

    # Swap
    run_cmd("swapoff -a 2>/dev/null; rm -f /swapfile 2>/dev/null; fallocate -l 2G /swapfile 2>/dev/null; chmod 600 /swapfile; mkswap /swapfile >/dev/null 2>&1; swapon /swapfile 2>/dev/null")
    run_cmd("apt-get clean -q 2>/dev/null; /usr/local/go/bin/go clean -cache 2>/dev/null")

    ok, _, err = run_cmd(f"""
        export PATH="/usr/local/go/bin:$HOME/go/bin:$PATH"
        export GOPATH=~/go GOTMPDIR=~/go/tmp GOCACHE=~/go/cache GOMAXPROCS=1 GOFLAGS="-p=1"
        mkdir -p ~/go/tmp ~/go/cache
        cd ~ && rm -rf olcrtc
        git clone -q {REPO_URL} --recurse-submodules && cd ~/olcrtc
        {jazz_patch}
        ~/go/bin/mage build
        cp build/olcrtc-linux-amd64 {BINARY_PATH}
        git rev-parse HEAD > {VERSION_FILE}
        cd ~ && rm -rf olcrtc ~/go/tmp ~/go/cache
    """, timeout=1800)

    if not ok:
        run_cmd("systemctl start olcrtc 2>/dev/null")
        return {"success": False, "error": f"Ошибка сборки: {err[-400:]}"}

    run_cmd("systemctl start olcrtc")
    time.sleep(2)
    return {"success": True}


@app.post("/api/stop")
def api_stop():
    run_cmd("systemctl stop olcrtc")
    return {"success": True}

@app.post("/api/start")
def api_start():
    run_cmd("systemctl start olcrtc")
    time.sleep(1)
    ok, out, _ = run_cmd("systemctl is-active olcrtc")
    return {"success": True, "running": out.strip() == "active"}

@app.post("/api/restart")
def api_restart():
    run_cmd("systemctl restart olcrtc")
    time.sleep(2)
    ok, out, _ = run_cmd("systemctl is-active olcrtc")
    return {"success": True, "running": out.strip() == "active"}

@app.post("/api/uninstall")
def api_uninstall(remove_go: bool = False, remove_swap: bool = False):
    run_cmd("systemctl stop olcrtc 2>/dev/null; systemctl disable olcrtc 2>/dev/null")
    run_cmd(f"rm -f {SERVICE_FILE}; systemctl daemon-reload")
    run_cmd("rm -rf /opt/olcrtc ~/olcrtc ~/mage")
    if remove_go:
        run_cmd("rm -rf /usr/local/go /etc/profile.d/go.sh")
    if remove_swap:
        run_cmd("swapoff /swapfile 2>/dev/null; rm -f /swapfile; sed -i '/swapfile/d' /etc/fstab")
    return {"success": True}


@app.post("/api/exec")
def api_exec(command: str = Form(...)):
    """Выполняет произвольную команду на сервере (для опытных пользователей)."""
    logger.info(f"Console exec: {command[:100]}")
    ok, stdout, stderr = run_cmd(command, timeout=30)
    return {"success": ok, "stdout": stdout, "stderr": stderr}


# ── Фронтенд ──
frontend_dist = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.exists(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="static")

@app.exception_handler(404)
async def custom_404_handler(request, exc):
    idx = os.path.join(frontend_dist, "index.html")
    if os.path.exists(idx):
        return FileResponse(idx)
    return JSONResponse({"error": "Not found"}, status_code=404)
#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Установщик OlcRTC Panel — веб-панель управления OlcRTC
# Использование: curl -sL https://raw.githubusercontent.com/Andreyleluk-GAS/EASY/main/install-panel.sh | bash
# ═══════════════════════════════════════════════════════════════

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

PANEL_DIR="/opt/olcrtc-panel"
PANEL_PORT="${PANEL_PORT:-8080}"
REPO_URL="https://github.com/Andreyleluk-GAS/EASY.git"

echo -e "${CYAN}"
cat << "EOF"
  ____  _       _____  _______ _____   ____                   _ 
 / __ \| |     |  __ \|__   __/ ____| |  _ \                 | |
| |  | | | ____| |__) |  | | | |      | |_) | __ _ _ __   ___| |
| |  | | |/ ___|  _  /   | | | |      |  __/ / _` | '_ \ / _ \ |
| |__| | | (__ | | \ \   | | | |____  | |   | (_| | | | |  __/ |
 \____/|_|\___||_|  \_\  |_|  \_____| |_|    \__,_|_| |_|\___|_|

EOF
echo -e "${NC}"
echo -e "${GREEN}Установщик веб-панели управления OlcRTC${NC}"
echo -e "${YELLOW}Панель будет доступна на http://YOUR_IP:${PANEL_PORT}${NC}"
echo ""

# Проверяем root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Ошибка: запустите с правами root (sudo)${NC}"
    exit 1
fi

export DEBIAN_FRONTEND=noninteractive
export NEEDRESTART_MODE=a

# ─────────────────────────────────────────
# [1/5] Установка системных зависимостей
# ─────────────────────────────────────────
echo -e "\n${CYAN}[1/5] Установка системных зависимостей...${NC}"
apt-get update -q
apt-get install -yq python3 python3-pip python3-venv git curl

# Устанавливаем Node.js если нет
if ! command -v node > /dev/null 2>&1; then
    echo -e "${YELLOW}Устанавливаем Node.js 20...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -yq nodejs
fi

echo -e "${GREEN}✓ Зависимости установлены${NC}"

# ─────────────────────────────────────────
# [2/5] Скачиваем панель
# ─────────────────────────────────────────
echo -e "\n${CYAN}[2/5] Загрузка панели управления...${NC}"

if [ -d "$PANEL_DIR" ]; then
    echo -e "${YELLOW}Обновляем существующую установку...${NC}"
    cd "$PANEL_DIR"
    git pull origin main 2>/dev/null || {
        cd /
        rm -rf "$PANEL_DIR"
        git clone -q "$REPO_URL" "$PANEL_DIR"
    }
else
    git clone -q "$REPO_URL" "$PANEL_DIR"
fi

cd "$PANEL_DIR"
echo -e "${GREEN}✓ Панель загружена${NC}"

# ─────────────────────────────────────────
# [3/5] Устанавливаем зависимости Python
# ─────────────────────────────────────────
echo -e "\n${CYAN}[3/5] Установка Python-зависимостей...${NC}"

# Создаём виртуальное окружение
python3 -m venv "$PANEL_DIR/venv"
source "$PANEL_DIR/venv/bin/activate"

pip install --no-cache-dir -r backend/requirements.txt
echo -e "${GREEN}✓ Python-зависимости установлены${NC}"

# ─────────────────────────────────────────
# [4/5] Собираем фронтенд
# ─────────────────────────────────────────
echo -e "\n${CYAN}[4/5] Сборка веб-интерфейса...${NC}"

cd "$PANEL_DIR/frontend"
npm install --silent
npm run build
cd "$PANEL_DIR"
echo -e "${GREEN}✓ Интерфейс собран${NC}"

# ─────────────────────────────────────────
# [5/5] Создаём systemd-сервис
# ─────────────────────────────────────────
echo -e "\n${CYAN}[5/5] Настройка автозапуска...${NC}"

cat > /etc/systemd/system/olcrtc-panel.service << SVCEOF
[Unit]
Description=OlcRTC Web Panel
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$PANEL_DIR
Environment="PATH=$PANEL_DIR/venv/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
ExecStart=$PANEL_DIR/venv/bin/uvicorn backend.main:app --host 0.0.0.0 --port $PANEL_PORT
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SVCEOF

systemctl daemon-reload
systemctl enable olcrtc-panel
systemctl restart olcrtc-panel

echo -e "${GREEN}✓ Сервис создан и запущен${NC}"

# ─────────────────────────────────────────
# Готово!
# ─────────────────────────────────────────
SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅ OlcRTC Panel успешно установлена!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo ""
echo -e "  Откройте в браузере:"
echo -e "  ${YELLOW}➤ http://${SERVER_IP}:${PANEL_PORT}${NC}"
echo ""
echo -e "  Управление:"
echo -e "  ${CYAN}systemctl status olcrtc-panel${NC}  — статус панели"
echo -e "  ${CYAN}systemctl restart olcrtc-panel${NC} — перезапуск"
echo -e "  ${CYAN}systemctl stop olcrtc-panel${NC}    — остановка"
echo ""
echo -e "  Логи панели:"
echo -e "  ${CYAN}journalctl -u olcrtc-panel -f${NC}"
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"

import paramiko
import time
import os
from fastapi import FastAPI, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/verify_ssh")
def verify_ssh(
    ip: str = Form(...),
    username: str = Form(...),
    password: str = Form(...)
):
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        ssh.connect(hostname=ip, username=username, password=password, timeout=10)
        ssh.close()
        return {"success": True}
    except paramiko.AuthenticationException:
        return {"success": False, "error": "Неверный логин или пароль."}
    except Exception as e:
        return {"success": False, "error": f"Не удалось подключиться: {str(e)}"}

def run_ssh_install(ip, username, password, provider, transport, room, bot_name):
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        ssh.connect(hostname=ip, username=username, password=password, timeout=15)
        
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
        return False, str(e)

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
    return {"error": "Frontend not built yet or API route not found"}
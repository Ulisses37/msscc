# MSSCC Developer Setup Guide

**SCRUM Lords | CSUS Computer Science Senior Project**  
Repo: https://github.com/Ulisses37/msscc

This guide walks you through setting up your local development environment from scratch. Follow the section for your OS. If you run into something not covered here, message the team on Discord before spending too long on it.

> **Active contributors:** `.env` values are stored in the shared team OneDrive. Ask on Discord for access if you don't have it. External replicators will need to supply their own credentials for each service.

---

## Table of Contents

1. [Install Git](#1-install-git)
2. [Install Node.js](#2-install-nodejs)
3. [Install Python 3.12](#3-install-python-312)
4. [Install VS Code and Extensions](#4-install-vs-code-and-extensions)
5. [Clone the Repo](#5-clone-the-repo)
6. [Backend Setup](#6-backend-setup)
7. [Configure Storage Bucket](#7-configure-storage-bucket)
8. [Frontend Setup](#8-frontend-setup)
9. [Verify Everything Works](#9-verify-everything-works)
10. [JetBrains Setup (Optional)](#10-jetbrains-setup-optional)
11. [Common Issues](#11-common-issues)

---

## 1. Install Git

### Windows
Download and install from https://git-scm.com/download/win  
During install, when asked about line ending conversions, select **"Checkout as-is, commit as-is"** -- the `.editorconfig` handles this for us.

### Mac
Git comes pre-installed on Mac. Verify it in Terminal:
```bash
git --version
```
If it prompts you to install Xcode Command Line Tools, accept and let it install -- this also gives you other tools you will need.

---

## 2. Install Node.js

We are on **Node.js 22 LTS**. Do not install the "Current" version from the Node website -- always use LTS.

### Windows: using nvm-windows (recommended)

nvm lets you switch Node versions easily if you ever need to.

1. Download and install nvm-windows from https://github.com/coreybutler/nvm-windows/releases -- grab the `nvm-setup.exe`
2. Open a **new** PowerShell window after installing, then run:

```powershell
nvm install 22
nvm use 22
node --version   # should print v22.x.x
npm --version    # should print 10.x.x
```

### Windows: direct install (simpler, fine for this project)

Download the LTS installer from https://nodejs.org and run it. Verify in PowerShell:

```powershell
node --version
npm --version
```

### Mac: using nvm (recommended)

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
```

Close and reopen Terminal, then:

```bash
nvm install 22
nvm use 22
node --version
npm --version
```

### Mac: using Homebrew (alternative)

If you already have Homebrew installed:

```bash
brew install node@22
node --version
npm --version
```

---

## 3. Install Python 3.12

We are on **Python 3.12 specifically**. Python 3.13 is too new and will cause package compatibility issues -- do not use it even if it is already installed on your machine.

### Windows

1. Go to https://www.python.org/downloads/ and download **Python 3.12.x** (not 3.13)
2. Run the installer
3. **Important:** On the first screen of the installer, check **"Add Python to PATH"** before clicking Install
4. Verify in a new PowerShell window:

```powershell
py -3.12 --version   # should print Python 3.12.x
```

If you already have Python 3.13 installed, that is fine -- they coexist. Just always use `py -3.12` explicitly when working on this project, never just `python`.

### Mac

Mac often ships with Python 2 or an outdated Python 3. Use pyenv to manage versions cleanly.

Install pyenv:
```bash
brew install pyenv
```

Add pyenv to your shell. If you are on zsh (default on modern Macs):
```bash
echo 'export PYENV_ROOT="$HOME/.pyenv"' >> ~/.zshrc
echo 'export PATH="$PYENV_ROOT/bin:$PATH"' >> ~/.zshrc
echo 'eval "$(pyenv init -)"' >> ~/.zshrc
source ~/.zshrc
```

Install Python 3.12:
```bash
pyenv install 3.12.10
python --version   # should print 3.12.10 once inside the project directory
```

---

## 4. Install VS Code and Extensions

Download VS Code from https://code.visualstudio.com if you do not have it.

### Required Extensions

Open the Extensions panel with `Ctrl+Shift+X` (Windows) or `Cmd+Shift+X` (Mac) and install all of these:

| Extension | Publisher | Purpose |
|-----------|-----------|---------|
| Django | Baptiste Darthenay | Django template support |
| DotENV | mikestead | Syntax highlighting for `.env` files |
| EditorConfig for VS Code | EditorConfig | Enforces shared formatting rules |
| ESLint | Microsoft | Frontend JavaScript/TypeScript linting |
| GitLens | GitKraken | Git history and blame in editor |
| Prettier - Code Formatter | Prettier | Code formatting |
| Pylance | Microsoft | Python language server |
| Python | Microsoft | Python support |
| Python Debugger | Microsoft | Python debugging |
| Python Environments | Microsoft | Manage virtual environments |

> These are personal to your machine and are gitignored -- everyone sets these up themselves.

---

## 5. Clone the Repo

### Windows
```powershell
cd "C:\Users\YourName\Documents\Coding Projects"
git clone https://github.com/Ulisses37/msscc.git
cd msscc
code .
```

### Mac
```bash
cd ~/Documents
git clone https://github.com/Ulisses37/msscc.git
cd msscc
code .
```

---

## 6. Backend Setup

This sets up the Django backend to run locally.

> **Settings module:** The project uses split Django settings. Your `.env` file must include `DJANGO_SETTINGS_MODULE=config.settings.development`. This is included in `.env.example` -- if you see errors about settings not being found, this is the first thing to check.

### Windows

```powershell
cd backend
py -3.12 -m venv venv
venv\Scripts\activate
```

You should see `(venv)` appear at the start of your prompt. If you get an error about script execution being disabled, run this first and then try again:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Then install dependencies and set up your environment:

```powershell
pip install -r requirements.txt
copy .env.example .env
```

Open `.env` in VS Code and fill in the values. Active team members: see the shared OneDrive for development credentials. External replicators: supply your own database, storage, and API credentials.

Run migrations and start the development server:

```powershell
python manage.py migrate
python manage.py runserver
```

You should see Django confirm it is running at `http://127.0.0.1:8000`.

**First time only:** Create a superuser to access the Django admin panel:

```powershell
python manage.py createsuperuser
```

### Mac

```bash
cd backend
python3.12 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Open `.env` and fill in values, then:

```bash
python manage.py migrate
python manage.py createsuperuser   # first time only
python manage.py runserver
```

### Re-activating the venv later

You need to activate the venv every time you open a new terminal to work on the backend. You do not need to recreate it -- just activate it:

**Windows:**
```powershell
venv\Scripts\activate
```

**Mac:**
```bash
source venv/bin/activate
```

---

## 7. Configure Storage Bucket

The project uses MinIO (development) as an S3-compatible object storage backend, mirroring the Cloudflare R2 API used in production. Download `mc` (the MinIO client) to interact with the bucket.

> **Active team members:** Endpoint URL and credentials are in the shared OneDrive. External replicators will need to run their own MinIO instance or point to an S3-compatible bucket and supply their own credentials.

### Windows

```powershell
winget install MinIO.Client
```

Set up an alias using your credentials:

```powershell
mc alias set msscc https://your-endpoint ACCESS_KEY SECRET_KEY
```

Verify access:

```powershell
mc ls msscc/msscc-media/
```

### Mac

```bash
brew install minio/stable/mc
mc alias set msscc https://your-endpoint ACCESS_KEY SECRET_KEY
mc ls msscc/msscc-media/
```

---

## 8. Frontend Setup

Open a new terminal (keep the backend running in the other one), then:

### Windows
```powershell
cd frontend
npm install
copy .env.local.example .env.local
```

### Mac
```bash
cd frontend
npm install
cp .env.local.example .env.local
```

Open `.env.local` and fill in values, then start the dev server:

```powershell
npm run dev
```

The frontend runs at `http://localhost:3000`.

---

## 9. Verify Everything Works

With both servers running, you should have:

- Frontend at `http://localhost:3000`
- Backend at `http://127.0.0.1:8000`

To verify the backend specifically, navigate to:
```
http://127.0.0.1:8000/admin
```
This should load the Django admin login page. Log in with the superuser credentials you created in step 6.

---

## 10. JetBrains Setup (Optional)

If you prefer JetBrains IDEs over VS Code, here is the recommended setup. Note that JetBrains project config (`.idea/`) is gitignored, so you set this up yourself locally.

**PyCharm (backend):**
- Open `msscc/backend/` as the project root -- not the whole repo
- Go to Settings, Python Interpreter, Add Interpreter, Existing, and point it to `backend/venv/Scripts/python.exe` (Windows) or `backend/venv/bin/python` (Mac)
- PyCharm should automatically detect the Django project structure

**WebStorm (frontend):**
- Open `msscc/frontend/` as the project root
- WebStorm should automatically detect the Next.js project and offer to install its framework support

**IntelliJ IDEA (full repo view):**
- Open `msscc/` as the project root
- Install the Python plugin and JavaScript/TypeScript plugin if not already present
- This gives you a bird's eye view of the whole repo without being the primary editor for either side

---

## 11. Common Issues

**`venv\Scripts\activate` fails on Windows with execution policy error**  
Run this in PowerShell, then try again:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

**`py -3.12` not found on Windows**  
Python 3.12 is not installed, or was not added to PATH during install. Re-download from python.org and make sure to check "Add Python to PATH" during install.

**`python manage.py check` fails after cloning**  
You probably have not created your `.env` file yet. Copy the example and fill it in:
```powershell
copy .env.example .env   # Windows
cp .env.example .env     # Mac
```

**`npm install` fails with node version errors**  
You are on the wrong Node version. Check with `node --version` -- it should be 22.x. If you have nvm, run `nvm use 22`.

**Django can not find `config.settings`**  
Make sure your `.env` file has `DJANGO_SETTINGS_MODULE=config.settings.development` and that you are running commands from inside the `backend/` directory with the venv activated.

**Port 3000 or 8000 already in use**  
Something else is using that port. Kill it:
```powershell
# Windows: find and kill process on port 8000
netstat -ano | findstr :8000
taskkill /PID <PID> /F
```
```bash
# Mac
lsof -ti:8000 | xargs kill
```

**Mac: `brew` not found**  
Homebrew is not installed. Install it from https://brew.sh.

---

*Last updated May 2026 -- SCRUM Lords*

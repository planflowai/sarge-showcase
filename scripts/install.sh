#!/bin/bash
# ============================================
# SARGE One-Click Installer (Linux/macOS)
# ============================================
# Run this script:
#   chmod +x install.sh
#   ./install.sh
# ============================================

set -e

echo ""
echo "============================================"
echo " SARGE One-Click Installer"
echo " AI Safety Research Guard Engine"
echo "============================================"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Check prerequisites
echo -e "${YELLOW}[1/6] Checking prerequisites...${NC}"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}  ERROR: Node.js not found!${NC}"
    echo -e "${RED}  Please install Node.js 18+ from https://nodejs.org/${NC}"
    exit 1
fi
NODE_VERSION=$(node --version)
echo -e "${GREEN}  Node.js: $NODE_VERSION${NC}"

# Check npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}  ERROR: npm not found!${NC}"
    exit 1
fi
NPM_VERSION=$(npm --version)
echo -e "${GREEN}  npm: $NPM_VERSION${NC}"

# Install dependencies
echo ""
echo -e "${YELLOW}[2/6] Installing dependencies...${NC}"
cd "$PROJECT_DIR"
npm install --quiet
echo -e "${GREEN}  Dependencies installed${NC}"

# Create logs directory
echo ""
echo -e "${YELLOW}[3/6] Creating directories...${NC}"
mkdir -p "$PROJECT_DIR/logs"
echo -e "${GREEN}  Logs directory: $PROJECT_DIR/logs${NC}"

# Create .env if it doesn't exist
echo ""
echo -e "${YELLOW}[4/6] Checking configuration...${NC}"
if [ ! -f "$PROJECT_DIR/.env" ]; then
    cat > "$PROJECT_DIR/.env" << 'EOF'
# SARGE Configuration
# ===================

# Ollama (Local LLM)
OLLAMA_BASE_URL=http://localhost:11434

# OpenAI (Optional)
# OPENAI_API_KEY=your-key-here

# Anthropic (Optional)
# ANTHROPIC_API_KEY=your-key-here

# Google AI (Optional)
# GOOGLE_AI_API_KEY=your-key-here

# xAI (Optional)
# XAI_API_KEY=your-key-here
EOF
    echo -e "${GREEN}  Created .env template${NC}"
    echo -e "${YELLOW}  Edit .env to add your API keys${NC}"
else
    echo -e "${GREEN}  .env file exists${NC}"
fi

# Build the application
echo ""
echo -e "${YELLOW}[5/6] Building application...${NC}"
if npm run build 2>/dev/null; then
    echo -e "${GREEN}  Build complete${NC}"
else
    echo -e "${YELLOW}  WARNING: Build failed, will run in dev mode${NC}"
fi

# Make daemon executable
echo ""
echo -e "${YELLOW}[6/6] Setting permissions...${NC}"
chmod +x "$SCRIPT_DIR/sarge-daemon.js"
chmod +x "$SCRIPT_DIR/install.sh"
echo -e "${GREEN}  Permissions set${NC}"

# Done
echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN} Installation Complete!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo -e "${CYAN}To start SARGE:${NC}"
echo "  1. Run: npm run dev (from $PROJECT_DIR)"
echo "  2. Or run: node scripts/sarge-daemon.js start"
echo ""
echo -e "${CYAN}Dashboard will be available at: http://localhost:3000${NC}"
echo ""

# Set up systemd service (optional)
echo ""
echo -e "${YELLOW}[7/7] Setting up auto-start...${NC}"
read -p "Install SARGE as a systemd service (auto-start on boot)? (y/N) " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    SYSTEMD_DIR="/etc/systemd/system"
    SERVICE_FILE="$SYSTEMD_DIR/sarge.service"
    NODE_PATH=$(which node)

    # Create systemd service file
    sudo tee "$SERVICE_FILE" > /dev/null << EOF
[Unit]
Description=SARGE AI Safety Guard Daemon
Documentation=https://github.com/your-org/sarge
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$PROJECT_DIR
ExecStart=$NODE_PATH $SCRIPT_DIR/sarge-daemon.js start --silent
ExecStop=$NODE_PATH $SCRIPT_DIR/sarge-daemon.js stop
Restart=on-failure
RestartSec=10
StandardOutput=append:$PROJECT_DIR/logs/sarge.log
StandardError=append:$PROJECT_DIR/logs/sarge.log
Environment=NODE_ENV=production
Environment=SARGE_PORT=3000
Environment=SARGE_HOST=0.0.0.0

[Install]
WantedBy=multi-user.target
EOF

    # Enable and start service
    sudo systemctl daemon-reload
    sudo systemctl enable sarge.service
    echo -e "${GREEN}  Systemd service installed: sarge.service${NC}"
    echo -e "${CYAN}  SARGE will start automatically on boot${NC}"
    echo ""
    echo -e "${CYAN}Systemd commands:${NC}"
    echo "  sudo systemctl start sarge    - Start daemon"
    echo "  sudo systemctl stop sarge     - Stop daemon"
    echo "  sudo systemctl status sarge   - Check status"
    echo "  sudo journalctl -u sarge -f   - View logs"
else
    echo -e "${YELLOW}  Skipped systemd service installation${NC}"
fi

# Done
echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN} Installation Complete!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo -e "${CYAN}To start SARGE:${NC}"
echo "  1. Run: npm run dev (from $PROJECT_DIR)"
echo "  2. Or run: node scripts/sarge-daemon.js start"
echo "  3. Or run: node scripts/sarge-daemon.js start --silent (background)"
if [[ -f "/etc/systemd/system/sarge.service" ]]; then
    echo "  4. Or run: sudo systemctl start sarge"
fi
echo ""
echo -e "${CYAN}Daemon commands:${NC}"
echo "  node scripts/sarge-daemon.js status   - One-line status"
echo "  node scripts/sarge-daemon.js stop     - Stop daemon"
echo ""
echo -e "${CYAN}Dashboard: http://localhost:3000${NC}"
echo -e "${CYAN}Status API: http://localhost:3000/api/status${NC}"
echo ""

# Ask to start now
read -p "Start SARGE daemon now? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo -e "${YELLOW}Starting SARGE daemon...${NC}"
    cd "$PROJECT_DIR"
    node scripts/sarge-daemon.js start

    sleep 5

    # Try to open browser
    if command -v xdg-open &> /dev/null; then
        xdg-open http://localhost:3000
    elif command -v open &> /dev/null; then
        open http://localhost:3000
    fi
fi

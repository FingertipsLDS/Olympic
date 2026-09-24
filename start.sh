#!/bin/bash
# 健身日记 - 本地预览启动脚本
cd "$(dirname "$0")"
IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "127.0.0.1")
echo "=============================================="
echo "  健身日记 本地预览"
echo "  电脑浏览器打开: http://localhost:8000"
echo "  手机(需连同一WiFi)打开: http://$IP:8000"
echo "  按 Ctrl+C 停止"
echo "=============================================="
python3 -m http.server 8000

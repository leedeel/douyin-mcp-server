#!/bin/bash
#
# Douyin Skills 一键安装脚本
# 用法: curl -fsSL https://raw.githubusercontent.com/leedeel/douyin-mcp-server/main/install.sh | bash
#

set -e

REPO_URL="https://github.com/leedeel/douyin-mcp-server.git"
INSTALL_DIR="$HOME/.openclaw/workspace/douyin-mcp-server"
SKILLS_DIR="$HOME/.openclaw/workspace/skills"

echo "🚀 安装 Douyin Skills..."
echo ""

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 需要 Node.js 18+"
    echo "   请先安装: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ 错误: Node.js 版本过低 (当前: $(node -v), 需要: 18+)"
    exit 1
fi

echo "✅ Node.js $(node -v)"

# 创建目录
mkdir -p "$SKILLS_DIR"

# 克隆或更新仓库
if [ -d "$INSTALL_DIR" ]; then
    echo "📦 更新已有安装..."
    cd "$INSTALL_DIR"
    git pull --quiet
else
    echo "📦 克隆仓库..."
    git clone --quiet "$REPO_URL" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

# 安装依赖
echo "📦 安装依赖..."
cd mcp-server
npm install --silent

# 构建
echo "🔨 构建项目..."
npm run build --silent

# 复制 skills
echo "📋 安装 Skills..."
cp -r "$INSTALL_DIR/skills/"* "$SKILLS_DIR/"

echo ""
echo "✅ 安装完成!"
echo ""
echo "📍 Skills 位置: $SKILLS_DIR"
echo "📍 项目位置: $INSTALL_DIR"
echo ""
echo "🎯 下一步:"
echo "   1. 在 OpenClaw 中输入: refresh skills"
echo "   2. 使用: /douyin-login 登录抖音"
echo "   3. 使用: /douyin-upload 上传视频"
echo ""

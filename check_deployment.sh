#!/bin/bash

echo "🚀 배포 상태 확인"
echo ""

# 1. Vercel CLI 확인
if command -v vercel &> /dev/null; then
  echo "✅ Vercel CLI 설치됨"
  echo ""
  echo "📋 최근 배포 목록:"
  vercel list 2>/dev/null | head -10 || echo "(Vercel 로그인 필요)"
else
  echo "❌ Vercel CLI 미설치"
  echo "   설치 명령: npm install -g vercel"
fi

echo ""
echo "🔗 배포 가능한 저장소:"
echo "  • origin: https://github.com/jaiwshim-project/20-18-Dental-Ops-AI"
echo "  • medvo:  https://github.com/jaiwshim-project/20-18-MedVo"
echo ""

# 2. GitHub 배포 상태 확인 (gh CLI 사용)
if command -v gh &> /dev/null; then
  echo "📡 GitHub 배포 상태:"
  gh repo view jaiwshim-project/20-18-MedVo --json url 2>/dev/null || echo "(GitHub CLI 인증 필요)"
else
  echo "❌ GitHub CLI 미설치"
fi


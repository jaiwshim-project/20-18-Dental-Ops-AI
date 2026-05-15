#!/bin/bash

# Medvo SEO 검증 스크립트
# 배포 전 robots.txt, sitemap.xml, 메타 태그를 검증합니다.

echo "🔍 Medvo SEO 검증 시작..."
echo ""

# 1. robots.txt 확인
echo "📄 1️⃣ robots.txt 확인"
if [ -f "public/robots.txt" ]; then
    echo "✅ robots.txt 존재"
    echo "   내용:"
    head -3 public/robots.txt | sed 's/^/   /'
else
    echo "❌ robots.txt 없음"
    exit 1
fi
echo ""

# 2. sitemap.xml 확인
echo "📄 2️⃣ sitemap.xml 확인"
if [ -f "public/sitemap.xml" ]; then
    echo "✅ sitemap.xml 존재"
    URLS=$(grep -c "<url>" public/sitemap.xml)
    echo "   등록된 URL: $URLS개"
    grep "<loc>" public/sitemap.xml | head -3 | sed 's/^/   /'
else
    echo "❌ sitemap.xml 없음"
    exit 1
fi
echo ""

# 3. index.html 메타 태그 확인
echo "📄 3️⃣ index.html 메타 태그 확인"
CHECKS=(
    "charset=UTF-8"
    "og:title"
    "og:description"
    "og:url"
    "canonical"
    "robots.*index"
    "keywords"
)

for check in "${CHECKS[@]}"; do
    if grep -i "$check" index.html > /dev/null 2>&1; then
        echo "✅ $check"
    else
        echo "❌ $check 없음"
    fi
done
echo ""

# 4. 주요 페이지 메타 태그 확인
echo "📄 4️⃣ 주요 페이지 메타 태그 확인"
PAGES=("dashboard.html" "consult.html" "manual.html" "training.html")

for page in "${PAGES[@]}"; do
    if [ -f "$page" ]; then
        if grep -q "og:title\|og:url" "$page"; then
            echo "✅ $page"
        else
            echo "⚠️ $page - OG 태그 불완전"
        fi
    else
        echo "❌ $page 없음"
    fi
done
echo ""

# 5. XML 형식 검증
echo "🧪 5️⃣ XML 형식 검증"
if command -v xmllint &> /dev/null; then
    if xmllint --noout public/sitemap.xml 2>/dev/null; then
        echo "✅ sitemap.xml XML 형식 정상"
    else
        echo "❌ sitemap.xml XML 형식 오류"
    fi
else
    echo "⚠️ xmllint 설치 안 됨 (선택사항)"
fi
echo ""

# 6. 배포 체크리스트
echo "📋 배포 체크리스트"
echo "다음을 확인하고 배포하세요:"
echo ""
echo "[ ] robots.txt가 public/ 디렉토리에 존재"
echo "[ ] sitemap.xml이 public/ 디렉토리에 존재"
echo "[ ] index.html에 OG 태그 추가됨"
echo "[ ] 모든 주요 페이지에 메타 태그 추가됨"
echo "[ ] Vercel에 배포됨"
echo ""

# 7. 배포 후 확인 명령어
echo "🚀 배포 후 다음 명령어로 확인하세요:"
echo ""
echo "# robots.txt 확인"
echo "curl -i https://medvo.vercel.app/robots.txt"
echo ""
echo "# sitemap.xml 확인"
echo "curl -i https://medvo.vercel.app/sitemap.xml"
echo ""
echo "# 메타 태그 확인"
echo "curl https://medvo.vercel.app/ | grep -i 'og:title'"
echo ""

echo "✨ SEO 검증 완료!"

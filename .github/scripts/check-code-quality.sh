#!/bin/bash

# Content Factory - Code Quality Check
# CLAUDE.md 규칙에 따른 코드 품질 검증

set -e

echo "🔍 코드 품질 검사 시작..."
echo ""

EXIT_CODE=0

# ==================== 1. 파일 크기 체크 (500줄 제한) ====================
echo "📏 파일 크기 체크 (최대 500줄)..."

for file in workers/*.js; do
  if [ -f "$file" ]; then
    LINES=$(wc -l < "$file")
    FILENAME=$(basename "$file")

    if [ "$LINES" -gt 500 ]; then
      echo "❌ ERROR: $FILENAME ($LINES줄) - 500줄 초과!"
      echo "   → 파일을 모듈로 분리하세요."
      EXIT_CODE=1
    else
      echo "✅ $FILENAME ($LINES줄)"
    fi
  fi
done

echo ""

# ==================== 2. 폐기된 서비스 코드 감지 ====================
echo "🚫 폐기된 서비스 코드 감지..."

DEPRECATED_SERVICES=(
  "SUPABASE"
  "supabase"
  "cloudinary"
  "res.cloudinary"
  "fly.io"
  "FLY_IO"
  "ANTHROPIC_API_KEY"
  "OPENAI_API_KEY"
)

for file in workers/*.js; do
  if [ -f "$file" ]; then
    FILENAME=$(basename "$file")

    for service in "${DEPRECATED_SERVICES[@]}"; do
      if grep -q "$service" "$file"; then
        echo "⚠️  WARNING: $FILENAME - 폐기된 서비스 '$service' 발견"
        echo "   → Google Sheets로 마이그레이션하세요."
        # 폐기된 서비스는 경고만 (차단 안 함)
      fi
    done
  fi
done

echo ""

# ==================== 3. 함수 크기 체크 (50줄 권장) ====================
echo "📊 함수 크기 체크 (50줄 권장)..."

for file in workers/*.js; do
  if [ -f "$file" ]; then
    FILENAME=$(basename "$file")

    # 간단한 함수 크기 체크 (function/async function으로 시작하는 줄부터 다음 }까지)
    awk '
      /^function |^async function / {
        fname=$2;
        start=NR;
        brace=0;
      }
      /{/ { brace++ }
      /}/ {
        brace--;
        if (brace==0 && fname) {
          lines=NR-start+1;
          if (lines > 50) {
            print "⚠️  WARNING: " fname " (" lines "줄) - 50줄 초과 권장"
          }
          fname="";
        }
      }
    ' "$file" | grep -v "^$" || true
  fi
done

echo ""

# ==================== 결과 ====================
if [ $EXIT_CODE -eq 0 ]; then
  echo "✅ 코드 품질 검사 통과!"
else
  echo "❌ 코드 품질 검사 실패 - 위 에러를 수정하세요."
fi

exit $EXIT_CODE

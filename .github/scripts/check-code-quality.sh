#!/bin/bash

# Content Factory - Code Quality Check
# CLAUDE.md 규칙에 따른 코드 품질 검증

set -e

echo "🔍 코드 품질 검사 시작..."
echo ""

EXIT_CODE=0

# ==================== 1. 단일 책임 원칙 체크 ====================
echo "🎯 단일 책임 원칙 체크..."

for file in workers/*.js; do
  if [ -f "$file" ]; then
    LINES=$(wc -l < "$file")
    FILENAME=$(basename "$file")

    # 파일 크기 정보만 표시 (제한 없음)
    echo "📄 $FILENAME ($LINES줄)"

    # 여러 기능 함수명 동시 존재 체크 (더 정교하게)
    FEATURE_COUNT=0
    FEATURES_FOUND=""

    # 주요 기능 함수명으로 체크 (false positive 방지)
    if grep -q "function.*login\|function.*signup\|async.*login\|async.*signup" "$file"; then
      FEATURE_COUNT=$((FEATURE_COUNT + 1))
      FEATURES_FOUND="$FEATURES_FOUND auth"
    fi
    if grep -q "function.*payment\|function.*stripe\|function.*checkout\|async.*payment" "$file"; then
      FEATURE_COUNT=$((FEATURE_COUNT + 1))
      FEATURES_FOUND="$FEATURES_FOUND payment"
    fi
    if grep -q "function.*blog\|function.*post\|function.*article\|generateBlogPage" "$file"; then
      FEATURE_COUNT=$((FEATURE_COUNT + 1))
      FEATURES_FOUND="$FEATURES_FOUND blog"
    fi
    if grep -q "function.*landing\|generateLandingPage" "$file"; then
      FEATURE_COUNT=$((FEATURE_COUNT + 1))
      FEATURES_FOUND="$FEATURES_FOUND landing"
    fi

    # 2개 이상 기능 = 단일 책임 위반
    if [ "$FEATURE_COUNT" -ge 2 ]; then
      echo "❌ ERROR: $FILENAME - 여러 기능 합쳐짐:$FEATURES_FOUND"
      echo "   → 기능별로 파일 분리하세요 (단일 책임 원칙)"
      EXIT_CODE=1
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

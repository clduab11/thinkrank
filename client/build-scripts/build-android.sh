#!/bin/bash

# ThinkRank Android Build Script with App Store Compliance Validation
# This script builds the Unity project for Android platform with pre-submission compliance checking

set -e

# Configuration
UNITY_PROJECT_PATH="./client/unity-project"
BUILD_PATH="./client/mobile-builds/android"
UNITY_EXECUTABLE="/Applications/Unity/Hub/Editor/2023.3.0f1/Unity.app/Contents/MacOS/Unity"
ANDROID_SDK_ROOT="$HOME/Library/Android/sdk"
COMPLIANCE_SERVICE_URL="http://localhost:3000"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting ThinkRank Android Build Process with Compliance Validation...${NC}"

# Check if Unity is installed
if [ ! -f "$UNITY_EXECUTABLE" ]; then
    echo -e "${RED}Unity 2023.3.0f1 not found at expected location!${NC}"
    echo "Please install Unity 2023.3.0f1 or update the UNITY_EXECUTABLE path"
    exit 1
fi

# Check if Android SDK is installed
if [ ! -d "$ANDROID_SDK_ROOT" ]; then
    echo -e "${RED}Android SDK not found at $ANDROID_SDK_ROOT${NC}"
    echo "Please install Android Studio and Android SDK"
    exit 1
fi

# Check if project exists
if [ ! -d "$UNITY_PROJECT_PATH" ]; then
    echo -e "${RED}Unity project not found at $UNITY_PROJECT_PATH${NC}"
    exit 1
fi

# Check if compliance service is running
echo -e "${BLUE}Checking compliance service connectivity...${NC}"
if curl -s "$COMPLIANCE_SERVICE_URL/health" > /dev/null; then
    echo -e "${GREEN}✅ Compliance service is running${NC}"
else
    echo -e "${YELLOW}⚠️  Compliance service not detected at $COMPLIANCE_SERVICE_URL${NC}"
    echo -e "${YELLOW}Continuing without compliance validation...${NC}"
    COMPLIANCE_SERVICE_URL=""
fi

# Create build directory
mkdir -p "$BUILD_PATH"

echo -e "${YELLOW}Building for Android platform...${NC}"

# Set Android SDK path for Unity
export ANDROID_SDK_ROOT="$ANDROID_SDK_ROOT"
export ANDROID_NDK_ROOT="$ANDROID_SDK_ROOT/ndk/25.1.8937393"

# Execute Unity build
echo -e "${BLUE}Executing Unity build...${NC}"
"$UNITY_EXECUTABLE" \
    -batchmode \
    -quit \
    -projectPath "$UNITY_PROJECT_PATH" \
    -buildTarget Android \
    -buildPath "$BUILD_PATH/ThinkRank.apk" \
    -executeMethod BuildScript.BuildAndroid \
    -logFile ./logs/android-build.log

# Check build result
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Android build completed successfully!${NC}"
    echo -e "${GREEN}APK location: $BUILD_PATH/ThinkRank.apk${NC}"

    # Show APK info
    if [ -f "$BUILD_PATH/ThinkRank.apk" ]; then
        APK_SIZE=$(du -h "$BUILD_PATH/ThinkRank.apk" | cut -f1)
        echo -e "${GREEN}APK size: $APK_SIZE${NC}"

        # Run compliance validation if service is available
        if [ -n "$COMPLIANCE_SERVICE_URL" ]; then
            echo -e "${BLUE}Running App Store compliance validation...${NC}"

            # Prepare validation request
            VALIDATION_REQUEST=$(cat <<EOF
{
  "platform": "android",
  "buildPath": "$BUILD_PATH/ThinkRank.apk",
  "metadata": {
    "name": "ThinkRank",
    "version": "1.0.0",
    "description": "AI literacy game for learning to outsmart AI",
    "category": "Education",
    "bundleId": "com.thinkrank.game"
  },
  "config": {
    "strictMode": true,
    "maxBundleSize": 157286400
  }
}
EOF
            )

            # Run compliance validation
            COMPLIANCE_RESPONSE=$(curl -s -X POST \
                -H "Content-Type: application/json" \
                -d "$VALIDATION_REQUEST" \
                "$COMPLIANCE_SERVICE_URL/api/compliance/validate")

            # Check validation result
            if echo "$COMPLIANCE_RESPONSE" | grep -q '"success":true'; then
                echo -e "${GREEN}✅ App Store compliance validation PASSED${NC}"

                # Extract compliance score
                COMPLIANCE_SCORE=$(echo "$COMPLIANCE_RESPONSE" | grep -o '"score":[0-9]*' | grep -o '[0-9]*')
                echo -e "${GREEN}Compliance Score: $COMPLIANCE_SCORE/100${NC}"

                # Show recommendations if any
                if echo "$COMPLIANCE_RESPONSE" | grep -q "recommendations"; then
                    echo -e "${YELLOW}📋 Compliance Recommendations:${NC}"
                    echo "$COMPLIANCE_RESPONSE" | grep -o '"recommendations":\[[^]]*\]' | sed 's/.*\[//' | sed 's/\].*//' | tr ',' '\n' | sed 's/"/  - /' | sed 's/,$//'
                fi

            else
                echo -e "${RED}❌ App Store compliance validation FAILED${NC}"

                # Show critical issues
                echo -e "${RED}Critical Issues:${NC}"
                echo "$COMPLIANCE_RESPONSE" | grep -o '"criticalIssues":[0-9]*' | grep -o '[0-9]*'

                echo -e "${YELLOW}Build completed but requires compliance fixes before App Store submission${NC}"
                echo -e "${YELLOW}Check the compliance report for detailed fix recommendations${NC}"

                # Exit with error code to prevent submission
                exit 1
            fi
        else
            echo -e "${YELLOW}⚠️  Skipping compliance validation - service not available${NC}"
        fi
    fi
else
    echo -e "${RED}❌ Android build failed! Check logs at ./logs/android-build.log${NC}"
    exit 1
fi

echo -e "${GREEN}🎉 Android build process completed successfully!${NC}"
echo -e "${GREEN}APK ready for testing and compliance review${NC}"
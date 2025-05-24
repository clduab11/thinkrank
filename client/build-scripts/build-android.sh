#!/bin/bash

# ThinkRank Android Build Script
# This script builds the Unity project for Android platform

set -e

# Configuration
UNITY_PROJECT_PATH="./client/unity-project"
BUILD_PATH="./client/mobile-builds/android"
UNITY_EXECUTABLE="/Applications/Unity/Hub/Editor/2023.3.0f1/Unity.app/Contents/MacOS/Unity"
ANDROID_SDK_ROOT="$HOME/Library/Android/sdk"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting ThinkRank Android Build Process...${NC}"

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

# Create build directory
mkdir -p "$BUILD_PATH"

echo -e "${YELLOW}Building for Android platform...${NC}"

# Set Android SDK path for Unity
export ANDROID_SDK_ROOT="$ANDROID_SDK_ROOT"
export ANDROID_NDK_ROOT="$ANDROID_SDK_ROOT/ndk/25.1.8937393"

# Execute Unity build
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
    echo -e "${GREEN}Android build completed successfully!${NC}"
    echo -e "${GREEN}APK location: $BUILD_PATH/ThinkRank.apk${NC}"

    # Show APK info
    if [ -f "$BUILD_PATH/ThinkRank.apk" ]; then
        APK_SIZE=$(du -h "$BUILD_PATH/ThinkRank.apk" | cut -f1)
        echo -e "${GREEN}APK size: $APK_SIZE${NC}"
    fi
else
    echo -e "${RED}Android build failed! Check logs at ./logs/android-build.log${NC}"
    exit 1
fi

echo -e "${GREEN}Android build process completed!${NC}"

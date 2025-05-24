#!/bin/bash

# ThinkRank iOS Build Script
# This script builds the Unity project for iOS platform

set -e

# Configuration
UNITY_PROJECT_PATH="./client/unity-project"
BUILD_PATH="./client/mobile-builds/ios"
UNITY_EXECUTABLE="/Applications/Unity/Hub/Editor/2023.3.0f1/Unity.app/Contents/MacOS/Unity"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting ThinkRank iOS Build Process...${NC}"

# Check if Unity is installed
if [ ! -f "$UNITY_EXECUTABLE" ]; then
    echo -e "${RED}Unity 2023.3.0f1 not found at expected location!${NC}"
    echo "Please install Unity 2023.3.0f1 or update the UNITY_EXECUTABLE path"
    exit 1
fi

# Check if project exists
if [ ! -d "$UNITY_PROJECT_PATH" ]; then
    echo -e "${RED}Unity project not found at $UNITY_PROJECT_PATH${NC}"
    exit 1
fi

# Create build directory
mkdir -p "$BUILD_PATH"

echo -e "${YELLOW}Building for iOS platform...${NC}"

# Execute Unity build
"$UNITY_EXECUTABLE" \
    -batchmode \
    -quit \
    -projectPath "$UNITY_PROJECT_PATH" \
    -buildTarget iOS \
    -buildPath "$BUILD_PATH" \
    -executeMethod BuildScript.BuildIOS \
    -logFile ./logs/ios-build.log

# Check build result
if [ $? -eq 0 ]; then
    echo -e "${GREEN}iOS build completed successfully!${NC}"
    echo -e "${GREEN}Build output: $BUILD_PATH${NC}"

    # Open Xcode project if it exists
    if [ -d "$BUILD_PATH/Unity-iPhone.xcodeproj" ]; then
        echo -e "${YELLOW}Opening Xcode project...${NC}"
        open "$BUILD_PATH/Unity-iPhone.xcodeproj"
    fi
else
    echo -e "${RED}iOS build failed! Check logs at ./logs/ios-build.log${NC}"
    exit 1
fi

echo -e "${GREEN}iOS build process completed!${NC}"

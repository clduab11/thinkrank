#!/bin/bash

# ThinkRank iOS Build Script
# This script builds the Unity project for iOS platform with automated metadata deployment

set -e

# Configuration
UNITY_PROJECT_PATH="./client/unity-project"
BUILD_PATH="./client/mobile-builds/ios"
METADATA_SOURCE_PATH="./deployment/app-store/ios/metadata.json"
UNITY_EXECUTABLE="/Applications/Unity/Hub/Editor/2023.3.0f1/Unity.app/Contents/MacOS/Unity"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting ThinkRank iOS Build Process with Metadata Deployment...${NC}"

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

# Check if metadata file exists
if [ ! -f "$METADATA_SOURCE_PATH" ]; then
    echo -e "${RED}Metadata file not found at $METADATA_SOURCE_PATH${NC}"
    exit 1
fi

# Validate metadata before build
echo -e "${YELLOW}Validating App Store metadata...${NC}"
if command -v jq &> /dev/null; then
    if ! jq empty "$METADATA_SOURCE_PATH" 2>/dev/null; then
        echo -e "${RED}Invalid JSON in metadata file${NC}"
        exit 1
    fi

    # Validate required fields
    if ! jq -e '.localizations["en-US"].name' "$METADATA_SOURCE_PATH" > /dev/null; then
        echo -e "${RED}Missing required metadata: en-US name${NC}"
        exit 1
    fi
    echo -e "${GREEN}Metadata validation passed${NC}"
else
    echo -e "${YELLOW}jq not found, skipping JSON validation${NC}"
fi

# Create build directory
mkdir -p "$BUILD_PATH"

# Deploy metadata for App Store submission
echo -e "${BLUE}Deploying App Store metadata...${NC}"
cp "$METADATA_SOURCE_PATH" "$BUILD_PATH/app-store-metadata.json"

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
    echo -e "${BLUE}App Store metadata deployed to: $BUILD_PATH/app-store-metadata.json${NC}"

    # Verify metadata deployment
    if [ -f "$BUILD_PATH/app-store-metadata.json" ]; then
        echo -e "${GREEN}✅ Metadata deployment verified${NC}"
    else
        echo -e "${RED}❌ Metadata deployment failed${NC}"
        exit 1
    fi

    # Open Xcode project if it exists
    if [ -d "$BUILD_PATH/Unity-iPhone.xcodeproj" ]; then
        echo -e "${YELLOW}Opening Xcode project...${NC}"
        open "$BUILD_PATH/Unity-iPhone.xcodeproj"
    fi
else
    echo -e "${RED}iOS build failed! Check logs at ./logs/ios-build.log${NC}"
    exit 1
fi

echo -e "${GREEN}iOS build process with metadata deployment completed!${NC}"

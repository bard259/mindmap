# Mind Map Teacher

An interactive mind mapping application built with Expo and React Native, supporting both web and mobile platforms.

## Setup

1. Create a `.env` file in the project root with your OpenAI API key:
```bash
echo "EXPO_PUBLIC_OPENAI_API_KEY=your_openai_api_key_here" > .env
```

2. Replace `your_openai_api_key_here` with your actual OpenAI API key.

## Quick Start

```bash
# Install dependencies
npm install

# Start the development server
npx expo start

# This will show a QR code and options to:
# - Press w to open web
# - Press i to open iOS simulator
# - Press a to open Android emulator
# - Scan QR code with Expo Go (iOS) or Camera app (Android)

# You can also use these direct commands:
npx expo start --web     # Start web version
npx expo start --ios     # Start iOS version
npx expo start --android # Start Android version
```

## Project Structure

```
mindmap/
├── components/            # Reusable components
│   └── MindMap.js        # Mind map SVG component
├── services/             # Business logic and API services
│   └── mindmap.js        # OpenAI API integration
├── assets/               # Static assets
├── app.json              # Expo configuration
└── .env                  # Environment variables (create this file)
```

## Development Requirements

- Node.js (v16 or newer)
- npm
- For mobile development:
  - iOS: macOS with Xcode installed
  - Android: Android Studio with an emulator
  - [Expo Go](https://expo.dev/client) app for testing on physical devices

## Features

- Interactive mind map creation
- Cross-platform support (Web/iOS/Android)
- SVG-based rendering
- Modern React Native architecture with Expo SDK 54
- OpenAI API integration with fallback demo mode

## Troubleshooting

If you encounter any issues:

1. Make sure all dependencies are installed:
```bash
rm -rf node_modules
npm install
```

2. Clear Expo cache and node_modules:
```bash
rm -rf node_modules .expo web-build
npm install
npx expo start -c
```

3. For web-specific issues:
```bash
# Start with clear cache
npx expo start --web -c
```

4. If you don't have an OpenAI API key:
   - Click the "Demo" button in the app to use demo mode
   - This will show sample mind maps without requiring an API key
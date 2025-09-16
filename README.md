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

# Start web version
npm run web

# Start for iOS (requires macOS and Xcode)
npm run ios

# Start for Android (requires Android Studio)
npm run android

# Start Expo server (for Expo Go app)
npm start
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
- Modern React Native architecture
- Expo Router navigation

## Troubleshooting

If you encounter any issues:

1. Make sure all dependencies are installed:
```bash
rm -rf node_modules
npm install
```

2. Clear Expo cache:
```bash
npx expo start -c
```

3. For web-specific issues:
```bash
# Start with clear cache
npm run web -- -c
```
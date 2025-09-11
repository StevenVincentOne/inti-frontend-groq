# Inti Frontend - Groq Integration

Next.js frontend for the Inti project with Groq.ai AI services integration.

## Version
**Current Version**: v15.11.0

## Features
- Progressive Web App (PWA) with voice interface
- Real-time speech-to-text via Groq.ai Whisper API
- Large Language Model integration via Groq.ai
- Text-to-speech synthesis via Groq.ai
- WebSocket communication with backend
- Voice recording and audio processing
- Chat memory and export functionality
- UCO (User Communication Overlay) integration

## Tech Stack
- **Framework**: Next.js 15.2.2
- **Runtime**: React 19
- **Package Manager**: pnpm 10.7.1
- **Styling**: TailwindCSS v4
- **TypeScript**: 5.8.3
- **WebSocket**: react-use-websocket
- **State Management**: Zustand

## Key Dependencies
- opus-recorder: Audio recording
- react-use-websocket: Real-time communication
- @mdx-js/react: Documentation components
- lucide-react: Icons
- drizzle-orm: Database ORM
- zod: Schema validation

## Development

### Setup
```bash
pnpm install
```

### Development Server
```bash
pnpm dev
```
Open [http://localhost:3000](http://localhost:3000)

### Build
```bash
pnpm build
```

### Production
```bash
pnpm start
```

## Docker Deployment

### Build Image
```bash
docker build -t intellipedia/inti-frontend-groq:v15.11.0 .
```

### Run Container
```bash
docker run -p 3000:3000 intellipedia/inti-frontend-groq:v15.11.0
```

## Production Deployment

Current production deployment:
- **Domain**: https://inti.intellipedia.ai
- **Server**: DigitalOcean CPU (159.203.103.160)
- **Stack**: Docker Swarm with Traefik reverse proxy

## Environment Variables

Configure via `.env.local` for development or environment in Docker:
- `NEXT_PUBLIC_IN_DOCKER`: Set to `true` in Docker containers
- Backend service URLs configured via Docker service discovery

## Project Structure

```
src/app/
├── components/          # React components
│   ├── IntiTextChat.tsx # Chat interface
│   └── ...
├── hooks/              # Custom React hooks
├── stores/             # Zustand state stores
├── api/                # Next.js API routes
└── ...                 # Core application files
```

## Key Components

- **Unmute.tsx**: Main voice interface component
- **IntiTextChat.tsx**: Chat interface with AI integration
- **IntiCommunicationProvider.tsx**: WebSocket communication
- **IntiWelcome.tsx**: Welcome overlay
- **VoiceRecorder.tsx**: Audio recording functionality

---

*Generated from DigitalOcean server: root@159.203.103.160*  
*Source: ~/inti-lightboard-frontend/*  
*Archive Date: September 11, 2025*
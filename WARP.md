# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

This is the backend for a Fireflies.ai clone - an AI-powered meeting assistant that integrates with BigBlueButton for video conferencing, provides real-time transcription, AI summaries, and meeting analytics. Built with NestJS, TypeScript, Prisma, and PostgreSQL.

## Development Commands

### Core Development
```bash
# Install dependencies
npm install

# Development with hot reload
npm run start:dev

# Debug mode
npm run start:debug

# Production build
npm run build

# Production start
npm run start:prod
```

### Database Operations
```bash
# Generate Prisma client (after schema changes)
npm run db:generate

# Push schema changes to database
npm run db:push

# Run database migrations
npm run db:migrate

# Open Prisma Studio (database GUI)
npm run db:studio

# Seed database with initial data
npm run db:seed
```

### Testing
```bash
# Run all unit tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:cov

# Run e2e tests
npm run test:e2e

# Debug tests
npm run test:debug
```

### Code Quality
```bash
# Format code with Prettier
npm run format

# Lint and auto-fix
npm run lint
```

## High-Level Architecture

### Core Modules Structure
The application follows NestJS modular architecture with clear separation of concerns:

- **Auth Module**: JWT-based authentication with refresh tokens, role-based access control
- **Users Module**: User management with organizational hierarchy
- **Meetings Module**: Core meeting orchestration with WebSocket gateway for real-time updates
- **BigBlueButton Module**: BBB integration for video conferencing with bot automation
- **AI Module**: AI services for transcription, summarization, and content analysis  
- **Search Module**: Vector-based semantic search for meeting content
- **Integrations Module**: External service integrations (calendars, CRM, etc.)
- **Processing Module**: Background job processing for audio/video analysis
- **Webhooks Module**: External webhook handling and notifications

### Authentication Flow
- JWT access tokens (7-day expiry) with refresh tokens (30-day expiry)
- Role-based permissions: USER, ADMIN, ORG_ADMIN
- Public endpoints marked with `@Public()` decorator
- Global JWT guard with role-based authorization

### BigBlueButton Integration
- Custom bot service that automatically joins meetings
- Real-time audio processing and chunking for transcription
- Webhook endpoints for BBB meeting events
- Recording management and playback URL generation

### Database Schema (Prisma)
Key entities and relationships:
- **User** → **Organization** (many-to-one)
- **Meeting** → **User** (host), **Organization**, **Participants** (many-to-many)
- **Meeting** → **Transcript**, **Summary**, **ActionItem**, **AudioChunk** (one-to-many)
- **RefreshToken** → **User** (many-to-one for session management)

### Background Processing
- Bull queues for audio processing and meeting events
- Redis for queue management and caching
- Scheduled tasks for cleanup and maintenance

### Real-time Features
- WebSocket gateway in `/meetings` namespace
- Real-time transcript updates during meetings
- Live participant tracking and meeting status updates
- Socket.io rooms for meeting-specific broadcasts

## Configuration Requirements

### Environment Variables
```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/fireflies"

# JWT Authentication
JWT_SECRET="your-jwt-secret"
JWT_EXPIRES_IN="7d"
JWT_REFRESH_SECRET="your-refresh-secret"
JWT_REFRESH_EXPIRES_IN="30d"

# BigBlueButton
BBB_API_URL="https://your-bbb-server/bigbluebutton/api"
BBB_SECRET_KEY="your-bbb-secret"

# Redis (for queues)
REDIS_HOST="localhost"
REDIS_PORT="6379"

# CORS
CORS_ORIGIN="http://localhost:3000"

# API Configuration
PORT="3001"
API_PREFIX="api/v1"
SWAGGER_ENABLED="true"
SWAGGER_PATH="/api/docs"
```

### Database Setup
1. Ensure PostgreSQL is running
2. Set DATABASE_URL environment variable
3. Run `npm run db:migrate` to apply schema
4. Run `npm run db:seed` to populate initial data

### Redis Setup
Redis is required for background job processing. Ensure Redis is running locally or configure REDIS_HOST/PORT for remote instance.

## Development Patterns

### Module Structure
Each module follows consistent patterns:
- `*.service.ts` - Business logic and data access
- `*.controller.ts` - HTTP endpoints with Swagger documentation
- `*.gateway.ts` - WebSocket handlers (where applicable)
- `dto/` - Data transfer objects with validation decorators
- `guards/` - Custom authorization guards
- `decorators/` - Custom parameter decorators

### Error Handling
- Global exception filters for Prisma and HTTP errors
- Custom exception filters in `src/common/filters/`
- Consistent error response format across all endpoints

### Validation
- Global validation pipe with whitelist and transform enabled
- DTO classes use class-validator decorators
- Input transformation for type safety

### API Documentation
- Swagger documentation auto-generated from decorators
- Available at `/api/docs` when SWAGGER_ENABLED=true
- API tagged by domain (auth, meetings, transcripts, etc.)

## Common Development Workflows

### Adding New Endpoints
1. Define DTOs with validation decorators
2. Create service methods with proper error handling
3. Add controller endpoints with Swagger decorators
4. Apply appropriate guards and role restrictions
5. Write unit tests for service logic

### Database Schema Changes
1. Modify `prisma/schema.prisma`
2. Run `npm run db:migrate` to create migration
3. Run `npm run db:generate` to update Prisma client
4. Update affected services and DTOs

### Background Jobs
Use Bull queues for long-running tasks:
```typescript
@InjectQueue('audio-processing')
private audioQueue: Queue
```

### WebSocket Events
Emit real-time updates through MeetingsGateway:
```typescript
this.meetingsGateway.emitTranscriptUpdate(meetingId, transcript);
```

## Key Integration Points

### Meeting Lifecycle
1. Meeting created in database
2. BBB meeting created via API
3. Bot joins meeting for recording/transcription
4. Real-time processing of audio chunks
5. AI analysis generates summaries and action items
6. WebSocket updates broadcast to connected clients

### Audio Processing Pipeline
1. BBB webhook triggers audio chunk processing
2. Audio uploaded to S3/storage service
3. Background job processes audio through transcription service
4. Transcript segments stored with timestamps
5. Vector embeddings generated for semantic search

### Search Integration
Meeting content indexed for semantic search using vector embeddings. Search spans across transcripts, summaries, and action items.
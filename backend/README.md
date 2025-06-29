# Talk With Legolas - Backend

Real-time chat application backend with user authentication, WebSocket communication, and persistent message storage.

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env

# Run database migrations
npm run prisma:migrate

# Start development server
npm run dev

# Run tests
npm test
```

## Tech Stack

| Category | Technologies |
|----------|-------------|
| Runtime | Node.js, TypeScript |
| API | tRPC, WebSocket |
| Database | PostgreSQL, Prisma ORM |
| Container | Docker, Docker Compose |
| Security | JWT, Crypto |

## Database Models

```mermaid
erDiagram
    User {
        string id PK
        string username UK
        string password
        boolean online
        datetime createdAt
    }
    Thread {
        string id PK
        string[] participants
        datetime createdAt
        datetime updatedAt
    }
    Message {
        string id PK
        string content
        string senderId FK
        string threadId FK
        boolean unread
        datetime createdAt
    }
    User ||--o{ Message : sends
    Thread ||--o{ Message : contains
    User }|--o{ Thread : participates
```

## API Endpoints

### Authentication
- `auth.login`: Login with username/password, returns JWT token
- `auth.logout`: Update user's online status to offline

### Messages
- `message.getMessages`: Get paginated messages for a thread
- `message.send`: Send a new message in a thread
- `message.typing`: Update typing status in a thread
- `message.markAsRead`: Mark thread messages as read

### Threads
- `thread.getThreads`: Get user's threads with last message
- `thread.createThread`: Create a new thread with another user

## WebSocket Events

| Event | Description |
|-------|-------------|
| `new_message` | New message in thread |
| `typing_status` | User typing indicator |
| `online_status` | User online/offline updates |
| `new_thread` | New thread created |

## Security

- **JWT Authentication**: 
  - 1-hour token expiration
  - Used for both HTTP and WebSocket connections
  - Token verification middleware for protected routes

- **Password Security**: 
  - Scrypt hashing with salt
  - 32-byte salt length
  - 64-byte key length

- **WebSocket Security**:
  - Token validation on connection
  - Per-thread access verification
  - Automatic disconnect handling

- **Access Control**:
  - Protected routes with tRPC middleware
  - Thread-level access verification
  - User online status tracking

- **Error Handling**:
  - Custom error types
  - Structured error responses
  - Secure error messages

- **Logging**:
  - Request/Response logging
  - Error logging with stack traces
  - Request ID tracking
  - Environment-based debug logging

## Environment Variables

```env
# Server
PORT=3000                  # Server port number
NODE_ENV=development      # Environment (development/production)

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/dbname

# Security
JWT_SECRET=your-secret-key    # JWT signing key        # Token expiration time
```

## Docker Deployment

```bash
# Build and start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Development

```bash
# Generate Prisma client
npm run prisma:generate

# Run linting
npm run lint

# Run type checking
npm run type-check

# Build for production
npm run build
``` 
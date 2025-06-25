# Talk With Legolas

# Roadmap

This roadmap outlines the high-level phases to implement the real-time messaging app “Talk With Legolas” using the chosen tech stack. It focuses on major milestones and includes database table definitions and API endpoints.

---

## 1. Repository & Project Structure
- Initialize Git repository named “TalkWithLegolas”.
- Establish directory layout for backend and frontend.
- Define essential environment variables and configuration placeholders.
- Document technology choices and overall approach.

---

## 2. Backend Foundation
- Set up a Node.js + TypeScript project.
- Configure Prisma ORM with Postgres (via Docker) and prepare database schema models.
- Implement JWT-based authentication with seeded users.
- Establish tRPC server structure and context for protected routes.
- Prepare WebSocket (tRPC subscription) support for real-time messaging.

### Database Tables


| Table     | Column        | Type                   | Description                                      |
|-----------|---------------|------------------------|--------------------------------------------------|
| **users**   | id            | UUID (Primary Key)     | Unique identifier for each user                  |
|           | username      | String, Unique         | User’s login name                                |
|           | createdAt     | Timestamp              | When the user was created                        |
| **threads** | id            | UUID (Primary Key)     | Unique identifier for each thread                |
|           | participants  | UUID[] (array)         | Array of user IDs participating in the thread    |
|           | createdAt     | Timestamp              | When the thread was created                      |
|           | updatedAt     | Timestamp              | Last update timestamp (e.g., when a new message arrives) |
| **messages** | id            | UUID (Primary Key)     | Unique identifier for each message               |
|            | threadId      | UUID (Foreign Key)     | References `threads.id`                          |
|            | senderId      | UUID (Foreign Key)     | References `users.id`                            |
|            | content       | Text                   | Message content                                  |
|            | createdAt     | Timestamp              | When the message was sent                        |

---

## 3. Frontend Foundation
- Set up React + TypeScript project via Vite.
- Configure Tailwind CSS.
- Initialize tRPC client integration and JWT storage in localStorage.
- Create basic authentication context and login interface.

---

## 4. Core Messaging Features
- Implement thread listing and “create new thread” functionality.
- Implement chat view: fetching and displaying messages in chronological order.
- Implement send-message API and UI integration.

---

## 5. Real-Time Communication (with Presence & Typing)
- Configure tRPC subscription for message events per thread.
- Enable clients to subscribe to thread channels for real-time message delivery.
- Implement online presence notifications:
  - When a user connects (e.g., opens the app or chat), publish an “online” event to other participants in threads they share.
  - When a user disconnects or becomes inactive, publish an “offline” event.
- Implement typing indicators:
  - When a user starts or stops typing in a chat, send a typing-status update to the server.
  - Server publishes typing events to other subscribers in the same thread, so they can see “User is typing...” in real time.
- Handle reconnection and missed events in a basic form (e.g., refetch recent state on reconnect).

---

## API Endpoints / Procedures

| Procedure / Endpoint    | Type         | Auth Required | Input                             | Output / Description                                               |
|-------------------------|--------------|---------------|-----------------------------------|----------------------------------------------------------------------|
| **login**               | Mutation     | No            | `{ username: string }` | `{ token: string }` on success; error otherwise                     |
| **getThreads**          | Query        | Yes           | ―                                 | Array of `{ threadId: UUID, otherUsernames: string[] }`             |
| **createThread**        | Mutation     | Yes           | `{ otherUserId: string }`       | `{ threadId: UUID }`; creates new or returns existing thread        |
| **getMessages**         | Query        | Yes           | `{ threadId: UUID }`              | Array of `{ id: UUID, senderId: UUID, content: string, createdAt: string }` in ascending order |
| **sendMessage**         | Mutation     | Yes           | `{ threadId: UUID, content: string }` | `{ id: UUID, senderId: UUID, content: string, createdAt: string }`; saves message and triggers real-time publish |
| **onMessage**           | Subscription | Yes           | `{ threadId: UUID }`              | Stream of `{ id: UUID, senderId: UUID, content: string, createdAt: string }` events as messages arrive |

- **Authentication**:  
  - The `login` procedure returns a JWT.  
  - All other procedures require the JWT (e.g., sent in `Authorization: Bearer <token>`) and verify the user before proceeding.

- **Real-Time Messaging**:  
  - Clients subscribe via `onMessage({ threadId })`.  
  - The backend’s `sendMessage` mutation publishes new message events to that subscription channel.

- **Presence & Typing**:  
  - Clients subscribe via `onPresence({ threadId })` to receive online/offline events for participants in that thread.  
  - Clients call `sendTypingStatus({ threadId, isTyping })` when the user starts/stops typing; backend publishes via `onTyping({ threadId })` so other participants see typing indicators.

---

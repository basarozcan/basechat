# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

Base Chat is a multi-tenant RAG chatbot built with Next.js 15 that integrates with Ragie's retrieval infrastructure. The application allows organizations to create chatbots powered by their own knowledge bases through document connections and retrieval-augmented generation.

## Common Commands

### Development

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm run start
```

### Database

```bash
# Run database migrations (required after schema changes)
npm run db:migrate

# Generate new migration files
npm run db:generate
```

### Testing

```bash
# Run all tests
npm test

# Run a specific test file
node --experimental-vm-modules node_modules/jest/bin/jest.js path/to/test.spec.ts
```

### Linting

```bash
# Run ESLint
npm run lint
```

### Utility Scripts

```bash
# Update Ragie API key for a tenant
npm run update-api-key

# Update partition limit for a tenant
npm run update-partition-limit

# Update partition limits for all tenants
npm run update-all-partition-limits

# Enable Claude Sonnet 4 for a tenant
npm run enable-claude-sonnet-4

# Migrate to disabled models schema
npm run migrate-to-disabled-models
```

## Architecture

### Multi-Tenancy Model

The application uses a hierarchical multi-tenant architecture:

- **Tenants**: Organizations with their own data partitions in Ragie
- **Profiles**: User memberships within tenants with roles (admin, user, guest)
- **Conversations**: Chat sessions scoped to a tenant and profile
- **Messages**: Individual chat messages with retrieval metadata

### Database Schema (Drizzle ORM)

Primary tables defined in `lib/server/db/schema.ts`:

- `tenants`: Organization settings, Ragie partition info, billing metadata, custom prompts, model preferences
- `profiles`: User-tenant relationships with role-based access control
- `conversations`: Chat sessions with optional Slack integration
- `messages`: Chat messages with sources, model info, and agentic retrieval data
- `connections`: Ragie data source connections (documents, integrations)
- `invites`: Pending team member invitations
- `users`, `sessions`, `accounts`, `verifications`: Auth.js/better-auth tables

### Authentication (better-auth)

- Configured in `auth.ts` with Drizzle adapter
- Supports email/password and Google OAuth (configurable via env vars)
- Email verification and password reset flows
- Anonymous user support with account linking
- Middleware in `middleware.ts` handles auth redirects and unauthenticated routes

### LLM Provider Integration

Multi-provider support configured in `lib/llm/types.ts`:

- **OpenAI**: GPT-4o, GPT-4.1, o3, GPT-5
- **Google**: Gemini 2.5 Flash, Gemini 2.5 Pro
- **Anthropic**: Claude 3.5 Haiku, Claude 4 Opus, Claude 4.5 Sonnet
- **Groq**: Llama 4 Scout, GPT-OSS models, Kimi K2

Default model: `claude-sonnet-4-5-20250929`

Each model has custom temperature and system prompt configurations. Model-specific logic is centralized in `PROVIDER_CONFIG`.

### RAG Implementation

- **Standard Retrieval**: Direct Ragie API queries with configurable breadth/rerank/recency
- **Agentic Retrieval**: Multi-step reasoning with query decomposition (stored in `message.agenticInfo`)
- Retrieval parameters can be overridden at tenant or message level
- Sources are tracked per message and referenced in responses

### API Routes Structure

Next.js App Router with nested API routes:

- `/api/auth/[...all]`: better-auth endpoints
- `/api/tenants/*`: Tenant CRUD, member management, settings
- `/api/conversations/*`: Conversation and message handling
- `/api/connections/*`: Data source management
- `/api/setup`: Initial tenant creation

All API routes follow REST conventions and use Zod schemas from `lib/api.ts` for validation.

### Server-Side Service Layer

Core business logic in `lib/server/service.tsx`:

- Tenant creation with Ragie partition provisioning
- User profile and invitation management
- Connection lifecycle (create, sync, delete)
- Email notifications (verification, password reset, invites)
- Billing integration (Stripe/Orb when enabled)

Helper modules:

- `lib/server/ragie.ts`: Ragie client initialization with per-tenant API keys
- `lib/server/encryption.ts`: Secure credential storage
- `lib/server/settings.ts`: Environment variable validation
- `lib/server/billing.ts`: Stripe/Orb integration
- `lib/server/slack.ts`: Slack bot integration

### Frontend Architecture

- **App Router Layout Groups**: `(auth)`, `(main)`, `(pricing)` for different layouts
- **Route Organization**:
  - `/o/[slug]`: Tenant-specific chat interface
  - `/setup`: Initial tenant creation flow
  - `/sign-in`, `/sign-up`, `/reset`: Auth flows
  - `/pricing/[slug]`: Billing and plan management
- **UI Components**: shadcn/ui with Radix primitives (configured via `components.json`)
- **Styling**: Tailwind CSS with CSS variables for theming
- **State Management**: React Query for server state, React hooks for local state

### Key Component Areas

- `components/chatbot/*`: Main chat interface components
- `components/agentic-retriever/*`: Agentic search UI and types
- `components/billing/*`: Subscription and payment flows
- `components/ui/*`: shadcn/ui primitives
- `components/tenant/*`: Tenant-specific settings UI

### Environment Configuration

Required environment variables (see `env.example` for full list):

- `DATABASE_URL`: PostgreSQL connection string
- `RAGIE_API_KEY`: Default Ragie API key (tenants can override)
- `ENCRYPTION_KEY`: 32-byte hex for credential encryption (generate with `openssl rand -hex 32`)
- `DEFAULT_PARTITION_LIMIT`: Max pages per tenant partition
- At least one LLM provider API key
- `AUTH_GOOGLE_ID` + `AUTH_GOOGLE_SECRET` for OAuth

Optional:

- `USE_REDIS` + `REDIS_URL`: Enable Redis caching
- `BILLING_ENABLED` + Stripe/Orb credentials
- `STORAGE_*`: S3-compatible storage for tenant logos

### Caching Strategy

- Optional Redis cache handler (`cache-handler.cjs`) with tenant/user-specific tag invalidation
- Next.js `unstable_cache` with custom tags: `buildTenantTag(tenantId)`, `buildTenantUserTag(tenantId, userId)`
- Manual revalidation via `revalidateTag` after mutations

### Testing Approach

- Jest with Next.js integration (`jest.config.ts`)
- Test setup in `lib/test/setup.ts`
- Test files use `.spec.ts` extension (e.g., `lib/server/service.spec.ts`)
- React Testing Library for component tests

## Important Notes

### When Modifying Database Schema

1. Update `lib/server/db/schema.ts`
2. Run `npm run db:generate` to create migration files
3. Run `npm run db:migrate` to apply migrations
4. Update corresponding Zod schemas in `lib/api.ts` if API contracts change

### When Adding LLM Providers

1. Add to `PROVIDER_CONFIG` in `lib/llm/types.ts`
2. Update `app/api/conversations/[conversationId]/messages/utils.ts` with Vercel AI SDK integration
3. Ensure required API key environment variables are documented

### When Creating New API Routes

1. Define Zod schemas in `lib/api.ts` for request/response validation
2. Use tenant isolation: always filter by `tenantId` from session
3. Follow existing patterns for error handling and response formatting
4. Consider cache invalidation if mutations affect tenant data

### Multi-Tenant Considerations

- Always filter database queries by `tenantId` to prevent cross-tenant data leaks
- Ragie partitions are tenant-scoped via `getRagieClientAndPartition(tenantId)`
- Session middleware validates tenant access through profiles
- Logo storage and billing are per-tenant

### Slack Integration

- When enabled, conversations can be synced to Slack threads
- Bot token and team ID stored per tenant
- Response modes: "mentions" (only respond when mentioned) or "all" (respond to all messages in configured channels)

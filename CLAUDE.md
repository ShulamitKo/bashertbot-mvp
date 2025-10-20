# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BashertBot MVP is an AI-powered matchmaking system for shadchanim (matchmakers) built with React + TypeScript + Vite. It uses Supabase for all data storage (candidates, shadchan profiles, proposals, sessions), OpenAI GPT for intelligent matching analysis, and optionally integrates with Google Sheets for candidate import. The project migrated from Google Sheets-only storage to full Supabase persistence.

**Primary Language**: Hebrew (UI, comments, database fields)

## Development Commands

### Development
```bash
npm run dev          # Start dev server on http://localhost:5173
```

### Build & Test
```bash
npm run build        # TypeScript compilation + Vite build
npm run preview      # Preview production build
npm run lint         # ESLint with TypeScript
```

## Architecture

### Data Flow & Storage Model
- **Candidate Data**: Stored in Supabase `candidates` table with full profile information (30+ fields)
- **Optional Google Sheets Integration**: Can import candidates from Google Sheets (males in "בנים" tab, females in "בנות" tab), but data is persisted to Supabase
- **Supabase Tables**: Stores all data including candidates, shadchan profiles, match proposals, matching sessions, and contact actions
- **OpenAI**: Receives candidate data temporarily for match analysis, returns structured scores and reasoning
- **Migration History**: Project originally used Google Sheets as primary storage, now migrated to full Supabase persistence

### Core Matching Algorithm (3-Stage Pipeline)
Located in `src/lib/openai.ts`:

1. **Stage 1 - Hard Filters** (`applyHardFilters`):
   - Age difference, religious level compatibility, marital status, community preferences, deal-breakers
   - Configured via `AdvancedMatchingSettings.hardFilters`

2. **Stage 2 - Logical Scoring** (`calculateLogicalScore`):
   - Calculates 0-10 score based on weighted factors (age, location, education, values, personality)
   - Configured via `AdvancedMatchingSettings.weights`
   - Cost optimization: Filters out low-scoring pairs before expensive GPT analysis

3. **Stage 3 - GPT Analysis** (`analyzeMatchWithGPT`):
   - Deep compatibility analysis using GPT-4o or GPT-4o-mini
   - Returns: score (1-10), summary, strengths[], concerns[]
   - Configurable: model, temperature, focus areas, analysis depth

**Final Score**: Average of logical score and GPT score

### Key TypeScript Types (`src/types/index.ts`)

- **`Shadchan`**: Matchmaker profile with settings and API keys
- **`MatchProposal`**: Match proposal with dual scoring (logical + GPT), detailed status tracking, contact management
- **`DetailedCandidate`**: Comprehensive candidate profile (30+ fields including demographics, preferences, values, hobbies, deal-breakers)
- **`SupabaseCandidate`**: Database representation of candidate with all fields mapped to Supabase schema
- **`AdvancedMatchingSettings`**: Full configuration object with weights, filters, GPT settings, search profiles
- **`SimplifiedShadchanSettings`**: UI-friendly version - either selects built-in profile ('classic', 'professional', 'emotional') or custom settings
- **Built-in Profiles** (`BUILTIN_PROFILES` in types/index.ts):
  - `classic`: Traditional matchmaking (high weights on religious level, family background, values)
  - `professional`: Career-focused (high weights on education, profession, life goals)
  - `emotional`: Personality-driven (high weights on personality, hobbies, values)

### Matching Sessions System (`src/lib/sessions.ts`)
- **Active Session**: One session per shadchan, stores current matching batch
- **History**: Up to 10 previous sessions (position 1-10), auto-rotates when creating new session
- Sessions contain full match data including GPT analysis to avoid re-computation
- Users can restore proposals from history back to active state

### Proposal Status Flow
Defined in `match_proposals.status` (see `supabase/schema.sql`):
```
ready_for_processing → rejected (by shadchan)
                    → in_meeting_process → ready_for_contact → contacting
                                                             → awaiting_response → rejected_by_candidate
                                                                                → schedule_meeting → meeting_scheduled
                                                                                                  → meeting_completed → completed → closed
                                        → restored_to_active (from history)
```

Advanced tracking includes:
- `boy_contacted`, `girl_contacted` booleans
- `boy_response`, `girl_response` enums: 'pending' | 'interested' | 'not_interested' | 'needs_time'
- `contact_method`: 'email' | 'whatsapp' | 'phone' | 'mixed'
- `rejection_reason`, `rejection_side`: 'boy' | 'girl' | 'both' | 'shadchan'

### Google Sheets Integration (`src/lib/google-sheets.ts`)
**Legacy Feature** - Optional import from Google Sheets:

**Sheet Structure** (columns A-Z):
- Column A: שם (Name)
- Column B: גיל (Age)
- Column C: מצב משפחתי (Marital Status)
- Column D: רמה דתית (Religious Level)
- ... ~30 total fields including email, phone, education, profession, hobbies, values, deal-breakers

**Functions**:
- `getSheetTabs()`: List all tabs in spreadsheet (for import)
- `getSheetData()`: Fetch raw data from specific tab (for import)
- `parseCandidatesFromSheet()`: Parse sheet rows into `DetailedCandidate[]` (for import)
- `applyHardFilters()`: Stage 1 filtering (used in matching algorithm)
- `calculateLogicalScore()`: Stage 2 scoring (used in matching algorithm)

**Note**: Google Sheets is now used primarily for bulk import. All data is stored in Supabase.

### Component Architecture

**Main Pages**:
- `src/pages/LoginPage.tsx`: Supabase authentication
- `src/pages/DashboardPage.tsx`: Main dashboard with 5 tabs (50,000+ token file - use offset/limit when reading):
  1. התאמות חדשות (New Matches) - Active session management
  2. הצעות פעילות (Active Proposals) - Proposal workflow management
  3. היסטוריה (History) - Past sessions and failed proposals
  4. מועמדים (Candidates) - Full candidate management (CRUD)
  5. הגדרות (Settings) - Unified settings panel

**Key Components**:
- `src/components/CandidatesList.tsx`: View, edit, delete candidates
- `src/components/CandidateForm.tsx`: Add/edit candidate form
- `src/components/SmartImport.tsx`: Excel import with intelligent field mapping
- `src/components/ui/UnifiedSettingsPanel.tsx`: Google Sheets, OpenAI, and matching settings
- `src/components/ui/ProposalCard.tsx`: Match proposal display with actions

### Settings Management (`src/lib/settings.ts`)
Handles conversion between:
- **Simplified UI Settings**: What users see in the settings panel
- **Advanced Backend Settings**: Full `AdvancedMatchingSettings` object stored in Supabase

Functions:
- `expandSimplifiedSettings()`: UI → Backend
- `simplifyAdvancedSettings()`: Backend → UI

### Prompt Generation (`src/lib/prompt-generator.ts`)
Centralized prompt building for GPT matching:
- `buildSystemPrompt()`: Creates system message with shadchan's focus areas and analysis depth
- `createMatchPrompt()`: Builds detailed user message with candidate profiles
- Supports custom prompts or auto-generation from settings

## Environment Variables

Required in `.env`:
```env
VITE_SUPABASE_URL=            # Supabase project URL
VITE_SUPABASE_ANON_KEY=       # Supabase anonymous key
VITE_GOOGLE_CLIENT_ID=        # Google OAuth 2.0 client ID
VITE_GOOGLE_CLIENT_SECRET=    # Google OAuth secret
VITE_OPENAI_API_KEY=          # OpenAI API key
```

## Database Schema (`supabase/schema.sql`)

**Key Tables**:
- `shadchanim`: Matchmaker profiles with `advanced_matching_settings` JSONB
- `candidates`: Full candidate profiles (previously stored in Google Sheets, now in Supabase)
- `candidate_contacts`: Sensitive contact information (email, phone) separated from main candidate data
- `matching_sessions`: Matching session history with auto-rotation (max 10)
- `match_proposals`: Proposal metadata with dual scoring, status tracking, contact history
- `rejections`: **Currently unused** - Previously for blacklist, now duplicate prevention handled by unique constraint on match_proposals
- `activity_log`: Audit trail
- `contact_actions`: Contact attempt tracking

**RLS (Row Level Security)**: Enabled on all tables - users can only access their own data

**Unique Constraints**:
- One active session per shadchan
- No duplicate proposals (shadchan_id + boy_row_id + girl_row_id) - this constraint prevents duplicate matches
- Unique candidate internal_id per shadchan

## Important Implementation Notes

### Cost Optimization Strategy
The 3-stage pipeline significantly reduces OpenAI costs:
- Hard filters eliminate incompatible pairs immediately
- Logical scoring (0-10) filters out low-potential matches before GPT
- Only top candidates (e.g., logical score ≥ 6) get GPT analysis
- Result: 60-80% cost reduction vs analyzing all pairs

### Preventing Duplicate Proposals
- Database unique constraint on (shadchan_id, boy_row_id, girl_row_id) prevents duplicate matches
- The `rejections` table exists in schema but is **currently unused**
- Duplicate prevention is handled entirely by the unique constraint on match_proposals table

### Candidate Data Loading (`src/lib/candidates.ts`)
Primary storage in Supabase:
1. Load from Supabase `candidates` table (primary method)
2. Optional: Import from Google Sheets API (for bulk import/migration)
3. All candidates stored in Supabase after import

### Hebrew Text Handling
- RTL layout throughout UI
- All user-facing text in Hebrew
- Database field names in English, values in Hebrew
- GPT prompts in Hebrew for better cultural context

### Excel Import Feature (`src/components/SmartImport.tsx`)
- Uses `xlsx` library to parse Excel files
- Intelligent column mapping (auto-detects Hebrew column headers)
- Validates data before import
- Bulk insert to Supabase with conflict handling

## Common Tasks

### Adding a New Candidate Field
1. Update `SupabaseCandidate` interface in `src/types/index.ts`
2. Update Supabase schema in `supabase/schema.sql` (add column to `candidates` table)
3. Update candidate form in `src/components/CandidateForm.tsx`
4. Update Google Sheets column mapping in `src/lib/google-sheets.ts` (`COLUMN_MAPPING`) if importing from sheets
5. Update `DetailedCandidate` interface if needed for backward compatibility

### Modifying Matching Logic
1. Hard filters: Edit `applyHardFilters()` in `src/lib/google-sheets.ts`
2. Logical scoring: Edit `calculateLogicalScore()` weights in `src/lib/google-sheets.ts`
3. GPT analysis: Modify prompts in `src/lib/prompt-generator.ts`

### Adding a New Built-in Profile
1. Add to `BUILTIN_PROFILES` in `src/types/index.ts`
2. Update `SimplifiedShadchanSettings.selectedProfile` type
3. Add UI option in `src/components/ui/UnifiedSettingsPanel.tsx`

### Debugging Match Analysis
- Check console logs with prefixes: 🔍 (filters), 🧮 (scoring), 🤖 (GPT), 📊 (results)
- GPT prompts are logged in full before API calls
- Matching stats (`MatchingStats`) track performance and costs

## Git Workflow

**Main Branch**: `main` (no separate main branch mentioned in git status)

**Recent Commits** (as of project start):
- Migration to Supabase with duplicate prevention
- Full candidate management (view, edit, add, delete)
- Smart Excel import with intelligent field mapping
- Session fixes: modal speed, click-outside-to-close, styled alerts
- Advanced proposal workflow with contact tracking

## External Dependencies

**Key Libraries**:
- `react` + `react-dom`: UI framework
- `react-router-dom`: Routing
- `@supabase/supabase-js`: Backend, database & auth (primary data storage)
- `openai`: GPT integration for matching analysis
- `axios`: Google Sheets API calls (for optional import)
- `react-hook-form` + `zod` + `@hookform/resolvers`: Form validation
- `xlsx`: Excel file parsing for bulk import
- `tailwindcss` + `class-variance-authority` + `clsx`: Styling
- `lucide-react`: Icons

## Testing Strategy

Currently no automated tests. Manual testing focuses on:
- Complete matching pipeline with Supabase candidate data
- Cost tracking (GPT API usage)
- Duplicate prevention via unique constraints
- Session management and rotation
- Proposal status transitions
- Excel/Google Sheets import validation
- CRUD operations on candidates

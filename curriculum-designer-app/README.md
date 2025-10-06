# Curriculum Designer - Standalone Application

A standalone Next.js application for curriculum designers to create, edit, and manage educational content. This application connects to the `curriculum-authoring-service` backend and provides a professional interface for curriculum authoring.

## 🎯 Purpose

This is a **local-only admin tool** for curriculum designers. It is NOT part of the student-facing application and does not require Firebase authentication. It's designed to run locally on a designer's machine.

## ✨ Features

- **Visual Curriculum Tree** - Navigate Subject → Unit → Skill → Subskill hierarchy
- **Entity Editor** - Forms for creating and editing all curriculum entities
- **Prerequisites Management** - Define learning paths and dependencies
- **AI Generation** - Create complete units with AI assistance
- **Draft/Publish Workflow** - Review changes before publishing
- **Version Control** - Full version history with rollback capability

## 📋 Prerequisites

- Node.js 18+ and npm
- `curriculum-authoring-service` running on port 8001

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd curriculum-designer-app
npm install
```

### 2. Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit .env (default values should work for local development)
```

The `.env` file should contain:
```env
NEXT_PUBLIC_AUTHORING_API_URL=http://localhost:8001
NEXT_PUBLIC_REQUIRE_AUTH=false
```

### 3. Start Backend Service

In a separate terminal, start the curriculum authoring service:

```bash
cd curriculum-authoring-service
uvicorn app.main:app --reload --port 8001
```

### 4. Start the Frontend

```bash
npm run dev
```

The application will start on **http://localhost:3001**

## 📖 Usage Guide

### Creating Curriculum

1. **Select a Subject**
   - Use the dropdown at the top to select a subject
   - Or create a new subject

2. **Navigate the Tree**
   - Click entities in the left panel to select them
   - Use chevrons to expand/collapse nodes
   - Draft entities are marked with yellow badges

3. **Edit Entities**
   - Click an entity to view it in the editor
   - Modify fields and click "Save Changes"
   - Changes are saved as drafts automatically

4. **AI Generation**
   - Click "AI Generate" button
   - Enter topic details (subject, grade level, concept)
   - Review generated structure
   - Save as draft

5. **Prerequisites**
   - Select a skill or subskill
   - Click "Prerequisites" tab
   - View what this entity needs (prerequisites)
   - View what this entity unlocks (forward links)
   - Add/remove prerequisite relationships

6. **Publishing**
   - Go to "Draft Changes" tab
   - Review all pending changes
   - Click "Publish" button
   - Enter version description and summary
   - Confirm publication

7. **Version History**
   - Go to "Version History" tab
   - View version timeline
   - Rollback to previous versions if needed

## 🏗️ Architecture

### Tech Stack
- **Framework**: Next.js 14 (App Router)
- **UI**: React + TypeScript
- **State Management**: React Query (TanStack Query)
- **Forms**: React Hook Form
- **UI Components**: Radix UI + Tailwind CSS
- **API**: REST API to curriculum-authoring-service

### Directory Structure
```
curriculum-designer-app/
├── app/
│   ├── layout.tsx          # Root layout with React Query
│   ├── page.tsx            # Main curriculum designer interface
│   └── globals.css         # Global styles
├── components/
│   ├── curriculum-designer/
│   │   ├── tree/          # Tree view components
│   │   ├── editor/        # Entity editor forms
│   │   ├── prerequisites/ # Prerequisite management
│   │   ├── ai/            # AI generation features
│   │   └── publishing/    # Draft and version control
│   └── ui/                # Reusable UI components
├── lib/
│   ├── curriculum-authoring/
│   │   ├── api.ts         # API client
│   │   └── hooks.ts       # React Query hooks
│   └── utils.ts           # Utility functions
├── types/
│   └── curriculum-authoring.ts # TypeScript types
└── package.json
```

## 🔧 Development

### Available Scripts

```bash
# Start development server (port 3001)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint
```

### Adding New Features

1. **Define Types** in `types/curriculum-authoring.ts`
2. **Add API Method** in `lib/curriculum-authoring/api.ts`
3. **Create Hook** in `lib/curriculum-authoring/hooks.ts`
4. **Build UI Component** in `components/`
5. **Integrate** in `app/page.tsx`

### React Query DevTools

DevTools are enabled in development mode. Press the React Query icon in the bottom-left corner to:
- Inspect cached queries
- View query state
- Manually refetch data
- See mutation history

## 🔌 API Integration

### Backend Service

This app connects to `curriculum-authoring-service` on port 8001. Ensure it's running:

```bash
# Check if service is running
curl http://localhost:8001/health

# View API documentation
open http://localhost:8001/docs
```

### API Endpoints Used

- **Curriculum**: `/api/curriculum/*` - CRUD operations
- **Prerequisites**: `/api/prerequisites/*` - Learning path management
- **AI**: `/api/ai/*` - AI-powered generation
- **Publishing**: `/api/publishing/*` - Draft and version control

### No Authentication Required

This standalone app does not require Firebase authentication. All API requests are made without auth headers, suitable for local development.

## 🐛 Troubleshooting

### Port Already in Use

If port 3001 is taken:
```bash
npm run dev -- -p 3002
```

### Cannot Connect to Backend

1. Verify authoring service is running:
   ```bash
   curl http://localhost:8001/health
   ```

2. Check `.env` configuration:
   ```env
   NEXT_PUBLIC_AUTHORING_API_URL=http://localhost:8001
   ```

3. Review browser console for errors

### Curriculum Tree Won't Load

1. Check backend logs for errors
2. Verify BigQuery is configured in authoring service
3. Ensure subject exists in database
4. Check Network tab in browser DevTools

### AI Generation Fails

1. Verify `GEMINI_API_KEY` is set in authoring service
2. Check authoring service logs
3. Ensure topic prompt is provided

### Changes Not Saving

1. Check browser console for API errors
2. Verify backend service is running
3. Check that draft version is being created
4. Review backend logs

## 📝 Development Notes

### Differences from Student App

This standalone app is **separate** from `my-tutoring-app`:
- No Firebase authentication
- Different port (3001 vs 3000)
- Admin/designer focused UI
- Local development only
- Connects only to authoring service

### State Management

- **Server State**: React Query (cached queries, mutations)
- **Form State**: React Hook Form (local form state)
- **UI State**: React useState/useReducer

### Styling

- Tailwind CSS with custom theme
- shadcn/ui components
- Consistent with PRD design guidelines

## 🚦 Production Deployment

### Build for Production

```bash
npm run build
```

### Deploy Options

1. **Vercel** (Recommended)
   ```bash
   npm install -g vercel
   vercel
   ```

2. **Docker**
   ```dockerfile
   FROM node:18-alpine
   WORKDIR /app
   COPY package*.json ./
   RUN npm install
   COPY . .
   RUN npm run build
   EXPOSE 3001
   CMD ["npm", "start"]
   ```

3. **Static Export** (if no server features needed)
   ```bash
   # Add to next.config.js
   output: 'export'

   npm run build
   # Deploy /out directory
   ```

### Environment Variables

For production, set:
```env
NEXT_PUBLIC_AUTHORING_API_URL=https://your-authoring-service.com
```

## 📚 Additional Resources

- **Backend API Docs**: http://localhost:8001/docs
- **Backend QUICKSTART**: `../curriculum-authoring-service/QUICKSTART.md`
- **PRD**: See project root for product requirements

## 🤝 Contributing

This is an internal tool. When adding features:
1. Follow existing component patterns
2. Use TypeScript strictly
3. Add loading and error states
4. Match existing UI/UX conventions
5. Update this README

## 📄 License

Proprietary - Internal Use Only

## 🎉 Success Metrics

You know the app is working when:
✓ Curriculum tree loads
✓ Entities can be edited
✓ Prerequisites can be managed
✓ AI generation works
✓ Publishing completes successfully
✓ Version history is accessible

---

**Happy Curriculum Authoring!** 🎓

For questions or issues, check the backend service logs and browser console first.

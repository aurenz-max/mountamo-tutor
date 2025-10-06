# Curriculum Designer App - Setup Checklist

## ✅ Pre-Setup Verification

- [ ] Node.js 18+ installed (`node --version`)
- [ ] npm installed (`npm --version`)
- [ ] `curriculum-authoring-service` directory exists
- [ ] You're in the project root directory

## 📦 Step 1: Install Dependencies

```bash
cd curriculum-designer-app
npm install
```

**Expected output:** All packages installed successfully

**Check:**
- [ ] `node_modules/` directory created
- [ ] No error messages during install

## ⚙️ Step 2: Configure Environment

```bash
# Copy example file
cp .env.example .env

# Verify contents (should work as-is for local dev)
cat .env
```

**Expected contents:**
```env
NEXT_PUBLIC_AUTHORING_API_URL=http://localhost:8001
NEXT_PUBLIC_REQUIRE_AUTH=false
```

**Check:**
- [ ] `.env` file created
- [ ] API URL points to port 8001
- [ ] Auth is disabled

## 🔧 Step 3: Start Backend Service

Open a NEW terminal and run:

```bash
cd curriculum-authoring-service
uvicorn app.main:app --reload --port 8001
```

**Expected output:**
```
INFO:     Uvicorn running on http://127.0.0.1:8001
INFO:     Application startup complete.
```

**Check:**
- [ ] Service starts without errors
- [ ] Running on port 8001
- [ ] No "port already in use" error

**Verify backend is running:**
```bash
# In another terminal
curl http://localhost:8001/health
```

**Expected:** `{"status":"healthy"}` or similar

## 🚀 Step 4: Start Frontend

In another terminal:

```bash
cd curriculum-designer-app
npm run dev
```

**Expected output:**
```
- ready started server on 0.0.0.0:3001
- info Loaded env from .env
- ready compiled successfully
```

**Check:**
- [ ] Server starts on port 3001
- [ ] No compilation errors
- [ ] Opens automatically or shows URL

## 🌐 Step 5: Access Application

Open your browser:

**URL:** http://localhost:3001

**Check:**
- [ ] Page loads without errors
- [ ] See "Curriculum Designer" header
- [ ] Subject dropdown is present
- [ ] No console errors (F12)

## 🧪 Step 6: Basic Functionality Test

### Test 1: Subject Selection
- [ ] Click subject dropdown
- [ ] See list of subjects (or empty if none)
- [ ] Can select a subject

### Test 2: Curriculum Tree
- [ ] After selecting subject, tree loads in left panel
- [ ] Can expand/collapse nodes
- [ ] Click on entity selects it

### Test 3: Entity Editor
- [ ] Click an entity in tree
- [ ] Editor panel opens on right
- [ ] Form fields are editable
- [ ] "Save Changes" button present

### Test 4: Tabs Navigation
- [ ] Click "Prerequisites" tab (if entity selected)
- [ ] Click "Draft Changes" tab
- [ ] Click "Version History" tab
- [ ] All tabs switch without errors

### Test 5: AI Generation
- [ ] Click "AI Generate" button (top right)
- [ ] Modal opens with form
- [ ] Can enter topic details
- [ ] "Generate Unit" button present

## 🐛 Troubleshooting

### Issue: Port 3001 already in use
```bash
# Kill process on port
# Windows:
netstat -ano | findstr :3001
taskkill /PID <PID> /F

# Mac/Linux:
lsof -ti:3001 | xargs kill -9

# Or use different port:
npm run dev -- -p 3002
```

### Issue: Cannot connect to backend
```bash
# Check if authoring service is running
curl http://localhost:8001/health

# If not running, start it:
cd curriculum-authoring-service
uvicorn app.main:app --reload --port 8001
```

### Issue: Dependencies won't install
```bash
# Clear cache and retry
rm -rf node_modules package-lock.json
npm install
```

### Issue: Blank page or errors
```bash
# Check browser console (F12)
# Check terminal for errors
# Verify .env file exists
# Restart dev server
```

## ✅ Success Verification

All checks passed when:

### Backend Service
- ✅ Running on port 8001
- ✅ Health check responds
- ✅ No error messages

### Frontend App
- ✅ Running on port 3001
- ✅ Page loads in browser
- ✅ No console errors
- ✅ Subject dropdown works

### Features Work
- ✅ Can select subjects
- ✅ Tree view displays
- ✅ Entity editor opens
- ✅ Tabs switch correctly
- ✅ AI modal opens

## 🎉 You're Ready!

If all checks pass, your standalone curriculum designer is ready to use!

**Next Steps:**
1. Read `README.md` for detailed usage guide
2. Try creating curriculum with AI
3. Explore the entity editor
4. Test the publishing workflow

## 📞 Need Help?

**Check these resources:**
1. Terminal error messages
2. Browser console (F12 → Console tab)
3. Backend logs (terminal running uvicorn)
4. `README.md` - Full documentation
5. `STANDALONE_APP_SUMMARY.md` - Overview

**Common Files to Check:**
- `.env` - Environment configuration
- `package.json` - Dependencies
- Backend service logs
- Browser Network tab (F12)

---

**Happy Curriculum Authoring!** 🎓

# Creative OS — Deploy Guide

## What you need
- Node.js installed (https://nodejs.org — LTS version)
- A GitHub account (free)
- A Vercel account (free — https://vercel.com, sign up with GitHub)
- Your Anthropic API key (https://console.anthropic.com)
- Your OpenAI API key (https://platform.openai.com/api-keys)

---

## Step 1 — Put this folder on GitHub

1. Go to https://github.com/new
2. Create a new repository called `creative-os` (private is fine)
3. Open Terminal (Mac) or Command Prompt (Windows) in this folder
4. Run these commands one at a time:

```
npm install
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/creative-os.git
git push -u origin main
```

Replace YOUR_USERNAME with your GitHub username.

---

## Step 2 — Deploy on Vercel

1. Go to https://vercel.com and sign in with GitHub
2. Click "Add New Project"
3. Find and import your `creative-os` repository
4. Vercel will auto-detect it as a Vite project — leave all settings as default
5. Before clicking Deploy, click "Environment Variables" and add:

   - Name: `ANTHROPIC_API_KEY`  Value: your Anthropic key
   - Name: `OPENAI_API_KEY`     Value: your OpenAI key

6. Click Deploy

That's it. Vercel gives you a live URL like `https://creative-os-xyz.vercel.app`

---

## Step 3 — Local development (optional)

If you want to run it locally:

1. Copy `.env.example` to `.env.local`
2. Fill in your actual API keys in `.env.local`
3. Install Vercel CLI: `npm install -g vercel`
4. Run: `vercel dev`

This runs the full app including the API routes locally.

DO NOT use `npm run dev` alone — it won't have the API routes.
Use `vercel dev` instead.

---

## How the architecture works

```
Browser (React app)
    ↓ /api/anthropic
Vercel serverless function (api/anthropic.js)
    ↓ injects ANTHROPIC_API_KEY
Anthropic API — all text intelligence

Browser (React app)
    ↓ /api/vision
Vercel serverless function (api/vision.js)
    ↓ injects OPENAI_API_KEY
OpenAI GPT-4o — all image analysis
```

Your API keys never touch the browser. They live only in Vercel's environment.

---

## Future updates

Any time you want to update the app:

```
git add .
git commit -m "Your update message"
git push
```

Vercel auto-deploys on every push. Live in ~30 seconds.

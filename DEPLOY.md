# Northledger — Deploy to Vercel (iPad install guide)

## What's in this folder

```
northledger/
├── app/
│   ├── layout.jsx          ← Root layout + PWA meta tags
│   ├── globals.css         ← Tailwind + global styles
│   ├── page.jsx            ← Entry point
│   ├── dashboard.jsx       ← Full app (all pages)
│   └── api/chat/route.js   ← Server-side Claude API proxy
├── public/
│   └── manifest.json       ← PWA manifest (iPad install)
├── package.json
├── next.config.js
├── tailwind.config.js
└── postcss.config.js
```

---

## Step 1 — Get a free Anthropic API key

1. Go to https://console.anthropic.com
2. Sign up → API Keys → Create key
3. Copy the key (starts with `sk-ant-...`)

---

## Step 2 — Put the code on GitHub (free)

1. Go to https://github.com and sign up if you don't have an account
2. Click **New repository** → name it `northledger` → Create
3. Click **uploading an existing file**
4. Upload all the files in this folder keeping the folder structure:
   - `app/layout.jsx`
   - `app/globals.css`
   - `app/page.jsx`
   - `app/dashboard.jsx`
   - `app/api/chat/route.js`
   - `public/manifest.json`
   - `package.json`
   - `next.config.js`
   - `tailwind.config.js`
   - `postcss.config.js`
5. Click **Commit changes**

---

## Step 3 — Deploy on Vercel (free)

1. Go to https://vercel.com and sign up with your GitHub account
2. Click **Add New → Project**
3. Select your `northledger` repo → click **Import**
4. Under **Environment Variables**, add:
   - Name: `ANTHROPIC_API_KEY`
   - Value: paste your key from Step 1
5. Click **Deploy**
6. Wait ~60 seconds → Vercel gives you a URL like `northledger.vercel.app`

---

## Step 4 — Add to iPad home screen

1. Open Safari on your iPad (must be Safari, not Chrome)
2. Go to your Vercel URL (e.g. `https://northledger.vercel.app`)
3. Tap the **Share** button (box with arrow pointing up)
4. Scroll down → tap **Add to Home Screen**
5. Name it **Northledger** → tap **Add**

It will now appear on your iPad home screen and launch fullscreen
like a native app.

---

## Optional: Add a custom icon

The app will use a default icon unless you add your own.
To add a custom icon:
1. Create a 512×512 PNG image of your logo
2. Save two copies:
   - `public/icon-192.png` (resize to 192×192)
   - `public/icon-512.png` (keep at 512×512)
3. Push to GitHub → Vercel auto-redeploys

---

## Updating the app later

Any time you push a change to GitHub, Vercel automatically
redeploys within ~30 seconds. The iPad home screen app
will pick up the update on next launch — no reinstall needed.

---

## Costs

- GitHub: free
- Vercel (Hobby plan): free
- Anthropic API: free tier includes enough credits to test;
  AI Insights tab costs roughly $0.001–0.003 per conversation
  (very cheap — $5 in credits lasts a long time)
- Custom domain (optional): ~$12/year from Namecheap or Google Domains

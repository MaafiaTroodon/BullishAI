# Netlify Pages Not Loading - Fix Guide

## Problem
- All pages show "Loading..." and never render
- Build succeeds but pages don't load
- Empty body tag in HTML

## Root Cause
The pages are likely stuck because:
1. Client-side hooks (especially `authClient.useSession()`) are hanging
2. API calls are failing silently
3. No error boundaries to catch and handle failures
4. Pages might be statically generated when they need to be dynamic

## Fixes Applied

### 1. Made Auth Non-Blocking
- Added error handling to `authClient.useSession()` calls
- Pages now render even if auth check fails
- Added console warnings for debugging

### 2. Force Dynamic Rendering
- Added `export const dynamic = 'force-dynamic'` to pages that need it
- Prevents static generation issues

### 3. Improved Auth Client
- Better baseURL detection
- Proper fallbacks

## What to Check

### 1. Verify Netlify Plugin is Working
Check Netlify build logs for:
```
@netlify/plugin-nextjs
```

If you don't see this, the plugin isn't installed. Run:
```bash
npm install
git add package.json package-lock.json
git commit -m "Install Netlify Next.js plugin"
git push
```

### 2. Check Browser Console
Open browser DevTools → Console and look for:
- Any red errors
- Network tab → Check if API calls are failing
- Check if `/api/auth/get-session` is returning 200 or erroring

### 3. Verify Environment Variables
In Netlify Dashboard → Environment Variables, ensure:
- `BETTER_AUTH_URL` = `https://bullishai.netlify.app`
- `BETTER_AUTH_SECRET` is set
- All other API keys are set

### 4. Test API Routes Directly
Try accessing:
- `https://bullishai.netlify.app/api/_debug`
- `https://bullishai.netlify.app/api/quote?symbol=AAPL`

If these work, the issue is client-side. If they don't, the issue is server-side.

## Quick Debug Steps

1. **Check if it's an auth issue:**
   - Open browser console
   - Look for errors related to `/api/auth/get-session`
   - If you see 403/500 errors, the auth config is wrong

2. **Check if it's a routing issue:**
   - Try accessing a static page like `/about`
   - If static pages work but dynamic don't, it's a Next.js config issue

3. **Check Netlify Functions:**
   - Go to Netlify Dashboard → Functions
   - See if serverless functions are created
   - Check function logs for errors

## If Still Not Working

1. **Clear Netlify cache:**
   - Netlify Dashboard → Deploys → Trigger deploy → Clear cache and deploy site

2. **Check build logs:**
   - Look for any warnings or errors during build
   - Check if Prisma generate is working
   - Verify all dependencies are installed

3. **Test locally with production build:**
   ```bash
   npm run build
   npm start
   ```
   Then visit `http://localhost:3000` - if it works locally but not on Netlify, it's a Netlify config issue.

4. **Check Netlify Runtime:**
   - Make sure Node.js version is 20 (set in netlify.toml)
   - Check if there are any runtime errors in Netlify logs

## Expected Behavior After Fix

- Pages should render immediately (even if some data is loading)
- Auth should not block page rendering
- Console should show warnings (not errors) if auth fails
- All pages should work: home, dashboard, etc.


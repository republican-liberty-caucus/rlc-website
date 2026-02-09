# Testing Workflow - Vercel Production Only

## CRITICAL: Never Suggest Local Dev Testing

Matt's workflow uses **Vercel production deployments ONLY** for testing. Never suggest:
- Running local dev server
- Testing on localhost
- "npm run dev" 
- Viewing at localhost:3000
- "Hard refresh your browser" (when changes haven't deployed yet)
- "Restart the dev server"

## Correct Testing Workflow

1. Make code changes
2. Commit and push to GitHub
3. Vercel auto-deploys to production (2026.rlc.org)
4. Test on production URL after deployment completes (~2-3 minutes)

## Why This Matters

- Local dev environment may behave differently than production
- Matt's testing workflow is optimized for production deployments
- Saves time by not maintaining local dev environment
- Ensures all testing happens in the actual production environment

## When Making Changes

1. ✅ Make changes in codebase
2. ✅ Commit with clear message
3. ✅ Push to trigger Vercel deployment  
4. ✅ Wait for deployment to complete
5. ✅ Test on production URL (2026.rlc.org)

## Never Do

- ❌ Suggest "restart dev server"
- ❌ Suggest "test on localhost"
- ❌ Suggest "run npm run dev"
- ❌ Ask to check local environment
- ❌ Suggest browser refresh before deployment completes

## Deployment Monitoring

Use `vercel ls` or check Vercel dashboard to monitor deployment status. Deployments typically take 2-3 minutes.

## Example Correct Response

"I've pushed the changes to main. Vercel will deploy in ~2-3 minutes. Once deployed, you can test on 2026.rlc.org."

## Example WRONG Response

"Try refreshing your browser or restart the dev server to see the changes."

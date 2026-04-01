# Frontend Branch + Env Workflow

## Branches
- `master`: production-ready branch
- `dev`: integration branch for testing
- `feat/*`, `fix/*`: short-lived branches from `dev`

## Environment separation
Use templates:
- `frontend/.env.development.example`
- `frontend/.env.production.example`

For local development:
1. Copy `frontend/.env.development.example` to `frontend/.env.development.local`
2. Set `VITE_API_BASE_URL` to your dev backend URL
3. If frontend will call Supabase directly, use test project keys only

## Suggested flow
1. `git switch dev`
2. `git switch -c feat/<name>`
3. Commit changes
4. Merge to `dev` and test
5. Merge `dev` to `master` only after validation

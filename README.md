# DesiOS V1 Corporate Operations UI

DesiOS V1 is a tablet-first operations execution interface for DesiEats campus dining.
This implementation is a high-fidelity frontend prototype aligned to the provided product specification and tuned for a corporate operations environment.

## Implemented Scope

- Corporate command-center layout with side navigation and compliance status ring
- Home dashboard with operational rhythm timeline and weekly compliance indicators
- Checklist module with opening workflow task-by-task progression and compliance gates
- Temperature logging workflow with validation thresholds and critical alert generation
- Waste logging form and live entry list
- Data Hub forecast table using weighted moving average and waste adjustment logic
- SOP viewer panel with key operational sections

## Technology

- React 19
- TypeScript
- Vite 8
- Plain CSS design system (no UI framework)

## Run Locally

1. Install dependencies

   npm install

2. Start development server

   npm run dev

3. Build production bundle

   npm run build

4. Preview production bundle

   npm run preview

## Notes

- The UI still includes prototype visual modules, but checklist/temp/waste/auth/alerts now persist to Supabase.
- Sales import parsing and reporting exports remain a next phase.

## Supabase Wiring (Now Implemented)

The app now has live Supabase integration for:

- Auth: email and password sign-in/sign-out
- Database persistence: checklist tasks, temperature logs, waste entries, alerts
- Realtime: live alert stream subscription
- Storage: temperature proof photo upload to bucket temp-proofs

### 1. Configure Environment

Copy .env.example to .env and fill values:

- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY

### 2. Apply Schema

Run these SQL files in order in your Supabase SQL editor:

- supabase/schema.sql
- supabase/migrations/20260418_auth_and_checklist_hardening.sql

This creates:

- All V1 spec tables and indexes
- RLS helpers + policies scoped by location_id
- Unsafe temp trigger alert insertion
- evaluate_alerts RPC function for checklist and missed check escalation rules
- transition_checklist_completion RPC with strict server-side status transition validation
- auth.users trigger to auto-create public.users profile rows on signup
- temp-proofs storage bucket and storage policies
- Seed records for checklist definitions, opening tasks, and temp items

### 3. Deploy Edge Escalation Function

Deploy the function:

- supabase/functions/alert-escalation/index.ts

Set secrets in Supabase project:

- ESCALATION_WEBHOOK_URL
- RESEND_API_KEY
- ESCALATION_EMAIL_TO
- ESCALATION_EMAIL_FROM

Then create a Supabase Database Webhook (Dashboard):

- Table: public.alerts
- Event: INSERT
- Filter: severity=eq.critical AND is_escalated=eq.true
- Endpoint: your deployed alert-escalation function URL

This enables external escalation delivery by webhook and/or email for critical alerts.

### 4. Auth Profile Provisioning

Manual profile inserts are no longer required for normal signup flow.

Profiles are auto-created from auth.users by trigger, with:

- location_id assigned to the first available location (or auto-created default location)
- role derived from user metadata role (defaults to staff)
- display_name derived from metadata name/display_name or email prefix

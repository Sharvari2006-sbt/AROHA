# Aroha — Product Requirements (Foundation, UI-only)

## Vision
A premium, calming AI Digital Twin educational companion. Serves three personas — independent Student, Parent, and Child — with a warm, hand-drawn, Headspace-inspired aesthetic.

## Scope (this iteration)
Foundation only: beautiful UI + navigation with mock data. **No backend, no real auth, no AI, no DB.**

## Design system
- Cream surface `#FDFBF7`, deep espresso text `#4A4036`.
- Accents: sage `#9CAF88`, warm orange `#F4A261`, mustard `#E9C46A`.
- Radii 12/16/24/pill; soft shadows; 8pt spacing.
- Custom SVG robot mascot + organic blob backgrounds (no PNG mascot).
- Custom floating pill bottom tab bar.

## Screens delivered
1. **Splash** (`/`) — animated cream splash with SVG robot mascot floating, glow, particles, auto-transitions to `/welcome` after ~2.8s.
2. **Welcome** (`/welcome`) — headline "Your AI Digital Twin that grows with you." + two elevated cards (Independent, Supervised).
3. **Role Selector** (`/auth/role`) — Parent vs Child cards.
4. **Auth screens** — Student login/signup, Parent login/signup, Child login/signup (with Parent Invite Code field). Mock auth (client-side validation only, ~700ms delay).
5. **Student tabs** (`/student/*`) — Home, Subjects, Study, Analytics, Profile.
6. **Parent tabs** (`/parent/*`) — Home, Schedule, Students, Analytics, Profile.
7. **Child tabs** (`/child/*`) — Home, Tasks, Study, Quiz, Profile.

## Mock credentials
Any valid-looking email + 4+ char password works. Child role additionally requires any non-empty invite code (e.g., `TWIN-4821`).

## Out of scope (deferred)
- Real backend / DB
- Actual auth (JWT / OAuth)
- AI Digital Twin logic
- Study session engine, quizzes engine
- Push notifications

# Admin OTP, order coordination, and responsive marketplace fixes

- Base: `c41695f7157a2ed1c42db3992fb493559a493467` (`origin/main`).
- Admin OTP now requires an explicit send/resend action after Turnstile, avoiding token-change auto-send races.
- Meetup location/time remain optional and editable before seller handoff.
- Cart badge is positioned relative to the cart button.
- Seller storefront tabs use equal-width mobile controls so all four fit at the 390px target.
- Checks passed: targeted Turnstile and chat/listing/order UX (33/33), TypeScript, ESLint, tests (22/22), production build.
- Local browser passed page load/content, no error overlay, no console errors, desktop cart anchor, and mobile overflow checks.
- NOT VERIFIED: real Supabase email delivery, Turnstile challenge, seller-data storefront rendering, staging, and production.

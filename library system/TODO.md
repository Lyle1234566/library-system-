# TODO

Status snapshot on March 29, 2026.

This file only tracks work that is still genuinely open.

## High Priority

### 1. Production rollout

- [ ] Create the final GitHub repo structure used for deployment
- [ ] Provision the Railway volume and final production environment variables
- [ ] Verify production `SECRET_KEY`, allowed hosts, CORS, CSRF, and media path settings on the live host
- [ ] Run the deployment checklist end to end against the target host
- [ ] Confirm uploaded covers and avatars survive a backend redeploy

### 2. Barcode and QR workflow

- [ ] Add barcode or QR display for physical copies in staff-facing UI
- [ ] Add printable label flow if needed by circulation staff
- [ ] Add scanner flow in mobile or dedicated staff interface
- [ ] Test lookup/checkout behavior against real devices

## Medium Priority

### 3. Mobile recommendation surface

- [ ] Add similar-book recommendations to the mobile book detail screen
- [ ] Add personalized recommendations to the mobile dashboard
- [ ] Validate small-screen layout and loading states

### 4. API documentation

- [ ] Publish endpoint documentation
- [ ] Document auth, role restrictions, and key circulation flows
- [ ] Add examples for recommendations, reservations, renewals, and fines

### 5. Release polish

- [ ] Review outdated auxiliary docs beyond the main status files
- [ ] Add a final smoke-test checklist for web, mobile, and admin flows
- [ ] Decide whether to keep recommendation scope web-only for the first release or ship the mobile surface now

## Completed Recently

- [x] Similar-book recommendations on the web book detail page
- [x] Personalized recommendations on the web dashboard
- [x] Backend recommendation endpoints
- [x] README, implementation status, and todo cleanup

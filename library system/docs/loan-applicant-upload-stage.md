# Loan Application App - Applicant Information Upload Stage

This document defines the feature list and workflow for the Applicant Information Upload stage of a loan application mobile app, with emphasis on the documents that must be uploaded.

---

## Document Checklist (Primary Focus)

**Required documents (typical)**
- Government ID (front/back or single-page passport)
- Selfie or liveness capture
- Payslips (last 1-3 months)
- Bank statements (last 3-6 months)

**Optional documents (based on lender policy)**
- Certificate of employment
- Tax forms (e.g., ITR, W-2, 1099)
- Proof of address (utility bill, lease agreement)
- Business registration (self-employed applicants)

**Validation rules**
- Accepted formats: PDF/JPG/PNG
- File size limits (e.g., < 8MB per file)
- Minimum resolution for OCR
- Required date ranges must be covered (e.g., payslips within last 90 days)
- All edges visible (camera capture)

**UX considerations**
- Upload checklist with "Required / Optional" badges
- Live camera with edge detection and auto-crop
- Retake / replace flow without losing progress
- Clear error messages (e.g., "Blurry image, please retake")

---

## 1) Personal Information Form

**User flow**
1. Applicant lands on the Personal Information step.
2. Enters details and taps Continue.
3. Inline errors display if invalid.

**Required fields**
- Full legal name (first, middle, last)
- Date of birth
- Gender (optional if regulated)
- Civil status
- Nationality
- Mobile number
- Email address
- Current address (street, district, city, province/state, ZIP)
- Length of stay at address

**Validation rules**
- Name: letters + common punctuation only, min 2 characters
- DOB: must be 18+ (or local legal age)
- Mobile: country format and length check
- Email: valid email regex
- ZIP: numeric and correct length for country
- Address: non-empty, min length

**UX considerations**
- Autofill support (OS autofill for name/address)
- Input masks for phone and DOB
- Helper hints (e.g., "Use your legal name as it appears on your ID")

---

## 2) Government ID Upload and Verification

**User flow**
1. Select ID type (Driver's License, Passport, National ID, etc.).
2. Capture front/back using camera or upload from gallery.
3. Automatic OCR and quality check runs.
4. If verified, user proceeds; if not, prompts to retry.

**Required fields**
- ID type
- Front and back images (or single if passport)
- ID number (auto-filled via OCR, editable)

**Validation rules**
- Image clarity (blur/glare detection)
- All four edges visible
- ID expiry date must be valid and not expired
- OCR match confidence threshold

**UX considerations**
- Live camera guidelines (outline frame)
- Auto-capture when stable
- "Quality pass/fail" feedback

---

## 3) Selfie or Face Verification

**User flow**
1. User is prompted to take a selfie.
2. Liveness check (blink, turn head, smile).
3. Face is matched to ID photo.

**Required fields**
- Selfie image or short video for liveness

**Validation rules**
- Face detection confidence
- Liveness check success
- Match score >= threshold

**UX considerations**
- Clear instructions (e.g., "Look at the camera, blink twice")
- Lighting warning
- Progress indicator during verification

---

## 4) Employment and Income Details

**User flow**
1. User selects employment type.
2. Form adapts (employed, self-employed, freelance).
3. Continue when required fields are filled.

**Required fields**
- Employment type
- Employer/business name
- Job title or occupation
- Employment start date
- Monthly/annual gross income
- Pay frequency

**Validation rules**
- Income must be numeric and positive
- Start date cannot be in the future
- Employment length must be realistic (e.g., > 0 months)

**UX considerations**
- Currency selector or locked to country
- Inline calculator (monthly vs annual)

---

## 5) Financial Information

**User flow**
1. Applicant enters liabilities and assets.
2. Optional banking details if required.

**Required fields**
- Monthly expenses
- Outstanding loans/credit obligations
- Primary bank (optional or required by lender)
- Existing credit card balances (optional)

**Validation rules**
- Numeric only, no negative values
- Expenses <= income (soft warning if exceeded)

**UX considerations**
- Soft warnings for high debt-to-income
- Tooltips explaining why data is needed

---

## 6) Document Uploads (Payslips, Bank Statements)

**User flow**
1. Applicant uploads required documents.
2. System checks format and readability.
3. OCR validates amounts/dates.

**Required fields**
- Payslips (last 1-3 months)
- Bank statements (last 3-6 months)
- Additional documents (optional: tax forms, proof of address)

**Validation rules**
- Accepted formats: PDF/JPG/PNG
- Minimum resolution for OCR
- Must cover required date range

**UX considerations**
- Checklist showing required documents
- "Scan using camera" flow with edge detection
- Auto-crop and rotate

---

## 7) Real-time Validation of Inputs

**Features**
- Instant inline error indicators
- Masked fields for dates/phone
- Smart suggestions for address

**Examples**
- Red highlight and error text under invalid inputs
- "We found a typo in your ID number" prompt

---

## 8) Application Progress Tracker

**Features**
- Stepper with completed/current/upcoming states
- Estimated time per step
- Save and resume

**UX considerations**
- Clear visual progress
- Ability to navigate back without data loss

---

## 9) Security and Data Protection Features

**Features**
- End-to-end encryption on upload
- Secure storage (at-rest encryption)
- Session timeout and auto-logout
- Consent checkboxes for data usage

**UX considerations**
- Trust indicators ("Your data is encrypted")
- Privacy policy links

---

## 10) Review and Submit Stage

**User flow**
1. Summary screen shows all info.
2. User can edit sections.
3. User accepts final consent.
4. Submit button

**Required fields**
- Digital signature/consent
- Final acknowledgment

**Validation rules**
- Must accept terms and consent before submission

**UX considerations**
- Clear "Review & Submit" call-to-action
- Highlight missing or unverified items


# LOADSETU Verification and Subscription setup

## Backend setup
1. Keep your existing `backend/.env` locally; it is not included in the update ZIP.
2. Copy the variables from `backend/.env.example` into your existing `.env` and fill them privately.
3. Install dependencies with `npm install` in `backend` (not `npm ci` on the old lockfile; npm install will refresh the lockfile for nodemailer).
4. Configure `DOCUMENT_ENCRYPTION_KEY` to a long random secret and keep it stable. Existing JWT_SECRET is used only as a compatibility fallback.
5. Configure SMTP_HOST/PORT/USER/PASS/FROM for verification emails. Without SMTP settings, verification decisions still save but emails are not delivered.
6. Configure Razorpay test credentials first. The frontend key ID is returned from the backend; the secret remains server-side.

## Feature behavior
- Newly registered broker accounts are VERIFIED; new factory-owner (`shipper`) and transporter accounts start as PENDING_VERIFICATION.
- Factory owner signup requires a GSTIN in the standard 15-character format.
- Transporter signup requires Aadhaar and Driving License documents in PDF/JPG/PNG format, max 3 MB each. Document data is encrypted with AES-256-GCM before it is stored in MongoDB. The broker document endpoint is authenticated and broker-only.
- Broker dashboard includes a Verification tab. Verify/reject actions persist to MongoDB; verification email is attempted on approval when SMTP is configured.
- `/api/loads` POST and `/api/trucks/profile` POST enforce verification and active subscription on the server. Existing truck profiles can still be updated without a subscription; creating a new truck requires one.
- Subscription plans are Monthly ₹299, Half-Yearly ₹599, and Yearly ₹999. Razorpay orders are created server-side; checkout signatures are verified server-side before activation.
- Existing accounts without a verification status are treated as VERIFIED by the schema default for compatibility. Newly signed-up non-broker users are explicitly pending.
- Existing loads/trucks are not deleted on subscription expiry. No matching algorithm or route-leg model changes are made.

## Important operational notes
- Use HTTPS in production.
- Keep `.env`, identity documents and payment secrets out of Git and ZIP distributions.
- Use Razorpay test mode until end-to-end testing is complete.
- This implementation does not rely on the browser callback alone: server-side signature validation is required before subscription activation.

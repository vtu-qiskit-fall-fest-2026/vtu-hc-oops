# LOADSETU local verification + Razorpay Test Mode setup

## Local URLs
- Frontend: http://localhost:5173
- Backend: http://localhost:5000
- API: same-origin `/api` from Vite, proxied to `http://localhost:5000`
- Webhooks: not used in this local phase.

## Environment
Keep the existing `backend/.env` unchanged and add only these values if missing:

```env
RAZORPAY_KEY_ID=rzp_test_your_actual_key_id
RAZORPAY_KEY_SECRET=your_actual_test_key_secret
```

Do not commit `.env`. The backend `.gitignore` excludes it. Do not put the secret in a `VITE_` variable or frontend source. Keep existing `MONGODB_URI`, `JWT_SECRET`, and any other existing settings. For verification email delivery, configure the existing mail account through `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and optional `SMTP_FROM`; if SMTP is not configured, verification is still saved, but no email is sent.

## Dependencies
From the backend folder, run `npm install` (not `npm ci` against the old lockfile) so the newly added `razorpay`, `multer`, and `nodemailer` dependencies are resolved and the lockfile refreshed. From frontend, run `npm install` if needed.

## API routes added
- `GET /api/subscriptions/plans` — supported plans and prices.
- `GET /api/subscriptions/me` — current user's subscription status.
- `POST /api/subscriptions/orders` — creates a trusted server-priced Razorpay order and pending DB record. Body: `{ "plan": "MONTHLY" | "HALF_YEARLY" | "YEARLY" }`.
- `POST /api/subscriptions/verify` — verifies checkout signature and fetches/captures the payment server-side before activating subscription. Body is the standard checkout response fields `razorpay_order_id`, `razorpay_payment_id`, `razorpay_signature`.
- `GET /api/broker/verifications` — broker-only pending/rejected verification requests.
- `GET /api/broker/verifications/:userId/documents/:documentType` — broker-only private document access (`aadhaar`, `driving-license`).
- `PATCH /api/broker/verifications/:userId` — broker-only verification action; body `{ "status": "VERIFIED" | "REJECTED", "reason": "optional" }`.

## Plans
- Monthly: ₹299 / 1 calendar month (29900 paise)
- Half-Yearly: ₹599 / 6 calendar months (59900 paise)
- Yearly: ₹999 / 12 calendar months (99900 paise)

## Local test flow
1. Start backend with `npm run dev` in `backend`.
2. Start frontend with `npm run dev` in `frontend`.
3. Register a transporter with Aadhaar + driving-license files or a factory owner with a valid-format GSTIN. These accounts remain pending.
4. Log in as an existing broker, open **Verification requests**, and verify the test account.
5. Configure SMTP if you want verification emails; otherwise the UI reports that the verification was saved but email was not sent.
6. Log in as the verified factory/transporter and attempt Create Load/Register Truck. You are sent to the subscription page if no active subscription exists.
7. Choose a plan and complete Razorpay Test Mode checkout. The backend checks the signature and retrieves payment status; authorized payments are captured server-side and checked again.
8. After the backend reports activation, the user can create loads/trucks. Direct API calls are also gated by backend middleware.

## Security notes
- Private verification documents are saved under `backend/private_uploads/verification`, which is not served as a static directory. Only the authenticated broker document endpoint can stream them.
- Do not commit `.env` or `private_uploads`.
- No webhook is required for local testing. Without webhooks, a checkout closed before the verification callback or delayed provider updates may require a user retry or manual reconciliation. Add signed webhooks and reconciliation before production.
- Existing records without a verification status are treated as verified for backwards compatibility. Newly registered factory owners and transporters are pending until a broker reviews them.

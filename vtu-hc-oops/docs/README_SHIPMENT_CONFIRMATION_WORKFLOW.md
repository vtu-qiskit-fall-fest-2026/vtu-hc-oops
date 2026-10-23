# LOADSETU shipment confirmation workflow update

This patch extends the existing React/Vite + Express/MongoDB application. It does not replace the app or add roles/admin/cloud storage.

## What's added
- Secure 256-bit confirmation token links (only a SHA-256 hash is stored in MongoDB; link expires after 72 hours).
- Broker-created bookings now return a confirmation link and the Broker dashboard exposes pre-filled WhatsApp actions for both participants. WhatsApp still requires the sender to press Send.
- Participant-only confirmation details, server-recorded terms acceptance and timestamp, separate participant payment records, backend Razorpay order creation/signature verification/capture checks, and shipment confirmation only after both payments are captured and both acceptances exist.
- Separate Terms & Conditions page and required checkbox.
- Backend pricing module: ₹5/km deposit and ₹3/km broker commission. To avoid charging the same broker commission twice, this implementation charges the commission once to the Factory Owner; the Transporter pays the deposit. Other platform charges are currently ₹0 because the supplied code had no additional shipment confirmation fee.
- Coordinate validation and backend Haversine distance calculation. The supplied Load model had text locations but no pickup/delivery coordinates or routing integration, so the UI asks the Factory Owner to enter verified coordinates when absent and clearly labels the result as a straight-line estimate, not road distance. Payment is blocked until valid coordinates are saved.
- Participant-only emergency cancellation after confirmed payment, idempotent status transition, 50/50 deposit allocation ledger, load/truck release using existing records, and email/WhatsApp cancellation notifications. Payouts are not automated by the existing integration; allocations are correctly labelled `pending_settlement`.
- Payment receipts to both participants, including who paid, status, and Razorpay order/payment references.

## Important setup
1. Extract the ZIP into your project workspace; keep your own `.env` outside the archive. The supplied backend `.env` and private verification uploads were intentionally excluded from this deliverable for security/privacy.
2. In `backend`, copy `.env.example` to `.env` and put your existing MongoDB, JWT, Razorpay Test Mode, and SMTP values into it. Do not commit `.env`.
3. Set `FRONTEND_BASE_URL=http://localhost:5173` for local development (or your deployed frontend URL in production). `CLIENT_ORIGIN` should contain the allowed frontend origin.
4. In `frontend`, `npm install` then `npm run dev`. In `backend`, `npm install` then `npm run dev`. The supplied Vite proxy uses port 5000; make sure `PORT` matches the backend port.
5. Existing Load documents do not contain coordinates. The Factory Owner must supply accurate pickup/delivery latitude and longitude on the shipment confirmation page before either payment can be created. Do not enter guessed coordinates. A future enhancement can connect a geocoder/road-routing provider, but none existed in the supplied project.
6. Razorpay keys must be Test Mode keys for local testing. SMTP is needed for email receipts. Without SMTP configuration, payment and cancellation still update their database records, but email sending is skipped with a server warning.
7. No automated Razorpay payouts are made. Deposit allocations remain pending settlement. No webhook was introduced.

## API routes added
All routes require an authenticated user:
- `GET /api/bookings/confirmation/:token`
- `POST /api/bookings/confirmation/:token/coordinates`
- `POST /api/bookings/confirmation/:token/terms`
- `POST /api/bookings/confirmation/:token/payment/order`
- `POST /api/bookings/confirmation/:token/payment/verify`
- `POST /api/bookings/confirmation/:token/cancel`

## Testing checklist
- Verify Factory Owner and Transporter can open the same link but unrelated accounts receive 403.
- Test both participant orders: each accepts terms and pays, then the second captured payment changes the shipment to Confirmed.
- Test missing/invalid coordinates; order creation must be blocked.
- Test failed signature/payment, repeated verify requests, repeated cancellation requests, expired links, and old links after cancellation.
- Test both cancellation initiators and confirm the existing load/truck records are reused and allocations remain pending settlement.
- Verify regular login, load creation, truck creation, matching, return-trip matching, and existing subscription checkout remain intact.

## Scope note
The supplied code had no road-routing integration and no saved pickup/delivery coordinates on Load. The implementation therefore deliberately uses the prompt-approved straight-line Haversine fallback and requires accurate coordinates before payment rather than fabricating distance. Run a real end-to-end Razorpay test with your own test credentials and MongoDB deployment before using this workflow outside local testing.

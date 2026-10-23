# legacy/

`root-app/` is an older single-folder copy of LoadSetu that used to sit in the repository root
(frontend components and backend controllers mixed in one `src/`, with its own `package.json`
and `vite.config.js`). The live app is `backend/` + `frontend/`; nothing imports from here.

It is kept, not deleted, because it holds the only copy of the **broker verification** feature
(identity-document upload with encryption, verification requests, notification e-mails):

- `root-app/src/components/broker/VerificationRequests.jsx`
- `root-app/src/routes/brokerVerificationRoutes.js`
- `root-app/src/services/documentCrypto.js`, `root-app/src/services/notifications.js`, `root-app/src/middleware/access.js`
- `root-app/.env.example` (adds `DOCUMENT_ENCRYPTION_KEY`, `RAZORPAY_WEBHOOK_SECRET`, SMTP)

Port it into `backend/` and `frontend/` before deleting this folder.

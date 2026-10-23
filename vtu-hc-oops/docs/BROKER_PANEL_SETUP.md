# LOADSETU Broker Panel integration

This package is based on the frontend.zip and backend.zip you supplied. It keeps the existing folder structure and excludes node_modules, .git, build output, and `.env` secrets.

## Apply the patch
1. Make a backup of your current project.
2. Extract the ZIP into a separate temporary folder first, then copy/merge its `frontend` and `backend` folders into your project. Confirm overwrite prompts for patched files only.
3. The broker dashboard is added at `frontend/src/components/broker/BrokerDashboard.jsx` with scoped CSS.
4. `frontend/src/main.jsx` routes `/broker/dashboard` to the new dashboard. Existing Factory UI components remain unchanged.
5. Backend registers `/api/trucks`, `/api/bookings`, and `/api/broker` routes. This also fixes the supplied server not registering the existing truck and booking routers.
6. The broker overview endpoint is `GET /api/broker/overview`; booking/status mutations are role-protected and use the existing Load, Truck, and Booking models.
7. Keep your own `.env` file locally; it is intentionally not included in this ZIP. The uploaded backend archive included `.env`, so rotate the MongoDB password and JWT secret if those values were real and the archive was shared outside your trusted environment.

## Run
Terminal 1:
```powershell
cd backend
npm install
npm run dev
```
Terminal 2:
```powershell
cd frontend
npm install
npm run dev
```

## Signup behavior
The supplied `App.jsx` already sends signup role `broker` to `/broker/dashboard`, role `shipper` (Goods Owner) to `/factory/dashboard`, and `transporter` to `/transporter/dashboard`. The backend User model accepts `broker`, `shipper`, and `transporter`. The route is now connected to the real BrokerDashboard.

## Notes / limitations
- Smart matching is an explainable rule-based score, not an ML model. It checks truck type, capacity, service area/current location, quote against offered price, and availability.
- WhatsApp coordination opens a `wa.me` link using the saved phone number; it does not send automatically. Phone numbers should include country code.
- This dashboard uses existing data models. Shipment GPS/live tracking is not implemented because the current schema has no GPS provider or location history.
- The UI labels current records and displays empty states if no trucks/loads/bookings exist. The database must contain transporter truck profiles for matching to show results.
- The existing booking schema enforces one booking per load. If a cancelled booking is deleted/rebooked, unique index behavior may need a schema migration to support booking history.
- Before production, add transactional handling (MongoDB transactions or robust compensation) for booking creation and status changes, and audit logging for broker admin actions.

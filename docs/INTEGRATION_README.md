# LOADSETU integrated panel update

This package contains the source code from the uploaded frontend/backend ZIPs with targeted fixes and additions.

## Included changes
- Added a real transporter workspace with English/Marathi/Hindi UI labels, theme controls, truck profile registration/update, assigned bookings, WhatsApp contact and shipment status actions.
- Added authenticated transporter overview and booking-status API endpoints.
- Registered transporter routes in Express.
- Enabled PATCH/PUT/DELETE in CORS for authenticated status updates (in addition to GET/POST/OPTIONS).
- Changed broker API client to use the Vite `/api` proxy by default instead of hardcoding `localhost:5000`.
- Added language/theme controls to Factory Loads and Cost & Savings; translated Cost & Savings key labels in English, Marathi and Hindi.
- Changed Factory Shipment Status navigation to show the live My Loads list instead of an unconnected placeholder.
- Preserved existing role signup/login redirects: broker -> `/broker/dashboard`, goods owner (`shipper`) -> `/factory/dashboard`, transporter -> `/transporter/dashboard`.

## Install and run on Windows
1. Back up your existing project.
2. Extract this ZIP to a temporary folder, then merge `frontend` and `backend` into your existing `F:\NEXUS` project.
3. Keep your own `.env` file; it is intentionally not included.
4. In terminal 1:
   `cd F:\NEXUS\backend`
   `npm install`
   `npm run dev`
5. In terminal 2:
   `cd F:\NEXUS\frontend`
   `npm install`
   `npm run dev`
6. Test signup/login with all three roles, switch both themes and all three languages, register a transporter truck, create a factory load, then sign in as broker to match and book it.

## Important behavior and limitations
- Truck matching is a transparent rule-based score, not an ML model. Route fit depends on transporter-entered service areas; it is not live route-distance calculation.
- WhatsApp coordination opens a prefilled wa.me link. It does not provide delivery/read receipts or send messages in the background.
- Shipment monitoring records status changes; it does not provide GPS tracking.
- Cost & Savings remains a visual prototype with illustrative data. Do not use its sample values for business decisions until connected to actual costs and a verified market benchmark.
- The legacy `FactoryPanel.jsx` and `factoryApi.js` in the uploaded source use a different load schema and are not routed by the current app. The active factory flow uses `FactoryDashboard.jsx`, `FactoryLoads.jsx`, `loadApi.js`, `MatchedTrucks.jsx`, and the existing `/api/loads` routes. Do not switch the app to the legacy component without reconciling the schema first.

## Verification
All frontend JS/JSX source files were parsed successfully, and backend JS files passed `node --check`. A Vite production build could not be completed in this environment because the uploaded `node_modules` were installed for Windows and lack the Linux Rollup binary. Run `npm install` and `npm run build` on the Windows machine to verify the native dependencies.

# LOADSETU Factory Panel — Patch Pack

This ZIP contains only the new/changed files for the Factory Panel. It is not a replacement for your existing `F:\NEXUS` project.

## Features included
- Factory dashboard overview and KPI cards
- Create Load form with basic validation
- My Loads search and status cards
- Rule-based truck match score with reasons
- Record/confirm a booking
- WhatsApp contact link when a real phone number is saved
- Shipment status history and allowed status transitions
- Estimated freight savings from recorded quotes
- Responsive layout and reduced-motion support
- Express + MongoDB endpoints protected by the existing JWT auth middleware

## 1. Copy files into your existing project
Copy the contents of the ZIP's `frontend` folder into `F:\NEXUS\frontend` and the contents of the ZIP's `backend` folder into `F:\NEXUS\backend`. Merge folders; do not replace the whole project.

## 2. Backend integration
### Register the new route
Open `backend/src/server.js`.

Add this import with the other route imports:
```js
import factoryRoutes from "./routes/factoryRoutes.js";
```

Allow PATCH in the existing CORS config. Change:
```js
methods: ["GET", "POST"],
```
to:
```js
methods: ["GET", "POST", "PATCH"],
```

Add this route registration beside the existing `/api/auth` registration:
```js
app.use("/api/factory", factoryRoutes);
```

Keep the existing database connection, auth routes, error handler and other server code intact.

The route expects the existing signup role `shipper` for factory accounts. Your login response already stores the JWT at `localStorage` key `loadsetu-token`; the new API service sends it as a Bearer token.

## 3. Frontend integration
The panel is a separate component so your current login/signup page is preserved. In `frontend/src/App.jsx`, add:
```jsx
import FactoryPanel from "./components/FactoryPanel.jsx";
```

Inside `App()`—after your hooks and before the current `return`—add this conditional:
```jsx
const savedUser = JSON.parse(localStorage.getItem("loadsetu-user") || "null");
const hasSession = Boolean(localStorage.getItem("loadsetu-token"));

if (hasSession && savedUser?.role === "shipper") {
  return <FactoryPanel onLogout={() => {
    localStorage.removeItem("loadsetu-token");
    localStorage.removeItem("loadsetu-user");
    window.location.reload();
  }} />;
}
```

Important: `savedUser` and `hasSession` are ordinary constants, not hooks. Place them after your existing hook calls and before the JSX return. This will show the Factory Panel after a shipper/factory account logs in. Existing broker and transporter accounts remain on the existing screen until their panels are implemented.

If your `App.jsx` has already been customized, merge these small additions rather than replacing the file.

## 4. Run the app
Terminal 1:
```powershell
cd F:\NEXUS\backend
npm run dev
```

Terminal 2:
```powershell
cd F:\NEXUS\frontend
npm run dev
```

Sign up or log in using a `shipper` role account. If you previously signed up as `broker`, create a separate factory account for testing.

## 5. Important demo limitations
The matching endpoint currently returns clearly labelled demo candidates because real truck/transporter inventory has not been added yet. Do not treat their names, truck numbers, availability, scores or prices as real quotes. Replace `makeMatch()` in `backend/src/controllers/factoryController.js` with a query against real transporter/truck records before operational use.

WhatsApp contact only opens when a phone number is entered and stored in the booking. Delivery proof, live GPS, actual distance/route calculations, verified transporter profiles, carbon estimates and true return-load detection are not implemented in this patch. The savings card uses the difference between the factory's offered price and the quote saved to the booking; it is an estimate, not guaranteed savings.

Mongoose schema validation is included; continue to validate data at the API boundary as well.

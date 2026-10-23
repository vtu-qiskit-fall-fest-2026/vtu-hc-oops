# Deploying LoadSetu

```text
Browser ──> Vercel (frontend/, static React build)
              │  VITE_API_URL
              v
            Railway (backend/, Express API) ──> MongoDB Atlas (M0, free)
              │  QUANTUM_SERVICE_URL + X-Quantum-Key header
              v
            Hugging Face Space (quantum/, Docker, QAOA service)
```

The order matters because each step needs a URL from the step before:
**Atlas → Hugging Face Space → Railway → Vercel → back to Railway for the Vercel URL.**

| Service | Plan | Cost |
| :--- | :--- | :--- |
| MongoDB Atlas | M0 | Free |
| Hugging Face Space | CPU basic (2 vCPU, 16 GB) | Free; sleeps after about 48 h without traffic |
| Railway | Trial credit, then Hobby | About $5/month after the trial; check current pricing |
| Vercel | Hobby | Free for non-commercial use |

---

## 0. Before you start

1. Push the code to GitHub.
2. The repository belongs to the `vtu-qiskit-fall-fest-2026` organisation, so Railway and Vercel need access to it. When either one asks you to install its GitHub app, choose that organisation. If you are not an organisation owner, an owner has to approve the request.
3. Generate **two different** secrets, one for `JWT_SECRET` and one for `QUANTUM_SERVICE_KEY`. Run this twice:

   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```

   Keep them in a password manager. Never commit them.

---

## 1. MongoDB Atlas (database)

1. At [cloud.mongodb.com](https://cloud.mongodb.com), create a project and then a cluster. Choose **M0 (Free)**, provider AWS, region **Mumbai (ap-south-1)**.
2. **Database Access → Add New Database User.** Use password authentication. Avoid `@ : / ?` in the password, or URL-encode them in the connection string.
3. **Network Access → Add IP Address → Allow access from anywhere (`0.0.0.0/0`).** Railway has no fixed outbound IP, so this is required. The database user's password is what protects the data.
4. **Connect → Drivers.** Copy the URI and add the database name `loadsetu` after the host:

   ```text
   mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/loadsetu?retryWrites=true&w=majority
   ```

5. **Load the demo accounts and freight**, from your laptop. Put the URI in `backend/.env` as `MONGODB_URI=...`, keep `NODE_ENV` unset, and run:

   ```bash
   npm --prefix backend run seed
   ```

   Afterwards, empty `MONGODB_URI` in `backend/.env` again if you want local runs to go back to the throwaway in-memory database.

---

## 2. Hugging Face Space (quantum service)

1. At [huggingface.co/new-space](https://huggingface.co/new-space), fill in:
   - Name: `loadsetu-qaoa`
   - SDK: **Docker**, with the **Blank** template
   - Hardware: **CPU basic (free)**
   - Visibility: **Public**. A private Space needs a Hugging Face token on every request; the shared key below protects `/solve` instead.
2. In the Space, go to **Settings → Variables and secrets → New secret**, name it `QUANTUM_SERVICE_KEY`, and paste your second secret.
3. Create an access token with **Write** permission at [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens).
4. Push only the `quantum/` folder to the Space. Run this from the repo root after committing:

   ```bash
   git subtree split --prefix quantum -b hf-space
   git remote add space https://huggingface.co/spaces/YOUR_HF_USERNAME/loadsetu-qaoa
   git push space hf-space:main --force
   ```

   - When git asks for a username and password, enter your Hugging Face username and the token.
   - `--force` replaces the starter commit Hugging Face created. The front matter in `quantum/README.md` tells the Space to build `quantum/Dockerfile` on port 7860.
5. The first build takes about 5–10 minutes; watch the **Logs** tab. When it is done, open:

   ```text
   https://YOUR_HF_USERNAME-loadsetu-qaoa.hf.space/health
   ```

   It should return `{"status":"ok", ...}`. That base URL, without `/health`, is your `QUANTUM_SERVICE_URL`.

**To redeploy after changing `quantum/`:**

```bash
git branch -D hf-space
git subtree split --prefix quantum -b hf-space
git push space hf-space:main --force
```

---

## 3. Railway (Node API)

1. At [railway.com](https://railway.com), choose **New Project → Deploy from GitHub repo** and pick `vtu-hc-oops`.
2. Open the service, then go to **Settings**:
   - **Root Directory:** `/backend`
   - **Healthcheck Path:** `/api/health`
   - Leave the build and start commands empty. Railway detects Node from `package.json` (`engines.node >= 20`) and runs `npm start`.
3. Go to **Variables** and add:

   | Variable | Value |
   | :--- | :--- |
   | `NODE_ENV` | `production` |
   | `MONGODB_URI` | the Atlas URI from step 1 |
   | `JWT_SECRET` | your first secret |
   | `JWT_EXPIRES_IN` | `7d` |
   | `QUANTUM_SERVICE_URL` | `https://YOUR_HF_USERNAME-loadsetu-qaoa.hf.space` |
   | `QUANTUM_SERVICE_KEY` | your second secret, the same value as on the Space |
   | `ORS_API_KEY` | a free key from [openrouteservice.org](https://openrouteservice.org/dev/#/signup). Recommended: the public OSRM fallback is fair-use only. |
   | `MONGOMS_DISABLE_POSTINSTALL` | `1`. This skips downloading a MongoDB binary that production never uses. |
   | `CLIENT_ORIGIN`, `FRONTEND_BASE_URL` | Leave empty for now; filled in at step 5. |
   | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Optional, test keys only. The demo accounts are already subscribed. |

   Do **not** set `PORT`; Railway provides it.
4. Go to **Settings → Networking → Generate Domain**. Check that this URL works:

   ```text
   https://YOUR-API.up.railway.app/api/health
   ```

   It should return `{"status":"ok","service":"LOADSETU API"}`.

If the deploy log says `JWT_SECRET must be set...` or `MONGODB_URI is missing`, a variable is missing or misspelt. The app refuses to start without them on purpose.

---

## 4. Vercel (frontend)

1. At [vercel.com/new](https://vercel.com/new), import `vtu-hc-oops`.
2. Configure the project:
   - **Root Directory:** `frontend`
   - **Framework Preset:** Vite (detected automatically)
3. Add one **Environment Variable**:
   - Name: `VITE_API_URL`
   - Value: `https://YOUR-API.up.railway.app/api`
4. Click **Deploy**. You get a URL like `https://vtu-hc-oops.vercel.app`.

`VITE_API_URL` is baked into the build. If you change it, redeploy from **Deployments → Redeploy**. `frontend/vercel.json` sends every path to `index.html`, so reloading `/factory/optimizer` does not 404.

---

## 5. Connect Vercel back to Railway

In Railway **Variables**, set:

| Variable | Value |
| :--- | :--- |
| `CLIENT_ORIGIN` | `https://vtu-hc-oops.vercel.app`, your exact Vercel production URL |
| `FRONTEND_BASE_URL` | the same URL |

Railway redeploys on its own. `CLIENT_ORIGIN` is the CORS allow-list: browsers on any other origin are refused. To allow more than one origin, such as a custom domain, separate them with commas. Vercel *preview* deployments get different URLs and are blocked unless you add them.

---

## 6. Smoke test

1. Open the Vercel URL and log in as **Goods owner** with `factory@demo.loadsetu.in` / `Demo@1234`.
2. Go to **Factory dashboard → Quantum fleet optimizer**. You should see 4 of 4 loads, ₹59,500, and a road route on the map.
3. Press **Run QAOA**. If the Space was asleep, the first request can fail with "not reachable"; wait a minute and retry. Then switch to **IBM Brisbane noise** and run it again.

## Before the demo

- Open `https://YOUR_HF_USERNAME-loadsetu-qaoa.hf.space/health` about 10 minutes before presenting, to wake the Space.
- Railway's Hobby plan does not sleep.
- Optional: point an uptime monitor such as UptimeRobot at the Space's `/health` every 30 minutes, which stops it from sleeping. `/health` needs no key.
- The demo password is public, in the README. Anyone can log in and change demo data. Re-run the seed from step 1 to reset it. It skips if the accounts already exist, so to start fully clean, drop the `loadsetu` database in Atlas first.

## Troubleshooting

| Symptom | Cause and fix |
| :--- | :--- |
| Login shows "Failed to fetch" and the browser console mentions CORS | `CLIENT_ORIGIN` on Railway is not exactly your Vercel URL. Check `https://`; a trailing slash is fine. |
| 404 when reloading a page | The Vercel Root Directory is not `frontend`, so `vercel.json` was not picked up. |
| Railway crashes at boot | Read the deploy log. The usual causes are a missing `JWT_SECRET` (it needs 32 or more characters) or a missing `MONGODB_URI`. |
| `MongoServerError: bad auth`, or a timeout | Wrong user or password, a special character not URL-encoded, or Network Access not set to `0.0.0.0/0`. |
| QAOA says "not reachable" | The Space is building or asleep. Check the Space **Logs**. |
| QAOA says "Missing or wrong X-Quantum-Key" | `QUANTUM_SERVICE_KEY` differs between Railway and the Space. After changing a Space secret, restart the Space. |
| Every route is a "straight line x 1.3" estimate | The public OSRM server is throttling Railway's IP. Set `ORS_API_KEY`. |
| Login works locally but returns 401 in production | The token came from a different `JWT_SECRET`. Log out, clear site data, and log in again. |

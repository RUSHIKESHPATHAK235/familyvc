# cPanel Deployment Guide

## 1. Prepare the Domain

1. Create a domain or subdomain such as `family.example.com`.
2. Enable AutoSSL and verify that `https://family.example.com` loads securely.
3. Do not deploy WebRTC without HTTPS; browsers block camera and microphone access on insecure public origins.

## 2. Upload the Application

Upload the complete project to a private application directory, for example:

```text
/home/CPANEL_USER/family-connect
```

Do not upload `node_modules`. cPanel installs production dependencies for the server.

## 3. Create the Node.js Application

In **cPanel → Setup Node.js App** (sometimes named **Application Manager**):

1. Click **Create Application**.
2. Select Node.js `18`, `20`, or a newer supported LTS version.
3. Set **Application mode** to `Production`.
4. Set **Application root** to `family-connect`.
5. Set **Application URL** to the HTTPS domain or subdomain.
6. Set **Application startup file** to `server.js`.
7. Create the application.

cPanel supplies the listening port. The app reads it from `process.env.PORT`.

## 4. Configure Environment Variables

Add these variables in the Node.js application screen:

```text
NODE_ENV=production
TRUST_PROXY=1
FAMILY_TOKEN=YOUR_LONG_PRIVATE_FAMILY_TOKEN
SESSION_SECRET=YOUR_SEPARATE_RANDOM_SECRET_OF_AT_LEAST_32_CHARACTERS
SESSION_TTL_HOURS=168
ALLOWED_ORIGINS=https://family.example.com
FAMILY_MEMBERS=Mom,Dad,Grandma,Grandpa
TURN_URL=turn:turn.example.com:3478?transport=udp,turn:turn.example.com:3478?transport=tcp
TURN_USERNAME=your-turn-username
TURN_CREDENTIAL=your-turn-password
```

Do not include quotes around cPanel environment variable values. Generate the two secrets independently:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

If the cPanel interface does not support environment variables, create `/home/CPANEL_USER/family-connect/.env` from `.env.example`. Never place `.env` inside `public/`.

## 5. Install Dependencies

Use cPanel’s **Run NPM Install** button. If Terminal access is available, activate the virtual environment command shown by cPanel and run:

```bash
cd ~/family-connect
npm install --omit=dev
```

## 6. Start or Restart

Click **Restart Application** in cPanel. With Terminal access, Passenger installations can also be restarted by updating the restart marker:

```bash
mkdir -p ~/family-connect/tmp
touch ~/family-connect/tmp/restart.txt
```

Use the cPanel restart button if your host does not use Passenger.

## 7. Verify

Open these URLs:

```text
https://family.example.com/api/health
https://family.example.com
```

The health endpoint should return JSON with `"status":"ok"`. Then test with two devices on different networks to verify camera, audio, signaling, chat, and TURN relay.

## TURN Is Strongly Recommended

Public STUN is included, but STUN alone cannot connect every network pair. Mobile carriers, enterprise firewalls, symmetric NAT, and some public Wi-Fi networks require TURN. Use a managed TURN provider or deploy coturn on a VPS. Standard shared cPanel hosting generally cannot run a TURN server, so TURN is normally external.

For best reachability, provide:

- UDP TURN on port `3478`
- TCP TURN on port `3478`
- TLS TURN on port `5349` when available

## Updating the App

1. Back up `.env` or the environment variables.
2. Upload and overwrite the application files, excluding `.env`.
3. Run `npm install --omit=dev` if `package.json` changed.
4. Restart the Node.js application.
5. Check `/api/health` and place a two-device test call.

## Troubleshooting

### Camera or microphone does not open

- Confirm the site uses HTTPS with a valid certificate.
- Check browser site permissions.
- Close other apps using the camera.
- On iPhone, use Safari or an installed PWA/browser with WebRTC support.

### Users can join but cannot see or hear each other

- Configure valid TURN credentials.
- Test from two different networks.
- Ensure the host permits WebSocket upgrades for Socket.IO.
- Check the browser console for ICE or permission errors.

### Socket.IO repeatedly reconnects

- Confirm the Node app is running.
- Confirm the proxy supports WebSockets.
- Verify `ALLOWED_ORIGINS` exactly matches the public HTTPS origin.
- Restart the cPanel Node application.

### Application returns 503

- Open the cPanel Node application logs.
- Verify the startup file is `server.js`.
- Verify all required production environment variables are set.
- Run `npm install --omit=dev`, then restart.

### Changes do not appear

- Restart the Node application.
- Hard-refresh the browser.
- Clear any host or CDN cache for `index.html`.

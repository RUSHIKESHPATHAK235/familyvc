# Pathak Family

Pathak Family is a private, permanent family room for up to four people. It combines peer-to-peer WebRTC video and audio, Socket.IO signaling, real-time chat, family presence, device controls, connection diagnostics, and a responsive premium interface.

## Features

- HD peer-to-peer video and audio with a four-person mesh
- Camera, microphone, speaker, resolution, mirroring, and fullscreen controls
- Real-time chat, emoji, typing indicators, timestamps, and session history
- Online/offline family presence and participant media status
- Active-speaker highlighting, latency, call duration, and connection quality
- Automatic Socket.IO reconnect, ICE restart, and adaptive video bitrate
- Signed persistent sessions protected by one private family token
- Input validation, constant-time token comparison, Helmet CSP, rate limiting, and origin controls
- Mobile layouts for Android, iPhone, tablets, portrait, and landscape
- cPanel Node.js Application Manager compatible

## Requirements

- Node.js 18.18 or newer
- HTTPS in production (required by browsers for camera and microphone access)
- A modern browser with WebRTC support
- A TURN server for reliable calling across restrictive networks

## Local Setup

```bash
npm install
copy .env.example .env
npm start
```

On macOS or Linux, use `cp .env.example .env`. Update `FAMILY_TOKEN` and `SESSION_SECRET` before starting. The development URL is `http://localhost:3000`.

For development with automatic restarts:

```bash
npm run dev
```

Run the automated tests:

```bash
npm test
```

## Environment Variables

| Variable | Required | Description |
| --- | --- | --- |
| `NODE_ENV` | Yes | Use `production` on cPanel. |
| `PORT` | No | Supplied automatically by most cPanel installations. Defaults to `3000`. |
| `TRUST_PROXY` | Yes | Usually `1` behind cPanel/Passenger. |
| `FAMILY_TOKEN` | Yes | Private token family members enter. Use a long random value. |
| `SESSION_SECRET` | Yes | Separate random signing secret with at least 32 characters. |
| `SESSION_TTL_HOURS` | No | Persistent login lifetime. Defaults to 168 hours. |
| `ALLOWED_ORIGINS` | Recommended | Comma-separated HTTPS origins, for example `https://family.example.com`. |
| `FAMILY_MEMBERS` | No | Comma-separated names shown as offline when absent. |
| `TURN_URL` | Recommended | Comma-separated TURN URLs, such as `turn:turn.example.com:3478?transport=udp`. |
| `TURN_USERNAME` | With TURN | TURN username. |
| `TURN_CREDENTIAL` | With TURN | TURN credential. |

Generate secure secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

## Project Structure

```text
family-connect/
├── public/
│   ├── assets/
│   │   └── logo.svg
│   ├── app.js
│   ├── index.html
│   └── styles.css
├── src/
│   ├── auth.js
│   ├── config.js
│   ├── room.js
│   ├── routes.js
│   └── socket.js
├── test/
│   ├── auth.test.js
│   └── room.test.js
├── .env.example
├── .gitignore
├── DEPLOYMENT.md
├── package.json
├── README.md
└── server.js
```

## Architecture

The Node process serves the frontend, authenticates the family token, signs local sessions, and runs Socket.IO. Media travels directly between browsers through WebRTC; the server relays only signaling, participant state, and chat messages. With four participants, each browser maintains up to three peer connections.

Chat history and presence are intentionally held in process memory and reset when the Node application restarts. Calls are not recorded and media is not stored.

## Production Notes

- Configure TURN before relying on the app outside a single home or office network.
- Use one Node process. In-memory room state is not shared across clustered workers.
- Rotate `FAMILY_TOKEN` and `SESSION_SECRET` if either is exposed. Rotating `SESSION_SECRET` signs everyone out.
- Keep `.env` outside public web roots when your cPanel configuration permits it.
- Read `DEPLOYMENT.md` for the complete cPanel procedure.

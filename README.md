# SocialConnect

A beginner-friendly social media platform built with HTML, CSS, vanilla JavaScript, Node.js, Express, SQLite, and sessions.

## Features
- Register and sign in with a username or email
- Password hashing with bcrypt
- Create text posts and optionally attach an HTTPS image URL
- Like/unlike posts, comment, and delete your own posts
- Edit your display name and bio
- Search posts, discover posts, sort by latest/popular, and toggle dark mode
- SQLite database persists users, posts, likes, and comments
- Demo feed appears automatically on first start

## Run locally
1. Install Node.js 20 or newer.
2. Open this folder in VS Code.
3. Open **Terminal → New Terminal** and make sure the terminal is in this folder.
4. Run `npm install`.
5. If npm says the `better-sqlite3` install script needs approval, run `npm install-scripts approve better-sqlite3`, then run `npm install` again if needed.
6. Run `npm start`.
7. Visit **http://localhost:3001**.

The app uses port **3001** so it can run alongside the ShopEase project on port 3000. The local SQLite database file is created automatically when the server starts.

## Demo users
The starter feed includes demo profiles. To test sign-in, use:
- Username: `mayachen`
- Password: `demo1234`

Other demo accounts: `jordanlee` and `avapatel`, same password. You can also create your own account.

## Important
This is an educational project for local development. Before deploying publicly, set a strong `SESSION_SECRET`, configure secure production cookies and HTTPS, add rate limiting and CSRF protections, and replace the default in-memory session store with a persistent session store.

# Deploying WriteAI to one free-tier EC2 instance

A beginner-friendly deployment using **one Docker container** on **one small AWS
virtual machine (EC2)**. The database and Redis stay on their hosted free plans,
so the only AWS resource you manage is the one box.

> **How to make the AWS bill genuinely $0:** if your AWS account was created on
> or after July 15, 2025, choose the **Free account plan**, not the Paid account
> plan. AWS says this plan cannot incur charges. It ends after six months or when
> its credits are used, whichever happens first. Delete the EC2 instance before
> that point if you do not plan to upgrade. Older AWS accounts use the legacy
> free tier, which can charge for usage beyond its limits, so "$0" cannot be
> guaranteed on those accounts.
>
> AWS details: [current Free Tier account plans](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/free-tier.html)

```
Your browser ──http──> EC2 box (Ubuntu) ──> Docker container (WriteAI, port 3000)
                                              │
                                              ├──> MongoDB Atlas   (free, hosted)
                                              ├──> Redis Cloud     (free, hosted)
                                              └──> Gemini API       (Google)
```

Two new things you'll learn: **EC2** (a rented computer) and **Docker** (already in this repo).
Nothing else.

> **Note on HTTPS:** we run over plain `http://` to stay $0 and simple. Browsers show a
> "Not secure" label — that's cosmetic for a demo. Login still works because the app is
> configured with `COOKIE_SECURE=false` (see the env file below). Do **not** put real user
> data here; it's a portfolio demo.

---

## Phase 0 — Free accounts & secrets (~15 min)

You need four values before touching AWS. Collect them in a notepad.

1. **MongoDB Atlas** (database) — https://www.mongodb.com/cloud/atlas/register
   - Create a **free M0** cluster (pick any provider/region).
   - **Database Access** → add a database user (username + password). Save these.
   - **Network Access** → Add IP Address → **Allow access from anywhere** (`0.0.0.0/0`).
     (Fine for a demo; it still requires the username/password.)
   - **Connect** → **Drivers** → copy the connection string. It looks like:
     `mongodb+srv://USER:PASSWORD@cluster0.xxxx.mongodb.net/writeai?retryWrites=true&w=majority`
     Replace `USER`/`PASSWORD` with what you set, and add `/writeai` as the db name.
     → this is your **`DB_URI`**

   - In Atlas, open **Search & Vector Search** and create these two Search indexes in
     the database named by `DB_URI`:
     - Collection `documents`, index `documents_and_chunks`:
       `{"mappings":{"dynamic":false,"fields":{"title":{"type":"string","analyzer":"lucene.standard"},"subtitle":{"type":"string","analyzer":"lucene.standard"}}}}`
     - Collection `documentchunks`, index `chunks_content`:
       `{"mappings":{"dynamic":false,"fields":{"content":{"type":"string","analyzer":"lucene.standard","store":true}}}}`
     Search can otherwise return an empty result set without reporting a missing or
     misplaced index.

2. **Redis Cloud** (you already have this) — grab your connection URL, looks like:
   `redis://default:PASSWORD@some-host.redns.redis-cloud.com:12345`
   → this is your **`REDIS_URL`**

   Redis is required: the API and export worker intentionally do not start when this
   URL is missing or unreachable.

3. **Gemini API key** (you already have this) → your **`GEMINI_API_KEY`**

4. **A JWT secret** — any long random string. You'll generate one on the server later, or
   make one now: it just needs to be long and random. → your **`JWT_SECRET_KEY`**

5. **AWS account** — https://aws.amazon.com → "Create an AWS Account". Choose the
   **Free account plan** during signup and do not upgrade it. Complete the requested
   identity verification.

---

## Phase 1 — Launch the EC2 box (~10 min)

1. Sign in to the **AWS Console**. In the top search bar, type **EC2**, open it.
2. Top-right: pick a **Region** near you (e.g. `Mumbai ap-south-1`). Remember which one.
3. Click **Launch instance**.
4. Fill in:
   - **Name:** `writeai`
   - **Application and OS Images:** **Ubuntu** → **Ubuntu Server 24.04 LTS** (must say
     *Free tier eligible*).
   - **Instance type:** choose one that the console explicitly labels **Free tier eligible**.
     For new accounts, `t3.micro` is the simplest common choice.
   - **Key pair:** click **Create new key pair** → name it `writeai-key` → **RSA** / `.pem`
     → download it and keep it somewhere safe. (We'll actually connect via the browser, so
     you may not even need it — but create one anyway.)
   - **Network settings** → click **Edit**, then check these boxes:
     - ✅ Allow **SSH** traffic — from **Anywhere** (`0.0.0.0/0`). Keep it open, not
       "My IP": the browser-based connect (Phase 2) comes from AWS's servers, not your
       laptop, so "My IP" would lock you out.
     - ✅ Allow **HTTP** traffic from the internet (port 80)
   - Leave storage at the default (8–30 GB is free-tier fine).
5. Click **Launch instance**. Wait ~1 min, then **View all instances**. When
   **Instance state = Running**, copy its **Public IPv4 address** — call this `SERVER_IP`.

---

## Phase 2 — Connect and install Docker (~10 min)

1. Select your instance → click **Connect** (top button) → **EC2 Instance Connect** tab →
   **Connect**. A black terminal opens in your browser. (No password/key needed — easiest way.)

2. **Add swap** so the small box doesn't run out of memory while building:
   ```bash
   sudo fallocate -l 2G /swapfile
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
   echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
   ```

3. **Install Docker:**
   ```bash
   curl -fsSL https://get.docker.com | sudo sh
   sudo usermod -aG docker $USER
   ```
   Then close the terminal and reconnect (Connect → Connect again) so the group change
   takes effect. Verify:
   ```bash
   docker run hello-world
   ```
   You should see "Hello from Docker!".

---

## Phase 3 — Get the code and add your secrets (~5 min)

1. **Clone the repo** (it's public, no login needed):
   ```bash
   git clone https://github.com/Animesh-kumar23/WriteAI.git
   cd WriteAI
   ```

2. **Create the env file** (this stays only on the server, never committed):
   ```bash
   nano ~/writeai.env
   ```
   Paste this, filling in your four values from Phase 0 and your `SERVER_IP`:
   ```
   NODE_ENV=production
   PORT=3000
   DB_URI=mongodb+srv://USER:PASSWORD@cluster0.xxxx.mongodb.net/writeai?retryWrites=true&w=majority
   REDIS_URL=redis://default:PASSWORD@your-redis-host:12345
   JWT_SECRET_KEY=paste_a_long_random_string_here
   GEMINI_API_KEY=your_gemini_key
   CLIENT_URL=http://SERVER_IP
   COOKIE_SECURE=false
   ```
   Need a random `JWT_SECRET_KEY`? Run `openssl rand -hex 32` and paste the output.
   Save in nano: **Ctrl+O**, **Enter**, then **Ctrl+X** to exit.

---

## Phase 4 — Build and run (~10 min for first build)

1. **Build the image.** The frontend talks to the backend on the same server, so
   nothing hardcodes your IP:
   ```bash
   docker build -t writeai .
   ```
   (First build takes several minutes. If it dies with "killed", the swap step in Phase 2
   was skipped — go back and add it.)

2. **Run it.** Maps the container's port 3000 to the box's port 80, so the URL needs no
   `:port`. `--restart unless-stopped` brings it back after a reboot or crash:
   ```bash
   docker run -d --name writeai \
     -p 80:3000 \
     --env-file ~/writeai.env \
     -v writeai_uploads:/app/backend/uploads \
     --restart unless-stopped \
     writeai
   ```

3. **Check it's up:**
   ```bash
   docker logs writeai
   ```
   Look for `Server running on port 3000`. If it exited, the logs show why (usually a typo
   in `DB_URI` / `REDIS_URL`).

4. **Open your app:** in a browser go to **`http://SERVER_IP`** (your Public IPv4).
   Register an account and confirm login works.

---

## You're live 🎉

Your portfolio link is `http://SERVER_IP`.

### Updating after you change code
```bash
cd ~/WriteAI
git pull
docker build -t writeai .
docker stop writeai && docker rm writeai
docker run -d --name writeai -p 80:3000 --env-file ~/writeai.env -v writeai_uploads:/app/backend/uploads --restart unless-stopped writeai
```

### Handy commands
| Do this | Command |
|---|---|
| See logs | `docker logs -f writeai` |
| Restart | `docker restart writeai` |
| Stop | `docker stop writeai` |
| Is it running? | `docker ps` |

### Good-to-know limits (all fixable later, none needed for a demo)
- **Uploaded images** (avatars/covers) use the `writeai_uploads` Docker volume and
  survive normal container rebuilds. Backups and multi-server storage would still
  need S3 later.
- **The IP changes** only if you *stop* the instance (not on reboot). If you want a
  permanent IP, allocate a free **Elastic IP** in EC2 and associate it — optional.
- **No HTTPS.** When you want a real `https://name.com`, buy a cheap domain and put
  **Caddy** in front (it auto-fetches a free certificate), then set `COOKIE_SECURE=true`.

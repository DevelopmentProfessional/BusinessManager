# Connect pgAdmin to Render PostgreSQL

Use these steps to connect your local pgAdmin to the Render database **dd_reference_temp**.

---

## 1. Get connection details from Render

1. Go to [Render Dashboard](https://dashboard.render.com).
2. Click **Databases** in the left sidebar.
3. Click your database: **dd_reference_temp**.
4. Open the **Connect** (or **Info**) section.
5. Copy the **External Database URL**. It looks like:
   ```text
   postgresql://businessmanager:PASSWORD@dpg-xxxxx-a.oregon-postgres.render.com/businessmanager
   ```
   You’ll need the **host**, **port**, **database**, **username**, and **password** from this URL.

**Parse the URL:**

| Part        | Where in the URL |
|------------|-------------------|
| **Host**   | After `@`, before the next `:` or `/` (e.g. `dpg-xxxxx-a.oregon-postgres.render.com`) |
| **Port**   | Usually **5432** if not shown in the URL |
| **Database** | Last segment (e.g. `businessmanager`) |
| **Username** | First part after `postgresql://` (e.g. `businessmanager`) |
| **Password** | Between the first `:` and `@` (the long string) |

---

## 2. Create a new server in pgAdmin

1. Open **pgAdmin**.
2. Right‑click **Servers** in the left tree → **Register** → **Server**.

### General tab

- **Name:** e.g. `Render - dd_reference_temp` (any label you like).

### Connection tab

- **Host name/address:** paste the **host** from the External Database URL (e.g. `dpg-xxxxx-a.oregon-postgres.render.com`).
- **Port:** `5432`.
- **Maintenance database:** same as **Database** below (e.g. `businessmanager`).
- **Username:** from the URL (e.g. `businessmanager`).
- **Password:** from the URL. Check **Save password** if you want pgAdmin to remember it.

Click **Save** (or **Save password** if prompted).

---

## 3. Use SSL (required for Render external connections)

Render usually requires SSL for external connections.

1. After adding the server, right‑click it → **Properties**.
2. Open the **SSL** tab.
3. Set **SSL mode** to **Require** (or **Prefer** if **Require** fails).
4. You do **not** need to upload a certificate file for Render.
5. Click **Save**.

If you get SSL errors, try **SSL mode: Prefer** or **Allow**.

---

## 4. Connect

- In the left tree, expand **Servers** → your new server.
- If it asks for the password again, enter the same one from the External Database URL.
- You should see **Databases** → **businessmanager** → **Schemas** → **public** → **Tables**.

---

## “getaddrinfo failed” (can’t resolve hostname)

This means your machine couldn’t resolve the database hostname to an IP. Try:

1. **Use the External host, not Internal**
   - In Render: database → **Connect**.
   - Use the **External** Database URL (or “External” host).  
   - Do **not** use the Internal URL; that hostname often only resolves from inside Render and will cause getaddrinfo to fail from your PC.

2. **Copy the host exactly**
   - In the External URL, the host is the part after `@` and before `:` or `/`.
   - Example: `postgresql://user:pass@dpg-abc123-a.oregon-postgres.render.com/dbname`  
     → host = `dpg-abc123-a.oregon-postgres.render.com`
   - Paste into pgAdmin with **no spaces or line breaks**. Retype it if you’re unsure.

3. **Check DNS from your PC** (PowerShell):
   ```powershell
   nslookup dpg-xxxxx-a.oregon-postgres.render.com
   ```
   Replace with your actual host from the External URL. If this fails, the problem is DNS (network/VPN/firewall).

4. **VPN / corporate network**
   - Try without VPN, or from another network (e.g. phone hotspot). Some networks block or alter DNS and break resolution to Render’s hostnames.

5. **Render dashboard**
   - Confirm the database exists and is running. Copy the External Database URL again from **Connect** and re-enter the host in pgAdmin.

---

## Other troubleshooting

| Issue | What to try |
|-------|-----------------------------|
| “Connection refused” or timeout | Use the **External** Database URL (not Internal). Ensure your firewall allows outbound port 5432. |
| SSL errors | Set SSL mode to **Require** or **Prefer** in the server’s SSL tab. |
| “Password authentication failed” | Re-copy the password from Render (no spaces; use “Copy” on the password field). |
| Render DB asleep | On free tier, the DB may sleep after inactivity. First query can take 1–2 minutes; try again. |

---

## Security note

The External Database URL contains a password. Don’t commit it to git or share it. Use **Save password** only on your own machine.

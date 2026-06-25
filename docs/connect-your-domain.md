# Connect Your Own Domain to Your Everything Local Page

*A step-by-step guide for business owners*

Want your business page to live at your **own web address** — like `joespizza.com` — instead of the default link? This takes about 10 minutes, plus a little waiting time while the internet updates.

You'll do this in two places: your **Everything Local dashboard** and your **GoDaddy account**.

---

## Before you start
- You need a **Local Pro** subscription (custom domains are a Local Pro feature).
- You need a domain. If you don't own one yet, see **"Buying a domain"** at the bottom.

---

## Step 1 — Start the connection in Everything Local
1. Log in to Everything Local and go to your **Dashboard**.
2. Click **Store Settings**.
3. Scroll to the **Custom domain** box.
4. Type your domain (for example `joespizza.com`) and click **Connect**.

You'll now see a **DNS record** on screen with three values: a **Type**, a **Name**, and a **Value**. Keep this tab open — you'll copy these into GoDaddy next.

> 💡 The exact values depend on your domain, so always use what *your* screen shows. It will be one of these two:
> - **Plain domain** (`joespizza.com`): Type **A**, Name **@**, Value **76.76.21.21**
> - **With a prefix** (`www.joespizza.com` or `shop.joespizza.com`): Type **CNAME**, Name **www** (or your prefix), Value **cname.vercel-dns.com**

---

## Step 2 — Add the record in GoDaddy
1. In a new tab, sign in at **https://www.godaddy.com**.
2. Click your name (top right) → **My Products**.
3. Find your domain under **Domains** and click the **DNS** button next to it (or **Manage DNS**).
4. Click **Add New Record** (sometimes just **Add**).
5. Fill it in to match what Everything Local showed you:
   - **Type** → choose `A` or `CNAME` (whatever your screen said)
   - **Name** → `@` for a plain domain, or your prefix like `www`
   - **Value** → paste the value from Everything Local (`76.76.21.21` or `cname.vercel-dns.com`)
   - **TTL** → leave as **1 hour** / default
6. Click **Save**.

> ⚠️ **If GoDaddy already has an "A" record for `@`:** don't add a second one — click the **pencil/edit** icon on the existing one and change its value to `76.76.21.21`, then save.

---

## Step 3 — Tell Everything Local you're done
1. Go back to your Everything Local **Custom domain** box.
2. Click **Check status**.

- If it says **Live** ✅ — you're done! Visit your domain to see your page.
- If it still says **Pending** — that's normal. DNS changes can take anywhere from a few minutes up to a few hours to spread across the internet. Grab a coffee and click **Check status** again later.

---

## Buying a domain (if you don't have one yet)
1. Go to **https://www.godaddy.com**.
2. Search the name you want (e.g. `joespizza.com`).
3. Pick an available one → **Add to Cart** → **Continue to Cart**.
4. You can skip most add-ons. (Domain privacy is a nice-to-have but optional.)
5. **Checkout**, create your account, and pay.
6. Then follow Steps 1–3 above.

---

## Need help?
If your domain still isn't live after a few hours, double-check that the record in GoDaddy exactly matches what your Everything Local screen shows — a single wrong character will stop it from working. Then reach out to support.

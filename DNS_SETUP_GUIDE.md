<div style="background-color: #1a1a1a; color: #e0e0e0; padding: 20px; border-radius: 8px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">

# 🌐 <span style="color: #4fc3f7;">DNS Setup Guide for lavishbeautyhairandnail.care</span>

## 📋 <span style="color: #81c784;">**Required DNS Records**</span>

<div style="background-color: #2d2d2d; padding: 15px; border-radius: 6px; margin: 10px 0;">
You need to add these DNS records in your domain provider's control panel (where you registered <code style="background-color: #424242; color: #ffb74d; padding: 2px 6px; border-radius: 4px;">lavishbeautyhairandnail.care</code>):
</div>

### **1. <span style="color: #f48fb1;">Main Website (Frontend)</span>**
<div style="background-color: #263238; padding: 10px; border-radius: 4px; border-left: 4px solid #4fc3f7;">
<pre style="color: #e0e0e0; margin: 0;">
Type: CNAME
Name: @ (or leave blank for root domain)
Value: lavish-beauty-app.onrender.com
TTL: 300 (5 minutes)
</pre>
</div>

### **2. <span style="color: #f48fb1;">www Subdomain</span>**
<div style="background-color: #263238; padding: 10px; border-radius: 4px; border-left: 4px solid #81c784;">
<pre style="color: #e0e0e0; margin: 0;">
Type: CNAME
Name: www
Value: lavish-beauty-app.onrender.com
TTL: 300 (5 minutes)
</pre>
</div>

### **3. <span style="color: #f48fb1;">API Subdomain</span>**
<div style="background-color: #263238; padding: 10px; border-radius: 4px; border-left: 4px solid #ffb74d;">
<pre style="color: #e0e0e0; margin: 0;">
Type: CNAME
Name: api
Value: lavish-beauty-api.onrender.com
TTL: 300 (5 minutes)
</pre>
</div>

---

## 🔧 **Step-by-Step Setup**

### **Step 1: Access Your DNS Provider**
1. Log into your domain registrar (where you bought the domain)
2. Find "DNS Management", "DNS Records", or "Domain Settings"
3. Look for "Add Record" or "Manage DNS"

### **Step 2: Add the Records**
Add each of the three DNS records above, one by one.

### **Step 3: Render Configuration**
After adding DNS records:

1. **Go to Render Dashboard**
2. **Frontend Service (lavish-beauty-app)**:
   - Settings → Custom Domains
   - Add: `lavishbeautyhairandnail.care`
   - Add: `www.lavishbeautyhairandnail.care`

3. **Backend Service (lavish-beauty-api)**:
   - Settings → Custom Domains
   - Add: `api.lavishbeautyhairandnail.care`

### **Step 4: Verify Setup**
- DNS propagation: 15 minutes to 48 hours (usually much faster)
- SSL certificates: Generated automatically by Render
- Test your URLs:
  - `https://lavishbeautyhairandnail.care`
  - `https://www.lavishbeautyhairandnail.care`
  - `https://api.lavishbeautyhairandnail.care/health`

---

## 🚨 **Common DNS Providers**

### **GoDaddy**
1. Log in → My Products → DNS
2. Click "Add" → Select "CNAME"
3. Enter the records above

### **Namecheap**
1. Dashboard → Domain List → Manage
2. Advanced DNS tab
3. Add New Record → CNAME Record

### **Cloudflare**
1. Dashboard → Select Domain
2. DNS → Records
3. Add Record → CNAME

### **Google Domains**
1. My Domains → Manage → DNS
2. Custom Records → Manage Custom Records
3. Add → CNAME

---

## ✅ **Verification Checklist**

- [ ] Added CNAME for `@` pointing to `lavish-beauty-app.onrender.com`
- [ ] Added CNAME for `www` pointing to `lavish-beauty-app.onrender.com`
- [ ] Added CNAME for `api` pointing to `lavish-beauty-api.onrender.com`
- [ ] Added custom domains in Render dashboard
- [ ] Upgraded services to Starter tier ($7/month each)
- [ ] Waited for DNS propagation (15 min - 48 hours)
- [ ] Tested all URLs work with HTTPS

---

## 🎯 **Final Result**

Once complete, your beauty salon management system will be live at:

- **Main Website**: `https://lavishbeautyhairandnail.care`
- **With www**: `https://www.lavishbeautyhairandnail.care`
- **API Endpoint**: `https://api.lavishbeautyhairandnail.care`

**Professional, always-on, and branded for your business!** 🎉

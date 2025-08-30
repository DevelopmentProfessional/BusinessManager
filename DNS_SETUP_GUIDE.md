# 🌐 DNS Setup Guide for lavishbeautyhairandnail.care

## 📋 **Required DNS Records**

You need to add these DNS records in your domain provider's control panel (where you registered `lavishbeautyhairandnail.care`):

### **1. Main Website (Frontend)**
```
Type: CNAME
Name: @ (or leave blank for root domain)
Value: lavish-beauty-app.onrender.com
TTL: 300 (5 minutes)
```

### **2. www Subdomain**
```
Type: CNAME
Name: www
Value: lavish-beauty-app.onrender.com
TTL: 300 (5 minutes)
```

### **3. API Subdomain**
```
Type: CNAME
Name: api
Value: lavish-beauty-api.onrender.com
TTL: 300 (5 minutes)
```

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

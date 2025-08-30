# 🆓 Free Tier Setup Guide

## 🎯 **Perfect for Testing & Development**

Your Business Manager is now configured for **FREE** deployment on Render!

### 📋 **What You Get (FREE):**

- ✅ **Backend API**: `api.lavishbeautyhairandnail.care`
- ✅ **Frontend**: `lavishbeautyhairandnail.care`
- ✅ **SQLite Database**: Included (no extra cost)
- ✅ **HTTPS**: Automatic SSL certificates
- ✅ **GitHub Integration**: Auto-deploy on push

### ⚠️ **Free Tier Limitations:**

- **Sleep Mode**: Services sleep after 15 minutes of inactivity
- **Wake Time**: First request after sleep takes 30-60 seconds
- **Bandwidth**: Limited monthly bandwidth
- **Build Time**: Limited build minutes per month
- **Performance**: Slower than paid plans

---

## 🚀 **Quick Deploy Steps:**

### 1. **Push to GitHub**
```bash
git add .
git commit -m "Ready for free tier deployment"
git push origin main
```

### 2. **Deploy on Render**
1. Go to [render.com](https://render.com)
2. Click "New +" → "Blueprint"
3. Connect your GitHub repository
4. Click "Apply" - Render will create both services automatically

### 3. **Wait for Deployment**
- Backend: ~5-10 minutes
- Frontend: ~3-5 minutes
- Both services will be FREE tier

---

## 🧪 **Testing Your Deployment:**

### **Health Checks:**
- Backend: `https://api.lavishbeautyhairandnail.care/health`
- Frontend: `https://lavishbeautyhairandnail.care/`

### **Test Login:**
- Username: `admin`
- Password: `admin123`
- (Created automatically by setup script)

### **Test Features:**
- ✅ Create employees
- ✅ Set permissions
- ✅ Add clients
- ✅ Create appointments
- ✅ Test all functionality

---

## 🔄 **When Ready for Production:**

### **Upgrade Steps:**
1. **Render Dashboard** → Select each service
2. **Settings** → **Plan** → Change to "Starter" ($7/month each)
3. **Environment Variables** → Change `ENVIRONMENT` to `production`
4. **Redeploy** → Services will restart with paid resources

### **Production Benefits:**
- ✅ **Always On**: No sleep mode
- ✅ **Faster**: Better performance
- ✅ **Reliable**: 99.9% uptime
- ✅ **Support**: Priority support

---

## 💡 **Pro Tips for Free Tier:**

### **1. Keep Services Active**
- Visit your app regularly to prevent sleep
- Set up a simple monitoring service

### **2. Monitor Usage**
- Check Render dashboard for bandwidth/build usage
- Free tier has generous limits for testing

### **3. Development Workflow**
- Test locally first
- Push to GitHub for deployment
- Test on free tier
- Fix issues and repeat

### **4. Database Management**
- SQLite file is included in service backups
- No external database management needed
- Data persists between deployments

---

## 🎉 **Ready to Deploy?**

Your `render.yaml` is now configured for your custom domain `lavishbeautyhairandnail.care` with starter tier for always-on performance!

**Next Steps:**
1. Push your code to GitHub
2. Deploy on Render (Blueprint)
3. Test all features
4. Upgrade to paid when ready for production

**Total Cost: $14/month for professional always-on service!** 🎯

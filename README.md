# MyShop Admin Portal Backend

Backend API server for MyShop Admin Portal with MoMo payment integration and email services.

## 🔧 Environment Setup

### 1. **Copy Environment Template**

```bash
cp .env.example .env
```

### 2. **Required Environment Variables**

#### **Database (Critical)**

```env
DATABASE_URL=postgresql://username:password@host:port/database?sslmode=require
```

- Get this from your NeonDB dashboard
- Format: `postgresql://user:pass@host:port/dbname?sslmode=require&channel_binding=require`

#### **Server Configuration**

```env
PORT=3000
SERVER_BASE_URL=http://localhost:3000    # Change in production!
ADMIN_PORTAL_URL=http://localhost:5173   # Frontend URL
```

#### **Email Service (Brevo)**

```env
BREVO_API_KEY=your-brevo-api-key
EMAIL_SENDER_NAME=MyShop2025
EMAIL_SENDER_EMAIL=your-email@domain.com
```

- Get API key from [Brevo Dashboard](https://app.brevo.com)
- Verify sender email in Brevo first

#### **MoMo Payment (Test Environment)**

```env
MOMO_PARTNER_CODE=MOMO
MOMO_ACCESS_KEY=F8BBA842ECF85
MOMO_SECRET_KEY=K951B6PE1waDMi640xX08PD3vg6EkVlz
```

- These are test credentials
- Replace with production credentials when going live

#### **Application Settings**

```env
PREMIUM_PRICE=199000        # Price in VND
TRIAL_EXPIRY_DAYS=15       # Trial code expiry
```

## 🚀 Quick Start

### 1. **Install Dependencies**

```bash
npm install
```

### 2. **Setup Environment**

```bash
# Copy and edit environment file
cp .env.example .env
# Edit .env with your actual values
```

### 3. **Start Development Server**

```bash
npm run dev
```

### 4. **Start Production Server**

```bash
npm start
```

## 📁 Project Structure

```
Backend-AdminPortal/
├── src/
│   ├── Configuration/     # Config files and database setup
│   ├── models/           # Database models
│   ├── services/         # Business logic services
│   ├── Payment/          # MoMo payment integration
│   ├── templates/        # Email templates
│   └── main.js          # Main server file
├── config.yaml          # YAML configuration
├── .env                 # Environment variables (DO NOT COMMIT)
├── .env.example         # Environment template
└── .gitignore          # Git ignore rules
```

## 🔐 Security Notes

1. **Never commit `.env` file** - It contains sensitive credentials
2. **Use different credentials for production** - Current MoMo keys are for testing only
3. **Verify your domain in Brevo** - Required for email sending
4. **Use HTTPS in production** - Update `SERVER_BASE_URL` accordingly

## 🌐 API Endpoints

### **Payment**

- `POST /api/request-premium` - Create premium payment request
- `POST /callback-momo/ipn-url` - MoMo IPN callback
- `GET /callback-momo/redirect` - MoMo redirect callback

### **Codes**

- `POST /api/request-trial` - Request trial code
- `GET /api/code/check/:code` - Check code validity
- `POST /api/code/deactivate` - Deactivate code

### **Utilities**

- `GET /api/callback/status/:orderId` - Check payment status
- `GET /` - Health check

## 🔍 Configuration Priority

The system uses this priority for configuration:

1. Environment variables (`.env`)
2. YAML config (`config.yaml`)
3. Default values (hardcoded)

## 📧 Email Templates

Email templates are stored in `src/templates/`:

- `email-trial.html` - Trial code email
- `email-premium.html` - Premium code email

Use `{{placeholder}}` syntax for dynamic content.

## 🐛 Troubleshooting

### **Database Connection Issues**

- Check `DATABASE_URL` format
- Ensure NeonDB connection allows your IP
- Verify SSL settings

### **Email Not Sending**

- Verify `BREVO_API_KEY` is correct
- Check sender email is verified in Brevo
- Monitor Brevo dashboard for sending status

### **MoMo Callback Issues**

- Ensure `SERVER_BASE_URL` is accessible from internet
- Check MoMo test credentials
- Verify callback URLs are correct

## 📝 Development

### **Adding New Environment Variables**

1. Add to `.env.example` with documentation
2. Update this README
3. Update relevant config files
4. Test with default values

### **Database Changes**

- Modify `src/Configuration/database.js`
- Update models in `src/models/`
- Test database initialization

---

**⚠️ Important: Keep your `.env` file secure and never commit it to version control!**

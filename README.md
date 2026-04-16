# 📱 منصة واتساب الشخصية

لوحة تحكم شخصية لإدارة WhatsApp Cloud API — مبنية على HTML/CSS/JS + Supabase + GitHub Pages.

---

## 🗂️ هيكل الملفات

```
/
├── index.html              ← redirect ذكي (login أو contacts)
├── login.html              ← صفحة تسجيل الدخول
├── contacts.html           ← جهات الاتصال
├── settings.html           ← إعدادات الربط
├── campaigns.html          ← الحملات
├── campaign-view.html      ← تفاصيل حملة
│
├── assets/
│   ├── css/style.css       ← التصميم الكامل
│   └── js/
│       ├── supabase-client.js   ← إعداد الاتصال
│       ├── auth.js              ← إدارة الجلسة
│       ├── app.js               ← helpers مشتركة
│       ├── sidebar.js           ← الشريط الجانبي
│       ├── contacts.js          ← منطق جهات الاتصال
│       ├── settings.js          ← منطق الإعدادات
│       ├── campaigns.js         ← منطق الحملات
│       └── campaign-view.js     ← تفاصيل الحملة
│
├── supabase/functions/
│   ├── verify-whatsapp-webhook/index.ts
│   ├── receive-whatsapp-webhook/index.ts
│   ├── send-test-message/index.ts
│   └── launch-campaign/index.ts
│
├── schema.sql              ← قاعدة البيانات الكاملة
└── README.md
```

---

## 🚀 خطوات الإعداد الكاملة

### 1. إنشاء مشروع Supabase

1. افتح [supabase.com](https://supabase.com) وأنشئ حسابًا
2. أنشئ مشروعًا جديدًا واحتفظ بـ:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **Anon Key** (public key)
   - **Service Role Key** (سري — للـ Edge Functions فقط)

### 2. تطبيق Schema قاعدة البيانات

1. افتح **SQL Editor** في لوحة Supabase
2. انسخ محتوى ملف `schema.sql` بالكامل
3. اضغط **Run**

### 3. إضافة مستخدم (للاستخدام الشخصي)

في لوحة Supabase → **Authentication** → **Users** → **Add User**:
- أدخل بريدك الإلكتروني وكلمة مرور
- (أو فعّل **Confirm email** = false في Auth Settings لتجنب التحقق)

### 4. تثبيت Supabase CLI

```bash
npm install -g supabase
supabase login
```

### 5. ربط المشروع المحلي

```bash
cd whatsapp-platform
supabase link --project-ref YOUR_PROJECT_ID
```

### 6. إضافة Secrets (متغيرات البيئة السرية)

```bash
# Access Token من Meta Developer Console
supabase secrets set WHATSAPP_ACCESS_TOKEN="EAAxxxxxxxxxxxxxxx"

# Verify Token — اخترعه أنت (أي نص سري)
supabase secrets set WHATSAPP_VERIFY_TOKEN="my_secret_verify_token_123"

# هذا يُضاف تلقائيًا من Supabase
# SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY و SUPABASE_ANON_KEY
```

للتحقق:
```bash
supabase secrets list
```

### 7. نشر Edge Functions

```bash
supabase functions deploy verify-whatsapp-webhook
supabase functions deploy receive-whatsapp-webhook
supabase functions deploy send-test-message
supabase functions deploy launch-campaign
```

روابط الـ Functions ستكون على شكل:
```
https://YOUR_PROJECT_ID.supabase.co/functions/v1/receive-whatsapp-webhook
```

### 8. إعداد الواجهة الأمامية

افتح ملف `assets/js/supabase-client.js` وعدّل هذين السطرين:

```javascript
const SUPABASE_URL      = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_PUBLIC_KEY';
```

### 9. رفع الواجهة على GitHub Pages

```bash
# أنشئ repo جديد على GitHub
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/USERNAME/REPO.git
git push -u origin main
```

ثم في GitHub → **Settings** → **Pages**:
- Source: `Deploy from a branch`
- Branch: `main`
- Folder: `/ (root)`
- اضغط **Save**

الرابط سيكون: `https://USERNAME.github.io/REPO/`

---

## 🔗 ربط Webhook في Meta

### الخطوات:

1. افتح [developers.facebook.com](https://developers.facebook.com)
2. اختر تطبيقك → **WhatsApp** → **Configuration**
3. في قسم **Webhooks**، اضغط **Edit**
4. أدخل:
   - **Callback URL**: `https://YOUR_PROJECT_ID.supabase.co/functions/v1/receive-whatsapp-webhook`
   - **Verify Token**: نفس القيمة في `WHATSAPP_VERIFY_TOKEN` السابق
5. اضغط **Verify and Save**
6. فعّل الـ subscriptions التالية:
   - `messages`
   - `message_deliveries`
   - `message_reads`

---

## 📩 اختبار إرسال رسالة تجريبية

**المتطلبات:**
- يجب أن يكون رقم الجوال المستهدف مضافًا في **Test Phone Numbers** في Meta Dashboard
- القالب المستخدم افتراضيًا هو `hello_world` بلغة `en_US` — وهو متاح في جميع حسابات Meta

**الخطوات:**
1. افتح **settings.html**
2. أدخل Phone Number ID و WABA ID
3. احفظ الإعدادات
4. في قسم **إرسال رسالة تجريبية**، أدخل رقم جوالك
5. اضغط **إرسال**

---

## 🏗️ المعمارية التقنية

```
[GitHub Pages - Static Frontend]
        │
        │ Supabase JS SDK (HTTPS)
        ▼
[Supabase Auth] ──── JWT ────► [Edge Functions (Deno)]
        │                              │
        │                              │ WHATSAPP_ACCESS_TOKEN (secret)
        ▼                              ▼
[Supabase PostgreSQL DB] ◄──── [WhatsApp Cloud API]
        ▲
        │ webhook POST
[Meta Servers] ──────────────► [receive-whatsapp-webhook Function]
```

**المبدأ الأمني:**
- الواجهة الأمامية: تحتوي فقط على Anon Key (عام + محمي بـ RLS)
- Access Token: مخزن فقط في Supabase Secrets
- جميع العمليات الحساسة: تتم من Edge Functions فقط
- RLS: كل مستخدم يرى بياناته فقط

---

## 🔐 المتغيرات المطلوبة

### في `supabase-client.js` (Frontend - عامة):
```
SUPABASE_URL      = https://xxxxx.supabase.co
SUPABASE_ANON_KEY = eyJxxx...  (anon/public key)
```

### في Supabase Secrets (سرية - Edge Functions فقط):
```
WHATSAPP_ACCESS_TOKEN  = EAAxxxxxxx  (من Meta)
WHATSAPP_VERIFY_TOKEN  = my_token    (تختاره أنت)
```

### تلقائية من Supabase (لا تحتاج إضافتها):
```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_ANON_KEY
```

---

## 🔧 نصائح للتطوير المحلي

### تشغيل Functions محليًا:
```bash
supabase start
supabase functions serve --env-file .env.local
```

محتوى `.env.local`:
```
WHATSAPP_ACCESS_TOKEN=EAAxxxxxxx
WHATSAPP_VERIFY_TOKEN=test_token_123
```

### مشاهدة logs الـ Functions:
```bash
supabase functions logs receive-whatsapp-webhook --tail
```

### إعادة تعيين DB:
```bash
supabase db reset
```

---

## 📋 المرحلة الثانية — الاقتراحات

### الميزات المقترحة:

**1. صندوق الوارد (Inbox)**
- جدول `conversations` و `messages`
- استقبال الرسائل الواردة وعرضها
- الرد اليدوي من المنصة
- صفحة `inbox.html`

**2. الرد الآلي**
- جدول `automation_rules`
- قواعد بسيطة: "إذا وردت رسالة تحتوي على X → أرسل Y"
- تنفيذ في `receive-whatsapp-webhook` Function

**3. الردود السريعة**
- جدول `quick_replies`
- اختصارات للرسائل المتكررة في صندوق الوارد

**4. إحصائيات متقدمة**
- صفحة `analytics.html`
- رسوم بيانية لمعدلات الإرسال والتسليم
- أفضل أوقات الإرسال

**5. جدولة الحملات**
- إضافة حقل `scheduled_at` (موجود في الـ schema)
- Cron Job في Supabase لإطلاق الحملات في وقتها

**6. قوالب ديناميكية**
- دعم Template Components (body variables)
- تخصيص الاسم لكل مستلم
- جاهز في كود `launch-campaign` (معلّق)

**7. استيراد CSV**
- زر **استيراد CSV** موجود في contacts.html
- يحتاج إضافة منطق قراءة وتحليل الملف

---

## ⚠️ ملاحظات مهمة

- **WhatsApp Cloud API**: مجاني لأول 1000 محادثة/شهر، ثم رسوم حسب النوع والدولة
- **Template Messages**: يجب أن تكون القوالب معتمدة من Meta قبل الاستخدام
- **24-Hour Window**: يمكن إرسال رسائل حرة فقط خلال 24 ساعة من آخر رسالة من العميل
- **Opt-in**: يجب الحصول على موافقة العميل قبل إرسال أي رسالة (شرط Meta)

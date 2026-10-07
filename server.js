const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const cors = require("cors");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const helmet = require("helmet");
const path = require("path");

// Load environment variables.
dotenv.config();

const PORT = Number(process.env.PORT || 5000);
const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const REQUEST_STATUSES = ["Pending", "Approved", "Completed", "Rejected"];
const PUBLIC_DIR = __dirname;

function requireEnv(name) {
  if (!process.env[name]) {
    console.error(`Ã¢ÂÅ’ Missing required environment variable: ${name}`);
    process.exit(1);
  }
}

requireEnv("SUPABASE_URL");
requireEnv("SUPABASE_SERVICE_ROLE_KEY");
requireEnv("JWT_SECRET");
requireEnv("ADMIN_EMAIL");
requireEnv("ADMIN_PASSWORD");

// IMPORTANT: this client is server-side only. Never expose the service-role key to the browser.
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false },
  },
);

const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "1mb" }));

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-hashes'",
          "https://cdn.jsdelivr.net",
          "https://cdnjs.cloudflare.com",
          "https://kit.fontawesome.com",
        ],
        scriptSrcAttr: ["'unsafe-inline'", "'unsafe-hashes'"],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com",
          "https://cdnjs.cloudflare.com",
        ],
        fontSrc: [
          "'self'",
          "https://fonts.gstatic.com",
          "https://cdnjs.cloudflare.com",
          "https://ka-f.fontawesome.com",
        ],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "http://localhost:5000", "https:"],
        frameSrc: [
          "'self'",
          "https://www.google.com",
          "https://maps.google.com",
        ],
      },
    },
  }),
);

const allowedOrigins = new Set([
  "http://127.0.0.1:5500",
  "http://localhost:5500",
  "http://127.0.0.1:5000",
  "http://localhost:5000",
]);

if (process.env.RENDER_EXTERNAL_URL) allowedOrigins.add(process.env.RENDER_EXTERNAL_URL);
if (process.env.FRONTEND_URL) allowedOrigins.add(process.env.FRONTEND_URL);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.has(origin) ||
        origin.endsWith(".onrender.com") ||
        origin.endsWith(".vercel.app")
      ) {
        return callback(null, true);
      }
      return callback(new Error("CORS origin not allowed"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.static(PUBLIC_DIR));
app.get("/favicon.ico", (_req, res) => res.status(204).end());

/* -------------------- EMAIL -------------------- */
const transporter =
  process.env.EMAIL_USER && process.env.EMAIL_PASS
    ? nodemailer.createTransport({
        service: "gmail",
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
      })
    : null;

if (transporter) {
  transporter.verify((error) => {
    if (error) console.log("Ã¢ÂÅ’ Email config error:", error.message);
    else console.log("Ã¢Å“â€¦ Email server ready");
  });
} else {
  console.log("Ã¢Å¡Â Ã¯Â¸Â Email notifications disabled");
}

/* -------------------- EMAIL HELPERS -------------------- */

async function sendEmail(options) {
  if (!transporter) {
    console.log("âš ï¸ Email skipped: SMTP is not configured");
    return { success: false, skipped: true };
  }

  try {
    const info = await transporter.sendMail({
      from: `"JharJeevan Blood Bank" <${JHARJEEVAN_EMAIL_FROM}>`, 
      ...options,
    });

    console.log(`Email sent: ${options.subject || "(no subject)"}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`âŒ Email failed: ${options.subject || "(no subject)"} - ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function sendAdminNotification(subject, html) {
  const adminEmail = normalizeEmail(process.env.ADMIN_EMAIL);

  if (!adminEmail) {
    console.log("âš ï¸ Admin notification skipped: ADMIN_EMAIL is not configured");
    return;
  }

  await sendEmail({
    to: adminEmail,
    subject,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:650px;margin:auto;padding:24px;color:#222">
        <div style="background:#d32f2f;color:white;padding:18px;border-radius:10px 10px 0 0">
          <h2 style="margin:0">JharJeevan Admin Notification</h2>
        </div>
        <div style="padding:24px;border:1px solid #eee;border-top:0;border-radius:0 0 10px 10px">
          ${html}
          <hr style="border:0;border-top:1px solid #eee;margin:24px 0">
          <p style="font-size:12px;color:#777">
            This is an automated notification from JharJeevan Blood Bank.
          </p>
        </div>
      </div>
    `,
  });
}

/* -------------------- NEWSLETTER -------------------- */

app.post("/api/newsletter/subscribe", async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const name = String(req.body.name || "").trim() || null;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address",
      });
    }

    const { data: existing, error: findError } = await supabase
      .from("email_subscribers")
      .select("id,email,name,is_active")
      .eq("email", email)
      .maybeSingle();

    if (findError) throw findError;

    if (existing) {
      if (!existing.is_active) {
        const { error: reactivateError } = await supabase
          .from("email_subscribers")
          .update({
            is_active: true,
            unsubscribed_at: null,
            name: name || existing.name,
          })
          .eq("id", existing.id);

        if (reactivateError) throw reactivateError;
      }

      await sendEmail({
        to: email,
        subject: "Welcome Back to JharJeevan Newsletter",
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px">
            <h2 style="color:#c0392b">Welcome back to JharJeevan â¤ï¸</h2>
            <p>Hello ${name || existing.name || "there"},</p>
            <p>Your newsletter subscription is active again.</p>
            <p>Thank you for staying connected with JharJeevan Blood Bank.</p>
          </div>
        `,
      });

      return res.json({
        success: true,
        message: "You are already subscribed to our newsletter.",
      });
    }

    const { data: subscriber, error } = await supabase
      .from("email_subscribers")
      .insert({
        email,
        name,
        is_active: true,
      })
      .select("*")
      .single();

    if (error) throw error;

    await sendEmail({
      to: email,
      subject: "Welcome to JharJeevan Newsletter â¤ï¸",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px">
          <div style="text-align:center">
            <h2 style="color:#c0392b">Welcome to JharJeevan â¤ï¸</h2>
          </div>
          <p>Hello ${name || "there"},</p>
          <p>Thank you for subscribing to the JharJeevan newsletter.</p>
          <p>You will receive important blood donation updates, awareness messages,
          announcements and other useful information from us.</p>
          <p><strong>Together, we can save lives.</strong></p>
          <hr style="border:0;border-top:1px solid #eee">
          <p style="font-size:12px;color:#777">
            This email was sent because you subscribed to JharJeevan.
          </p>
        </div>
      `,
    });

    await sendAdminNotification(
      "ðŸ“° New Newsletter Subscriber - JharJeevan",
      `
        <h3>New newsletter subscription</h3>
        <p><strong>Email:</strong> ${email}</p>
        ${name ? `<p><strong>Name:</strong> ${name}</p>` : ""}
        <p><strong>Subscribed:</strong> ${new Date().toLocaleString()}</p>
      `
    );

    return res.status(201).json({
      success: true,
      message: "Thank you for subscribing to our newsletter!",
      subscriber: {
        id: subscriber.id,
        email: subscriber.email,
      },
    });
  } catch (error) {
    console.error("Newsletter subscription error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to subscribe right now. Please try again.",
    });
  }
});
/* -------------------- DATABASE HELPERS -------------------- */
function publicDonor(row) {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    name: row.name,
    age: row.age,
    bloodGroup: row.blood_group,
    phone: row.phone,
    email: row.email || "",
    location: row.location,
    lastDonationDate: row.last_donation_date,
    isAvailable: row.is_available,
    createdAt: row.created_at,
  };
}

function publicRequest(row) {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    patientName: row.patient_name,
    bloodGroup: row.blood_group,
    unitsRequired: row.units_required,
    hospitalName: row.hospital_name,
    hospitalAddress: row.hospital_address,
    city: row.city,
    requiredDate: row.required_date,
    requesterName: row.requester_name,
    requesterPhone: row.requester_phone,
    requesterEmail: row.requester_email || "",
    status: row.status,
    priority: row.priority,
    notes: row.notes || "",
    approvedBy: row.approved_by || null,
    approvedAt: row.approved_at || null,
    createdAt: row.created_at,
  };
}

function publicAdmin(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    phone: row.phone,
    createdAt: row.created_at,
  };
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function validBloodGroup(value) {
  return BLOOD_GROUPS.includes(value);
}

function validUUID(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || ""),
  );
}

function sanitizeSearch(value) {
  return String(value || "")
    .trim()
    .replace(/[,%()]/g, " ")
    .slice(0, 80);
}

function parseDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function initAdmin() {
  const email = normalizeEmail(process.env.ADMIN_EMAIL);
  const { data: existing, error: findError } = await supabase
    .from("admins")
    .select("id,email,name,phone,created_at")
    .eq("email", email)
    .maybeSingle();

  if (findError) throw findError;

  if (existing) {
    console.log(`Ã¢Å“â€¦ Admin account ready: ${email}`);
    return;
  }

  const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);
  const { error } = await supabase.from("admins").insert({
    email,
    password_hash: passwordHash,
    name: process.env.ADMIN_NAME || "Administrator",
    phone: process.env.ADMIN_PHONE || null,
  });

  if (error) throw error;
  console.log(`Ã¢Å“â€¦ Admin account created: ${email}`);
}

/* -------------------- AUTH -------------------- */
function verifyAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Authentication required" });
  }

  try {
    const decoded = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);
    if (decoded.role !== "admin" || !decoded.id || !validUUID(decoded.id)) {
      return res.status(403).json({ success: false, message: "Admin privileges required" });
    }
    req.admin = decoded;
    return next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: error.name === "TokenExpiredError" ? "Token expired. Please login again." : "Invalid token",
    });
  }
}

/* -------------------- AUTH ROUTES -------------------- */
app.post("/api/admin/login", async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required" });
    }

    const { data: admin, error } = await supabase.from("admins").select("*").eq("email", email).maybeSingle();
    if (error) throw error;
    if (!admin || !(await bcrypt.compare(password, admin.password_hash))) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { role: "admin", id: admin.id, email: admin.email, name: admin.name },
      process.env.JWT_SECRET,
      { expiresIn: "24h" },
    );

    return res.json({ success: true, token, admin: publicAdmin(admin), message: "Login successful" });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ success: false, message: "Server error during login" });
  }
});

app.get("/api/admin/verify", verifyAdmin, async (req, res) => {
  try {
    const { data: admin, error } = await supabase
      .from("admins")
      .select("id,email,name,phone,created_at")
      .eq("id", req.admin.id)
      .maybeSingle();
    if (error) throw error;
    if (!admin) return res.status(401).json({ success: false, message: "Admin account not found" });
    return res.json({ success: true, admin: publicAdmin(admin), message: "Token is valid" });
  } catch (error) {
    console.error("Verify error:", error);
    return res.status(500).json({ success: false, message: "Error verifying token" });
  }
});

app.post("/api/admin/forgot", async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    if (!email) return res.status(400).json({ success: false, message: "Email is required" });

    const { data: admin, error } = await supabase.from("admins").select("*").eq("email", email).maybeSingle();
    if (error) throw error;

    // Do not reveal whether an admin email exists.
    if (!admin) {
      return res.json({ success: true, message: "If your email is registered, you will receive a password reset link" });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");
    const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const { error: updateError } = await supabase
      .from("admins")
      .update({ reset_token_hash: resetTokenHash, reset_token_expires: resetTokenExpires })
      .eq("id", admin.id);
    if (updateError) throw updateError;

    const baseUrl = process.env.FRONTEND_URL || `${req.protocol}://${req.get("host")}`;
    const resetUrl = `${baseUrl.replace(/\/$/, "")}/reset-password.html?token=${encodeURIComponent(resetToken)}`;

    if (transporter) {
      await transporter.sendMail({
        from: `"JharJeevan Blood Bank" <${JHARJEEVAN_EMAIL_FROM}>`, 
        to: admin.email,
        subject: "Password Reset Request - JharJeevan Admin Panel",
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px"><h2 style="color:#d32f2f">Password Reset Request</h2><p>Hello ${admin.name || "Administrator"},</p><p>Click the link below to reset your password. It is valid for 1 hour.</p><p><a href="${resetUrl}" style="background:#d32f2f;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block">Reset Password</a></p><p>If you didn't request this, ignore this email.</p></div>`,
      });
      return res.json({ success: true, message: "Password reset link has been sent to your email" });
    }

    console.log(`Ã¢Å¡Â Ã¯Â¸Â Email not configured. Reset URL for ${email}: ${resetUrl}`);
    return res.json({ success: true, message: "Email is not configured. Check the server console for the reset link." });
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({ success: false, message: "Error sending reset link. Please try again." });
  }
});

app.post("/api/admin/reset/:token", async (req, res) => {
  try {
    const newPassword = String(req.body.newPassword || "");
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
    }

    const tokenHash = crypto.createHash("sha256").update(String(req.params.token)).digest("hex");
    const { data: admin, error } = await supabase
      .from("admins")
      .select("id")
      .eq("reset_token_hash", tokenHash)
      .gt("reset_token_expires", new Date().toISOString())
      .maybeSingle();
    if (error) throw error;
    if (!admin) return res.status(400).json({ success: false, message: "Invalid or expired reset token. Please request a new one." });

    const passwordHash = await bcrypt.hash(newPassword, 12);
    const { error: updateError } = await supabase
      .from("admins")
      .update({ password_hash: passwordHash, reset_token_hash: null, reset_token_expires: null })
      .eq("id", admin.id);
    if (updateError) throw updateError;

    return res.json({ success: true, message: "Password has been reset successfully" });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({ success: false, message: "Error resetting password. Please try again." });
  }
});

/* -------------------- CLIENT AUTH -------------------- */
function verifyClient(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  try {
    const decoded = jwt.verify(
      authHeader.slice(7),
      process.env.JWT_SECRET
    );

    if (
      decoded.role !== "client" ||
      !decoded.id ||
      !validUUID(decoded.id)
    ) {
      return res.status(403).json({
        success: false,
        message: "Client access required",
      });
    }

    req.client = decoded;
    return next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message:
        error.name === "TokenExpiredError"
          ? "Token expired. Please login again."
          : "Invalid token",
    });
  }
}

function publicClient(client) {
  return {
    id: client.id,
    name: client.name,
    email: client.email,
    phone: client.phone || null,
    bloodGroup: client.blood_group || null,
    location: client.location || null,
    isActive: client.is_active,
    lastLoginAt: client.last_login_at || null,
    createdAt: client.created_at,
    updatedAt: client.updated_at,
  };
}

/* -------------------- JHARJEEVAN CLIENT NOTIFICATIONS -------------------- */

async function createClientNotification({
  recipientId,
  type,
  title,
  message,
  data = {},
}) {
  if (!recipientId) return null;

  const { data: notification, error } = await supabase
    .from("notifications")
    .insert({
      recipient_type: "client",
      recipient_id: recipientId,
      type,
      title,
      message,
      data,
    })
    .select("*")
    .single();

  if (error) {
    console.error("Client notification error:", error);
    return null;
  }

  return notification;
}

async function createAdminNotification({
  type,
  title,
  message,
  data = {},
}) {
  try {
    const adminEmail =
      normalizeEmail(process.env.ADMIN_EMAIL);

    if (!adminEmail) return null;

    const { data: admin, error: adminError } =
      await supabase
        .from("admins")
        .select("id,email,name")
        .eq("email", adminEmail)
        .maybeSingle();

    if (adminError) {
      console.error(
        "Admin lookup notification error:",
        adminError
      );
      return null;
    }

    if (!admin?.id) {
      console.warn(
        "Admin notification skipped: admin account not found."
      );
      return null;
    }

    const { data: notification, error } =
      await supabase
        .from("notifications")
        .insert({
          recipient_type: "admin",
          recipient_id: admin.id,
          type,
          title,
          message,
          data,
        })
        .select("*")
        .single();

    if (error) {
      console.error(
        "Admin notification error:",
        error
      );
      return null;
    }

    return notification;

  } catch (error) {
    console.error(
      "Admin notification exception:",
      error
    );

    return null;
  }
}

async function sendClientWelcomeEmail(client) {

  const safeName =
    escapeEmailHtml(client.name || "there");

  const loginUrl =
    `${getJharJeevanEmailBaseUrl()}/client-login.html`;

  const content = `

    <p
      style="
        margin:0 0 16px;
        color:#667085;
        font-size:14px;
        line-height:1.7;
      "
    >
      Hello <strong style="color:#172238;">${safeName}</strong>,
    </p>

    <p
      style="
        margin:0;
        color:#667085;
        font-size:14px;
        line-height:1.7;
      "
    >
      Your JharJeevan client account has been created
      successfully. You can now access your client portal
      and manage your blood-support requests.
    </p>

    ${getEmailButton({
      href: loginUrl,
      label: "Open Client Portal",
    })}

    <div
      style="
        margin-top:24px;
        padding:15px;
        border-radius:13px;
        background:#fff5f6;
        border:1px solid #ffe1e4;
      "
    >
      <strong
        style="
          color:#be123c;
          font-size:12px;
          font-family:Arial,Helvetica,sans-serif;
        "
      >
        ❤️ Welcome to the JharJeevan network
      </strong>

      <p
        style="
          margin:6px 0 0;
          color:#667085;
          font-size:12px;
          line-height:1.6;
          font-family:Arial,Helvetica,sans-serif;
        "
      >
        Thank you for joining a community built to
        connect people with blood-support services.
      </p>
    </div>

  `;

  return sendEmail({
    to: client.email,
    subject: "Welcome to JharJeevan Blood Bank",
    from: JHARJEEVAN_EMAIL_FROM,
    html: getJharJeevanEmailShell({
      eyebrow: "CLIENT ACCOUNT",
      title: "Welcome to JharJeevan",
      intro: "Your account is ready.",
      content,
    }),
  });
}

async function sendNewClientAdminEmail(client) {

  const adminEmail =
    normalizeEmail(process.env.ADMIN_EMAIL);

  if (!adminEmail) {
    return {
      success: false,
      skipped: true,
      reason: "missing_admin_email",
    };
  }

  const safeEmail =
    escapeEmailHtml(client.email || "—");

  const safePhone =
    escapeEmailHtml(client.phone || "—");

  const safeBloodGroup =
    escapeEmailHtml(client.blood_group || "—");

  const safeLocation =
    escapeEmailHtml(client.location || "—");

  const safeName =
    escapeEmailHtml(client.name || "—");

  const registeredAt =
    new Date().toLocaleString(
      "en-IN",
      {
        timeZone: "Asia/Kolkata",
        dateStyle: "medium",
        timeStyle: "short",
      }
    );

  const dashboardUrl =
    `${getJharJeevanEmailBaseUrl()}/admin.html`;

  const content = `

    <p
      style="
        margin:0 0 20px;
        color:#667085;
        font-size:14px;
        line-height:1.7;
      "
    >
      A new client has successfully registered
      on JharJeevan.
    </p>

    ${getEmailInfoCard([
      {
        label: "Name",
        value: safeName,
      },
      {
        label: "Email",
        value: `
          <a
            href="mailto:${safeEmail}"
            style="
              color:#d92337;
              text-decoration:none;
            "
          >
            ${safeEmail}
          </a>
        `,
      },
      {
        label: "Phone",
        value: `
          <a
            href="tel:${safePhone}"
            style="
              color:#d92337;
              text-decoration:none;
            "
          >
            ${safePhone}
          </a>
        `,
      },
      {
        label: "Blood Group",
        value: safeBloodGroup,
      },
      {
        label: "Location",
        value: safeLocation,
      },
      {
        label: "Registered",
        value: escapeEmailHtml(registeredAt),
      },
    ])}

    ${getEmailButton({
      href: dashboardUrl,
      label: "Review in Admin Dashboard",
    })}

    <p
      style="
        margin:0;
        color:#98a2b3;
        font-family:Arial,Helvetica,sans-serif;
        font-size:11px;
        line-height:1.6;
        text-align:center;
      "
    >
      Please review the account from the admin
      dashboard when convenient.
    </p>

  `;

  return sendEmail({
    to: adminEmail,
    subject: "New Client Registration — JharJeevan Blood Bank",
    from: JHARJEEVAN_EMAIL_FROM,
    html: getJharJeevanEmailShell({
      eyebrow: "ADMIN NOTIFICATION",
      title: "New Client Registration",
      intro: "A new client account requires your attention.",
      content,
    }),
  });
}
/* -------------------- CLIENT PASSWORD RESET SYSTEM -------------------- */

const CLIENT_PASSWORD_RESET_EXPIRY_MINUTES = 30;

function generateClientResetToken() {
  return crypto.randomBytes(32).toString("hex");
}

function hashClientResetToken(token) {
  return crypto
    .createHash("sha256")
    .update(String(token))
    .digest("hex");
}

function getClientPortalBaseUrl() {
  const configured =
    process.env.CLIENT_APP_URL ||
    process.env.FRONTEND_URL ||
    process.env.APP_URL;

  if (!configured) {
    return "http://localhost:5000";
  }

  return configured.replace(/\/+$/, "");
}

function isStrongClientPassword(password) {
  return (
    password.length >= 8 &&
    password.length <= 128 &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

function escapeClientResetHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function sendClientPasswordResetEmail(client, resetUrl) {

  if (!client?.email) {
    return {
      success: false,
      skipped: true,
      reason: "missing_client_email",
    };
  }

  const safeName =
    escapeEmailHtml(client.name || "there");

  const safeUrl =
    escapeEmailHtml(resetUrl);

  const content = `

    <p
      style="
        margin:0 0 16px;
        color:#667085;
        font-size:14px;
        line-height:1.7;
      "
    >
      Hello <strong style="color:#172238;">${safeName}</strong>,
    </p>

    <p
      style="
        margin:0;
        color:#667085;
        font-size:14px;
        line-height:1.7;
      "
    >
      We received a request to reset the password
      for your JharJeevan client account.
    </p>

    ${getEmailButton({
      href: safeUrl,
      label: "Reset My Password",
    })}

    <div
      style="
        margin:24px 0;
        padding:16px;
        border-radius:13px;
        background:#fff5f6;
        border:1px solid #ffe1e4;
      "
    >

      <strong
        style="
          color:#be123c;
          font-family:Arial,Helvetica,sans-serif;
          font-size:12px;
        "
      >
        🔒 Secure password reset
      </strong>

      <p
        style="
          margin:7px 0 0;
          color:#667085;
          font-family:Arial,Helvetica,sans-serif;
          font-size:12px;
          line-height:1.6;
        "
      >
        This link expires in
        <strong>${CLIENT_PASSWORD_RESET_EXPIRY_MINUTES} minutes</strong>
        and can only be used once.
      </p>

    </div>

    <p
      style="
        color:#667085;
        font-family:Arial,Helvetica,sans-serif;
        font-size:12px;
        line-height:1.6;
      "
    >
      If you did not request this password reset,
      you can safely ignore this email.
    </p>

    <div
      style="
        margin-top:22px;
        padding-top:18px;
        border-top:1px solid #edf0f4;
      "
    >

      <p
        style="
          margin:0 0 7px;
          color:#667085;
          font-family:Arial,Helvetica,sans-serif;
          font-size:11px;
          font-weight:700;
        "
      >
        Button not working?
      </p>

      <a
        href="${safeUrl}"
        style="
          color:#d92337;
          font-family:Arial,Helvetica,sans-serif;
          font-size:10px;
          line-height:1.5;
          word-break:break-all;
        "
      >
        ${safeUrl}
      </a>

    </div>

  `;

  return sendEmail({
    to: client.email,
    subject: "Reset Your JharJeevan Password",
    from: JHARJEEVAN_EMAIL_FROM,
    html: getJharJeevanEmailShell({
      eyebrow: "ACCOUNT SECURITY",
      title: "Reset your password",
      intro: "Use the secure link below to choose a new password.",
      content,
    }),
  });
}

async function sendClientPasswordChangedEmail(client) {
  if (!transporter) {
    return { success: false, skipped: true };
  }

  const safeName = escapeClientResetHtml(client.name || "there");

  return sendEmail({
    to: client.email,
    subject: "Your JharJeevan Password Was Changed",
    html: `
      <div style="
        font-family:Arial,sans-serif;
        max-width:620px;
        margin:auto;
        padding:30px;
        color:#172238;
      ">
        <h2 style="color:#dc2626;">Password Changed Successfully</h2>

        <p>Hello ${safeName},</p>

        <p>
          Your JharJeevan client account password has been changed
          successfully.
        </p>

        <p>
          If you did not make this change, please contact the
          JharJeevan administration immediately.
        </p>

        <p style="color:#667085;font-size:14px;">
          This is an automatic security notification.
        </p>
      </div>
    `,
  });
}

/*
 * CLIENT FORGOT PASSWORD
 *
 * Security properties:
 * - Does not reveal whether an email exists.
 * - Generates 32 random bytes.
 * - Stores only SHA-256 token hash.
 * - Invalidates previous unused tokens.
 * - Token expires after 30 minutes.
 */
app.post("/api/client/forgot-password", async (req, res) => {
  const genericMessage =
    "If that email address is registered, we will send a password reset link shortly.";

  try {
    const email = normalizeEmail(req.body.email);

    if (!email) {
      return res.json({
        success: true,
        message: genericMessage,
      });
    }

    const { data: client, error: clientError } = await supabase
      .from("client_users")
      .select("id,name,email,is_active")
      .eq("email", email)
      .maybeSingle();

    if (clientError) throw clientError;

    /*
     * Never reveal whether the account exists.
     */
    if (!client || client.is_active === false) {
      return res.json({
        success: true,
        message: genericMessage,
      });
    }

    /*
     * Invalidate all previous unused reset tokens.
     */
    const { error: invalidateError } = await supabase
      .from("client_password_resets")
      .update({ used_at: new Date().toISOString() })
      .eq("client_id", client.id)
      .is("used_at", null);

    if (invalidateError) throw invalidateError;

    const rawToken = generateClientResetToken();
    const tokenHash = hashClientResetToken(rawToken);

    const expiresAt = new Date(
      Date.now() + CLIENT_PASSWORD_RESET_EXPIRY_MINUTES * 60 * 1000
    ).toISOString();

    const { error: insertError } = await supabase
      .from("client_password_resets")
      .insert({
        client_id: client.id,
        token_hash: tokenHash,
        expires_at: expiresAt,
      });

    if (insertError) throw insertError;

    const resetUrl =
      `${getClientPortalBaseUrl()}/client-reset-password.html?token=` +
      encodeURIComponent(rawToken);

    const emailResult = await sendClientPasswordResetEmail(
      client,
      resetUrl
    );

    /*
     * Do not leave a usable token behind if the email could not be sent.
     */
    if (!emailResult.success && !emailResult.skipped) {
      await supabase
        .from("client_password_resets")
        .update({ used_at: new Date().toISOString() })
        .eq("token_hash", tokenHash);

      console.error(
        "Client password reset email failed:",
        emailResult.error || "Unknown email error"
      );
    }

    if (emailResult.skipped) {
      console.warn(
        `SMTP not configured. Client reset email was not sent for ${email}.`
      );
    }

    return res.json({
      success: true,
      message: genericMessage,
    });
  } catch (error) {
    console.error("Client forgot password error:", error);

    /*
     * Keep the public response generic even when something fails.
     */
    return res.json({
      success: true,
      message: genericMessage,
    });
  }
});

/*
 * CLIENT RESET PASSWORD
 */
app.post("/api/client/reset-password", async (req, res) => {
  try {
    const token = String(req.body.token || "").trim();
    const newPassword = String(req.body.newPassword || "");

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Reset token is required.",
      });
    }

    if (!isStrongClientPassword(newPassword)) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be 8-128 characters and include an uppercase letter, a number, and a special character.",
      });
    }

    const tokenHash = hashClientResetToken(token);

    const { data: resetRecord, error: resetError } = await supabase
      .from("client_password_resets")
      .select("id,client_id,expires_at,used_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (resetError) throw resetError;

    if (!resetRecord) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token. Please request a new link.",
      });
    }

    if (resetRecord.used_at) {
      return res.status(400).json({
        success: false,
        message: "This reset link has already been used.",
      });
    }

    if (new Date(resetRecord.expires_at).getTime() <= Date.now()) {
      return res.status(400).json({
        success: false,
        message: "This reset link has expired. Please request a new one.",
      });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    const { data: client, error: clientError } = await supabase
      .from("client_users")
      .select("id,name,email,is_active")
      .eq("id", resetRecord.client_id)
      .maybeSingle();

    if (clientError) throw clientError;

    if (!client || client.is_active === false) {
      return res.status(400).json({
        success: false,
        message: "Client account is unavailable.",
      });
    }

    const { error: updateError } = await supabase
      .from("client_users")
      .update({
        password_hash: passwordHash,
        updated_at: new Date().toISOString(),
      })
      .eq("id", client.id);

    if (updateError) throw updateError;

    /*
     * Single-use token: invalidate immediately after successful reset.
     */
    const { error: consumeError } = await supabase
      .from("client_password_resets")
      .update({
        used_at: new Date().toISOString(),
      })
      .eq("id", resetRecord.id)
      .is("used_at", null);

    if (consumeError) throw consumeError;

    await Promise.allSettled([
      createClientNotification({
        recipientId: client.id,
        type: "password_changed",
        title: "Password changed successfully",
        message:
          "Your JharJeevan account password was changed successfully.",
        data: {
          clientId: client.id,
        },
      }),

      sendClientPasswordChangedEmail(client),
    ]);

    return res.json({
      success: true,
      message:
        "Your password has been changed successfully. You can now log in.",
    });
  } catch (error) {
    console.error("Client reset password error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to reset password right now. Please try again.",
    });
  }
});


/* ============================================================
   JHARJEEVAN PREMIUM EMAIL SYSTEM
   Consistent transactional email design
   ============================================================ */

const JHARJEEVAN_EMAIL_FROM =
  process.env.EMAIL_FROM ||
  process.env.EMAIL_USER;

function escapeEmailHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


function getJharJeevanEmailBaseUrl() {

  const configured =
    process.env.CLIENT_APP_URL ||
    process.env.APP_URL;

  return (
    configured ||
    "http://localhost:5000"
  ).replace(/\/+$/, "");
}
function getJharJeevanEmailYear() {
  return new Date().getFullYear();
}

function getJharJeevanEmailFooter() {
  return `
    <tr>
      <td
        style="
          padding:26px 32px 30px;
          text-align:center;
          border-top:1px solid #edf0f4;
          background:#fbfcfe;
        "
      >
        <div
          style="
            font-family:Arial,Helvetica,sans-serif;
            font-size:13px;
            font-weight:700;
            color:#344054;
          "
        >
          JharJeevan Blood Bank
        </div>

        <div
          style="
            margin-top:6px;
            font-family:Arial,Helvetica,sans-serif;
            font-size:11px;
            line-height:1.6;
            color:#98a2b3;
          "
        >
          Safe. Secure. Connected.
          <br>
          This is an automated email. Please do not reply.
        </div>

        <div
          style="
            margin-top:12px;
            font-family:Arial,Helvetica,sans-serif;
            font-size:10px;
            color:#b0b8c5;
          "
        >
          © ${getJharJeevanEmailYear()} JharJeevan Blood Bank
        </div>
      </td>
    </tr>
  `;
}

function getJharJeevanEmailShell({
  eyebrow = "",
  title = "",
  intro = "",
  content = "",
  accent = "#e11d2e",
}) {

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  >
  <meta
    name="color-scheme"
    content="light"
  >
  <title>JharJeevan</title>
</head>

<body
  style="
    margin:0;
    padding:0;
    background:#f5f7fa;
  "
>

  <table
    role="presentation"
    width="100%"
    cellpadding="0"
    cellspacing="0"
    border="0"
    style="
      width:100%;
      background:#f5f7fa;
    "
  >

    <tr>
      <td
        align="center"
        style="
          padding:32px 14px;
        "
      >

        <table
          role="presentation"
          width="620"
          cellpadding="0"
          cellspacing="0"
          border="0"
          style="
            width:100%;
            max-width:620px;
            background:#ffffff;
            border:1px solid #e7ebf0;
            border-radius:20px;
            overflow:hidden;
          "
        >

          <!-- BRAND HEADER -->
          <tr>
            <td
              style="
                padding:28px 32px;
                background:
                  linear-gradient(
                    135deg,
                    #be123c 0%,
                    #ef3340 52%,
                    #dc2626 100%
                  );
              "
            >

              <table
                role="presentation"
                cellpadding="0"
                cellspacing="0"
                border="0"
              >
                <tr>

                  <td
                    valign="middle"
                    style="
                      width:48px;
                      height:48px;
                      background:#ffffff;
                      border-radius:14px;
                      text-align:center;
                      vertical-align:middle;
                      font-family:Arial,Helvetica,sans-serif;
                      font-size:20px;
                      font-weight:700;
                      color:#e11d2e;
                    "
                  >
                    ♥
                  </td>

                  <td
                    style="
                      padding-left:13px;
                      font-family:Arial,Helvetica,sans-serif;
                    "
                  >
                    <div
                      style="
                        color:#ffffff;
                        font-size:18px;
                        font-weight:800;
                        line-height:1.2;
                      "
                    >
                      JharJeevan
                    </div>

                    <div
                      style="
                        margin-top:3px;
                        color:rgba(255,255,255,.82);
                        font-size:11px;
                        font-weight:600;
                      "
                    >
                      Blood Bank
                    </div>
                  </td>

                </tr>
              </table>

            </td>
          </tr>


          <!-- CONTENT -->
          <tr>
            <td
              style="
                padding:34px 32px 30px;
                font-family:Arial,Helvetica,sans-serif;
                color:#172238;
              "
            >

              ${
                eyebrow
                  ? `
                    <div
                      style="
                        margin-bottom:10px;
                        color:${accent};
                        font-size:10px;
                        font-weight:800;
                        letter-spacing:1.4px;
                      "
                    >
                      ${escapeEmailHtml(eyebrow)}
                    </div>
                  `
                  : ""
              }

              <h1
                style="
                  margin:0;
                  color:#172238;
                  font-size:27px;
                  line-height:1.2;
                  letter-spacing:-.5px;
                "
              >
                ${title}
              </h1>

              ${
                intro
                  ? `
                    <p
                      style="
                        margin:14px 0 0;
                        color:#667085;
                        font-size:14px;
                        line-height:1.7;
                      "
                    >
                      ${intro}
                    </p>
                  `
                  : ""
              }

              <div
                style="
                  margin-top:24px;
                "
              >
                ${content}
              </div>

            </td>
          </tr>

          ${getJharJeevanEmailFooter()}

        </table>

      </td>
    </tr>

  </table>

</body>
</html>
`;
}

function getEmailButton({
  href,
  label,
  accent = "#e11d2e",
}) {

  return `
    <table
      role="presentation"
      cellpadding="0"
      cellspacing="0"
      border="0"
      align="center"
      style="margin:26px auto;"
    >
      <tr>
        <td
          align="center"
          style="
            border-radius:12px;
            background:${accent};
          "
        >
          <a
            href="${escapeEmailHtml(href)}"
            style="
              display:inline-block;
              padding:14px 24px;
              color:#ffffff;
              font-family:Arial,Helvetica,sans-serif;
              font-size:14px;
              font-weight:700;
              line-height:1;
              text-decoration:none;
              border-radius:12px;
            "
          >
            ${escapeEmailHtml(label)}
          </a>
        </td>
      </tr>
    </table>
  `;
}

function getEmailInfoCard(rows) {

  return `
    <table
      role="presentation"
      width="100%"
      cellpadding="0"
      cellspacing="0"
      border="0"
      style="
        width:100%;
        background:#f8fafc;
        border:1px solid #edf0f4;
        border-radius:14px;
      "
    >
      ${rows.map(row => `
        <tr>

          <td
            style="
              padding:11px 14px;
              width:38%;
              color:#667085;
              font-family:Arial,Helvetica,sans-serif;
              font-size:12px;
              font-weight:700;
              vertical-align:top;
              border-bottom:1px solid #edf0f4;
            "
          >
            ${escapeEmailHtml(row.label)}
          </td>

          <td
            style="
              padding:11px 14px;
              color:#172238;
              font-family:Arial,Helvetica,sans-serif;
              font-size:12px;
              font-weight:600;
              vertical-align:top;
              border-bottom:1px solid #edf0f4;
            "
          >
            ${row.value}
          </td>

        </tr>
      `).join("")}
    </table>
  `;
}

/* -------------------- CLIENT AUTH ROUTES -------------------- */

app.post("/api/client/register", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");
    const phone = String(req.body.phone || "").trim();
    const bloodGroup = String(req.body.bloodGroup || "").trim().toUpperCase();
    const location = String(req.body.location || "").trim();

    if (name.length < 2) {
      return res.status(400).json({
        success: false,
        message: "Name must be at least 2 characters",
      });
    }

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Valid email is required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    if (phone && !/^\d{10}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        message: "Phone number must contain exactly 10 digits",
      });
    }

    if (bloodGroup && !BLOOD_GROUPS.includes(bloodGroup)) {
      return res.status(400).json({
        success: false,
        message: "Invalid blood group",
      });
    }

    const { data: existing, error: existingError } = await supabase
      .from("client_users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingError) throw existingError;

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const { data: client, error } = await supabase
      .from("client_users")
      .insert({
        name,
        email,
        password_hash: passwordHash,
        phone: phone || null,
        blood_group: bloodGroup || null,
        location: location || null,
      })
      .select("*")
      .single();

    if (error) throw error;

    /*
     * Registration succeeded.
     * Notification/email failures must NEVER undo
     * a successfully-created account.
     */

    await Promise.allSettled([
      createClientNotification({
        recipientId: client.id,
        type: "account_created",
        title: "Welcome to JharJeevan â¤ï¸",
        message:
          "Your client account has been created successfully.",
        data: {
          clientId: client.id,
        },
      }),

      createAdminNotification({
        type: "client_registered",
        title: "New client registered",
        message:
          `${client.name} has created a new JharJeevan client account.`,
        data: {
          clientId: client.id,
          email: client.email,
        },
      }),

      sendClientWelcomeEmail(client),

      sendNewClientAdminEmail(client),
    ]);

    const token = jwt.sign(
      {
        role: "client",
        id: client.id,
        email: client.email,
        name: client.name,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(201).json({
      success: true,
      token,
      client: publicClient(client),
      message: "Account created successfully",
    });
  } catch (error) {
    console.error("Client registration error:", error);

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server error during registration",
    });
  }
});

app.post("/api/client/login", async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const { data: client, error } = await supabase
      .from("client_users")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    if (error) throw error;

    if (
      !client ||
      !(await bcrypt.compare(password, client.password_hash))
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (!client.is_active) {
      return res.status(403).json({
        success: false,
        message: "This account has been disabled",
      });
    }

    const now = new Date().toISOString();

    const { data: updatedClient, error: updateError } = await supabase
      .from("client_users")
      .update({ last_login_at: now })
      .eq("id", client.id)
      .select("*")
      .single();

    if (updateError) throw updateError;

    const token = jwt.sign(
      {
        role: "client",
        id: updatedClient.id,
        email: updatedClient.email,
        name: updatedClient.name,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      success: true,
      token,
      client: publicClient(updatedClient),
      message: "Login successful",
    });
  } catch (error) {
    console.error("Client login error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error during login",
    });
  }
});

app.get("/api/client/verify", verifyClient, async (req, res) => {
  try {
    const { data: client, error } = await supabase
      .from("client_users")
      .select("id,name,email,phone,blood_group,location,is_active,last_login_at,created_at,updated_at")
      .eq("id", req.client.id)
      .maybeSingle();

    if (error) throw error;

    if (!client || !client.is_active) {
      return res.status(401).json({
        success: false,
        message: "Client account not found or inactive",
      });
    }

    return res.json({
      success: true,
      client: publicClient(client),
      message: "Token is valid",
    });
  } catch (error) {
    console.error("Client verify error:", error);

    return res.status(500).json({
      success: false,
      message: "Error verifying client token",
    });
  }
});

app.get("/api/client/profile", verifyClient, async (req, res) => {
  try {
    const { data: client, error } = await supabase
      .from("client_users")
      .select("id,name,email,phone,blood_group,location,is_active,last_login_at,created_at,updated_at")
      .eq("id", req.client.id)
      .maybeSingle();

    if (error) throw error;

    if (!client || !client.is_active) {
      return res.status(404).json({
        success: false,
        message: "Client account not found",
      });
    }

    return res.json({
      success: true,
      client: publicClient(client),
    });
  } catch (error) {
    console.error("Client profile error:", error);

    return res.status(500).json({
      success: false,
      message: "Error loading client profile",
    });
  }
});
/* -------------------- INVENTORY -------------------- */
app.get("/api/inventory", async (_req, res) => {
  try {
    const [{ data: donors, error: donorError }, { data: approved, error: requestError }] = await Promise.all([
      supabase.from("donors").select("blood_group"),
      supabase.from("blood_requests").select("blood_group,units_required").eq("status", "Approved"),
    ]);
    if (donorError) throw donorError;
    if (requestError) throw requestError;

    const inventory = Object.fromEntries(BLOOD_GROUPS.map((bg) => [bg, 0]));
    for (const donor of donors || []) inventory[donor.blood_group] += 1;
    for (const request of approved || []) inventory[request.blood_group] = Math.max(0, inventory[request.blood_group] - Number(request.units_required || 0));
    return res.json(inventory);
  } catch (error) {
    console.error("Inventory error:", error);
    return res.status(500).json({ success: false, message: "Error fetching inventory" });
  }
});

/* -------------------- DONORS -------------------- */
app.get("/api/donors", verifyAdmin, async (req, res) => {
  try {
    const { bloodGroup, isAvailable, search } = req.query;
    let query = supabase.from("donors").select("*").order("created_at", { ascending: false });
    if (bloodGroup && validBloodGroup(bloodGroup)) query = query.eq("blood_group", bloodGroup);
    if (isAvailable !== undefined) query = query.eq("is_available", isAvailable === "true");
    if (search) {
      const safe = sanitizeSearch(search);
      query = query.or(`name.ilike.%${safe}%,phone.ilike.%${safe}%,location.ilike.%${safe}%`);
    }
    const { data, error } = await query;
    if (error) throw error;
    return res.json({ success: true, donors: (data || []).map(publicDonor) });
  } catch (error) {
    console.error("Fetch donors error:", error);
    return res.status(500).json({ success: false, message: "Error fetching donors" });
  }
});

app.post("/api/donors", async (req, res) => {
  try {
        const donorEmail = normalizeEmail(req.body.email);
const { name, age, bloodGroup, phone, email, location, lastDonationDate } = req.body;
    const numericAge = Number(age);
    if (!name || !numericAge || !bloodGroup || !phone || !email || !location) {
      return res.status(400).json({ success: false, message: "Name, age, blood group, phone, email and location are required" });
    }
    if (numericAge < 18 || numericAge > 65) return res.status(400).json({ success: false, message: "Age must be between 18 and 65 years" });
    if (!validBloodGroup(bloodGroup)) return res.status(400).json({ success: false, message: "Invalid blood group" });
    if (!/^\d{10}$/.test(String(phone))) return res.status(400).json({ success: false, message: "Phone number must contain exactly 10 digits" });

    let lastDonation = null;
    if (lastDonationDate) {
      const parsed = parseDate(lastDonationDate);
      if (!parsed) return res.status(400).json({ success: false, message: "Invalid last donation date" });
      const daysSinceDonation = Math.floor((Date.now() - parsed.getTime()) / 86400000);
      if (daysSinceDonation < 90) return res.status(400).json({ success: false, message: `Donors can only donate every 90 days. Last donation was ${daysSinceDonation} days ago.` });
      lastDonation = parsed.toISOString();
    }

    const row = {
      name: String(name).trim(), age: numericAge, blood_group: bloodGroup,
      phone: String(phone).trim(), email: donorEmail,
      location: String(location).trim(), last_donation_date: lastDonation,
      is_available: true,
    };

    const { data: donor, error } = await supabase.from("donors").insert(row).select("*").single();
    if (error) {
      if (error.code === "23505") return res.status(400).json({ success: false, message: "A donor with this phone number already exists" });
      throw error;
    }

    await sendEmail({
      to: donor.email,
      subject: "Thank You for Registering as a Blood Donor - JharJeevan",
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px">
        <h2 style="color:#c0392b">Dear ${donor.name},</h2>
        <p>Thank you for registering as a blood donor with <strong>JharJeevan</strong>.</p>
        <p>Your donor registration has been successfully received.</p>
        <ul>
          <li><strong>Blood Group:</strong> ${donor.blood_group}</li>
          <li><strong>Location:</strong> ${donor.location}</li>
          <li><strong>Phone:</strong> ${donor.phone}</li>
        </ul>
        <p>Your donation can help save lives.</p>
      </div>`,
    });

    await sendAdminNotification(
      "New Blood Donor Registered - JharJeevan",
      `<p>A new donor has registered.</p>
       <ul>
         <li><strong>Name:</strong> ${donor.name}</li>
         <li><strong>Blood Group:</strong> ${donor.blood_group}</li>
         <li><strong>Phone:</strong> ${donor.phone}</li>
         <li><strong>Email:</strong> ${donor.email}</li>
         <li><strong>Location:</strong> ${donor.location}</li>
       </ul>`
    );

    return res.status(201).json({ success: true, message: "Donor registered successfully", donor: publicDonor(donor) });
  } catch (error) {
    console.error("Create donor error:", error);
    return res.status(500).json({ success: false, message: "Server error while registering donor", debug: process.env.NODE_ENV === "development" ? error.message : undefined });
  }
});

app.put("/api/donors/:id", verifyAdmin, async (req, res) => {
  try {
    if (!validUUID(req.params.id)) return res.status(400).json({ success: false, message: "Invalid donor ID" });
    const allowed = ["name", "age", "bloodGroup", "phone", "email", "location", "lastDonationDate", "isAvailable"];
    const update = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        const dbKey = { bloodGroup: "blood_group", lastDonationDate: "last_donation_date", isAvailable: "is_available" }[key] || key;
        update[dbKey] = key === "email" ? normalizeEmail(req.body[key]) || null : req.body[key];
      }
    }
    if (update.blood_group && !validBloodGroup(update.blood_group)) return res.status(400).json({ success: false, message: "Invalid blood group" });
    if (update.age !== undefined && (Number(update.age) < 18 || Number(update.age) > 65)) return res.status(400).json({ success: false, message: "Age must be between 18 and 65 years" });
    if (update.last_donation_date) {
      const date = parseDate(update.last_donation_date);
      if (!date) return res.status(400).json({ success: false, message: "Invalid last donation date" });
      update.last_donation_date = date.toISOString();
    }

    const { data: donor, error } = await supabase.from("donors").update(update).eq("id", req.params.id).select("*").maybeSingle();
    if (error) throw error;
    if (!donor) return res.status(404).json({ success: false, message: "Donor not found" });
    return res.json({ success: true, message: "Donor updated successfully", donor: publicDonor(donor) });
  } catch (error) {
    console.error("Update donor error:", error);
    return res.status(500).json({ success: false, message: "Error updating donor" });
  }
});

app.delete("/api/donors/:id", verifyAdmin, async (req, res) => {
  try {
    if (!validUUID(req.params.id)) return res.status(400).json({ success: false, message: "Invalid donor ID" });
    const { data, error } = await supabase.from("donors").delete().eq("id", req.params.id).select("id").maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, message: "Donor not found" });
    return res.json({ success: true, message: "Donor deleted successfully" });
  } catch (error) {
    console.error("Delete donor error:", error);
    return res.status(500).json({ success: false, message: "Error deleting donor" });
  }
});

app.get("/api/donors/:id", verifyAdmin, async (req, res) => {
  try {
    if (!validUUID(req.params.id)) return res.status(400).json({ success: false, message: "Invalid donor ID" });
    const { data, error } = await supabase.from("donors").select("*").eq("id", req.params.id).maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, message: "Donor not found" });
    return res.json({ success: true, donor: publicDonor(data) });
  } catch (error) {
    console.error("Get donor error:", error);
    return res.status(500).json({ success: false, message: "Error fetching donor" });
  }
});

/* -------------------- BLOOD REQUESTS -------------------- */
app.get("/api/requests", verifyAdmin, async (req, res) => {
  try {
    const { status, bloodGroup, priority } = req.query;
    let query = supabase.from("blood_requests").select("*").order("priority_rank", { ascending: true }).order("created_at", { ascending: false });
    if (status && REQUEST_STATUSES.includes(status)) query = query.eq("status", status);
    if (bloodGroup && validBloodGroup(bloodGroup)) query = query.eq("blood_group", bloodGroup);
    if (priority && ["Normal", "Urgent"].includes(priority)) query = query.eq("priority", priority);
    const { data, error } = await query;
    if (error) throw error;
    return res.json({ success: true, requests: (data || []).map(publicRequest) });
  } catch (error) {
    console.error("Fetch requests error:", error);
    return res.status(500).json({ success: false, message: "Error fetching requests" });
  }
});

app.patch("/api/requests/:id/approve", verifyAdmin, async (req, res) => {
  return updateRequestStatus(req, res, "Approved");
});

async function updateRequestStatus(req, res, forcedStatus = null) {
  try {
    if (!validUUID(req.params.id)) return res.status(400).json({ success: false, message: "Invalid request ID" });
    const status = forcedStatus || req.body.status;
    const notes = req.body.notes;
    if (!REQUEST_STATUSES.includes(status)) return res.status(400).json({ success: false, message: "Invalid status value" });

    const { data: existing, error: fetchError } = await supabase.from("blood_requests").select("*").eq("id", req.params.id).maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) return res.status(404).json({ success: false, message: "Blood request not found" });

    // Prevent accidental repeated approvals and make status transitions explicit.
    if (forcedStatus === "Approved" && existing.status !== "Pending") {
      return res.status(409).json({ success: false, message: `Request is already ${existing.status}` });
    }

    const update = { status };
    if (notes !== undefined) update.notes = String(notes);
    if (status === "Approved") {
      update.approved_by = req.admin.email;
      update.approved_at = new Date().toISOString();
    }

    let query = supabase.from("blood_requests").update(update).eq("id", req.params.id);
    if (forcedStatus === "Approved") query = query.eq("status", "Pending");
    const { data: request, error } = await query.select("*").maybeSingle();
    if (error) throw error;
    if (!request) return res.status(409).json({ success: false, message: "Request was changed by another admin. Refresh and try again." });

    // ==================== REQUEST STATUS NOTIFICATION ====================

    let subject = "";
    let message = "";

    if (status === "Approved") {
      subject = "Blood Request Approved - JharJeevan";
      message = `
        <h2 style="color:#16803c">Blood Request Approved</h2>
        <p>Dear <strong>${request.requester_name}</strong>,</p>
        <p>Your blood request has been approved by JharJeevan.</p>
        <p>A suitable donor can now be contacted regarding your request.</p>
        <p><strong>Blood Group:</strong> ${request.blood_group}</p>
        <p><strong>Units:</strong> ${request.units_required}</p>
      `;
    }

    if (status === "Rejected") {
      subject = "Blood Request Update - JharJeevan";
      message = `
        <h2 style="color:#c0392b">Blood Request Status Update</h2>
        <p>Dear <strong>${request.requester_name}</strong>,</p>
        <p>Your blood request could not be approved at this time.</p>
        <p>Please contact JharJeevan if you still require assistance.</p>
      `;
    }

    if (status === "Completed") {
      subject = "Blood Request Completed - JharJeevan";
      message = `
        <h2 style="color:#16803c">Blood Request Completed</h2>
        <p>Dear <strong>${request.requester_name}</strong>,</p>
        <p>Your blood request has been marked as completed.</p>
        <p>Thank you for using JharJeevan.</p>
      `;
    }

    if (message && request.requester_email) {
      await sendEmail({
        to: request.requester_email,
        subject,
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px">${message}</div>`,
      });
    }

    return res.json({ success: true, message: `Request ${status.toLowerCase()} successfully`, request: publicRequest(request) });
  } catch (error) {
    console.error("Update request error:", error);
    return res.status(500).json({ success: false, message: "Error updating request status" });
  }
}

app.post("/api/requests", async (req, res) => {
  try {
    const data = { ...req.body };
    if (!data.requesterName && data.name) data.requesterName = data.name;

    const requiredFields = ["patientName", "bloodGroup", "unitsRequired", "hospitalName", "hospitalAddress", "city", "requiredDate", "requesterPhone"];
    for (const field of requiredFields) {
      if (data[field] === undefined || data[field] === null || String(data[field]).trim() === "") return res.status(400).json({ success: false, message: `Missing required field: ${field}` });
    }
    if (!data.requesterName) {
      return res.status(400).json({
        success: false,
        message: "Missing required field: requesterName or name"
      });
    }

    const requesterEmail = normalizeEmail(data.requesterEmail);

    if (!requesterEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(requesterEmail)) {
      return res.status(400).json({
        success: false,
        message: "A valid requester email address is required"
      });
    }
    if (!/^\d{10}$/.test(String(data.requesterPhone))) return res.status(400).json({ success: false, message: "Valid phone number is required (10 digits)" });
    if (!validBloodGroup(data.bloodGroup)) return res.status(400).json({ success: false, message: "Invalid blood group" });

    const units = Number(data.unitsRequired);
    if (!Number.isInteger(units) || units < 1 || units > 10) return res.status(400).json({ success: false, message: "Units must be between 1 and 10" });
    const requiredDate = parseDate(data.requiredDate);
    if (!requiredDate) return res.status(400).json({ success: false, message: "Invalid required date format" });

    const priority = Math.ceil((requiredDate.getTime() - Date.now()) / 86400000) <= 1 ? "Urgent" : "Normal";
    const row = {
      patient_name: String(data.patientName).trim(), blood_group: data.bloodGroup,
      units_required: units, hospital_name: String(data.hospitalName).trim(),
      hospital_address: String(data.hospitalAddress).trim(), city: String(data.city).trim(),
      required_date: requiredDate.toISOString(), requester_name: String(data.requesterName).trim(),
      requester_phone: String(data.requesterPhone).trim(), requester_email: requesterEmail,
      priority, priority_rank: priority === "Urgent" ? 0 : 1, status: "Pending",
    };

    const { data: request, error } = await supabase.from("blood_requests").insert(row).select("*").single();
    if (error) throw error;

    // ==================== BLOOD REQUEST NOTIFICATIONS ====================

    // Urgent request -> matching available donors
    if (priority === "Urgent" && transporter) {
      const { data: donors, error: donorError } = await supabase
        .from("donors")
        .select("name,email")
        .eq("blood_group", data.bloodGroup)
        .eq("is_available", true)
        .not("email", "is", null)
        .limit(10);

      if (donorError) {
        console.error("Urgent donor lookup failed:", donorError.message);
      } else if (donors?.length) {
        const results = await Promise.allSettled(
          donors.map((donor) =>
            sendEmail({
              to: donor.email,
              subject: "URGENT: Blood Donation Needed - JharJeevan",
              html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px">
                <h2 style="color:#c0392b">Urgent Blood Donation Request</h2>
                <p>Dear <strong>${donor.name}</strong>,</p>
                <p>An urgent request for <strong>${data.bloodGroup}</strong> blood has been raised.</p>
                <ul>
                  <li><strong>Patient:</strong> ${data.patientName}</li>
                  <li><strong>Hospital:</strong> ${data.hospitalName}</li>
                  <li><strong>Location:</strong> ${data.city}</li>
                  <li><strong>Required by:</strong> ${requiredDate.toLocaleDateString()}</li>
                  <li><strong>Units:</strong> ${units}</li>
                </ul>
                <p><strong>Requester contact:</strong> ${data.requesterPhone}</p>
                <p>Please contact the requester if you are available to donate.</p>
              </div>`,
            })
          )
        );

        console.log(
          "ðŸš¨ Urgent donor notifications:",
          results.filter((r) => r.status === "fulfilled").length,
          "sent,",
          results.filter((r) => r.status === "rejected").length,
          "failed"
        );
      }
    }

    // Requester -> confirmation
    await sendEmail({
      to: request.requester_email,
      subject: "Blood Request Received - JharJeevan",
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px">
        <h2 style="color:#c0392b">Blood Request Confirmation</h2>
        <p>Dear <strong>${request.requester_name}</strong>,</p>
        <p>Your blood request has been submitted successfully.</p>
        <ul>
          <li><strong>Request ID:</strong> ${request.id.slice(-6)}</li>
          <li><strong>Status:</strong> ${request.status}</li>
          <li><strong>Priority:</strong> ${request.priority}</li>
          <li><strong>Blood Group:</strong> ${request.blood_group}</li>
          <li><strong>Units:</strong> ${request.units_required}</li>
          <li><strong>Hospital:</strong> ${request.hospital_name}</li>
        </ul>
        <p>We will notify you when the status changes.</p>
      </div>`,
    });

    // Request -> admin
    await sendAdminNotification(
      priority === "Urgent"
        ? "URGENT Blood Request - JharJeevan"
        : "New Blood Request - JharJeevan",
      `<h3>${priority === "Urgent" ? "URGENT BLOOD REQUEST" : "New blood request received"}</h3>
       <ul>
         <li><strong>Patient:</strong> ${request.patient_name}</li>
         <li><strong>Blood Group:</strong> ${request.blood_group}</li>
         <li><strong>Units:</strong> ${request.units_required}</li>
         <li><strong>Priority:</strong> ${request.priority}</li>
         <li><strong>Hospital:</strong> ${request.hospital_name}</li>
         <li><strong>City:</strong> ${request.city}</li>
         <li><strong>Requester:</strong> ${request.requester_name}</li>
         <li><strong>Phone:</strong> ${request.requester_phone}</li>
         <li><strong>Email:</strong> ${request.requester_email}</li>
       </ul>`
    );

    return res.status(201).json({ success: true, message: "Blood request submitted successfully", request: publicRequest(request) });
  } catch (error) {
    console.error("Create request error:", error);
    return res.status(500).json({ success: false, message: "Error submitting request" });
  }
});

app.put("/api/requests/:id", verifyAdmin, async (req, res) => updateRequestStatus(req, res));

app.delete("/api/requests/:id", verifyAdmin, async (req, res) => {
  try {
    if (!validUUID(req.params.id)) return res.status(400).json({ success: false, message: "Invalid request ID" });
    const { data, error } = await supabase.from("blood_requests").delete().eq("id", req.params.id).select("id").maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, message: "Request not found" });
    return res.json({ success: true, message: "Request deleted successfully" });
  } catch (error) {
    console.error("Delete request error:", error);
    return res.status(500).json({ success: false, message: "Error deleting request" });
  }
});

app.get("/api/requests/blood/:bloodGroup", async (req, res) => {
  try {
    const bloodGroup = req.params.bloodGroup;
    if (!validBloodGroup(bloodGroup)) return res.status(400).json({ success: false, message: "Invalid blood group" });
    const { data, error } = await supabase.from("blood_requests").select("*").eq("blood_group", bloodGroup).eq("status", "Pending").order("priority_rank", { ascending: true }).order("created_at", { ascending: true }).limit(20);
    if (error) throw error;
    return res.json({ success: true, requests: (data || []).map(publicRequest) });
  } catch (error) {
    console.error("Public request lookup error:", error);
    return res.status(500).json({ success: false, message: "Error fetching requests" });
  }
});

/* -------------------- STATISTICS -------------------- */
app.get("/api/stats", verifyAdmin, async (_req, res) => {
  try {
    const [donorsResult, requestsResult] = await Promise.all([
      supabase.from("donors").select("id,name,blood_group,created_at,is_available"),
      supabase.from("blood_requests").select("id,patient_name,blood_group,status,priority,created_at,hospital_name,city,units_required"),
    ]);
    if (donorsResult.error) throw donorsResult.error;
    if (requestsResult.error) throw requestsResult.error;

    const donors = donorsResult.data || [];
    const requests = requestsResult.data || [];
    const donorsByBloodGroup = Object.fromEntries(BLOOD_GROUPS.map((bg) => [bg, 0]));
    const requestsByBloodGroup = Object.fromEntries(BLOOD_GROUPS.map((bg) => [bg, 0]));
    donors.forEach((d) => { donorsByBloodGroup[d.blood_group] += 1; });
    requests.forEach((r) => { if (r.status === "Pending") requestsByBloodGroup[r.blood_group] += 1; });

    return res.json({
      success: true,
      stats: {
        totalDonors: donors.length,
        activeDonors: donors.filter((d) => d.is_available).length,
        totalRequests: requests.length,
        pendingRequests: requests.filter((r) => r.status === "Pending").length,
        urgentRequests: requests.filter((r) => r.priority === "Urgent" && r.status === "Pending").length,
        approvedRequests: requests.filter((r) => r.status === "Approved").length,
        completedRequests: requests.filter((r) => r.status === "Completed").length,
        donorsByBloodGroup,
        requestsByBloodGroup,
        recentDonors: donors.sort((a,b) => new Date(b.created_at) - new Date(a.created_at)).slice(0,5).map(publicDonor),
        recentRequests: requests.sort((a,b) => new Date(b.created_at) - new Date(a.created_at)).slice(0,5).map(publicRequest),
      },
    });
  } catch (error) {
    console.error("Stats error:", error);
    return res.status(500).json({ success: false, message: "Error fetching statistics" });
  }
});

app.get("/api/search/donors", verifyAdmin, async (req, res) => {
  try {
    const queryText = sanitizeSearch(req.query.query);
    if (queryText.length < 2) return res.status(400).json({ success: false, message: "Search query must be at least 2 characters" });
    const { data, error } = await supabase.from("donors").select("*").or(`name.ilike.%${queryText}%,phone.ilike.%${queryText}%,blood_group.ilike.%${queryText}%,location.ilike.%${queryText}%`).limit(20);
    if (error) throw error;
    return res.json({ success: true, donors: (data || []).map(publicDonor) });
  } catch (error) {
    console.error("Search error:", error);
    return res.status(500).json({ success: false, message: "Error searching donors" });
  }
});

/* -------------------- HEALTH -------------------- */
app.get("/api/health", async (_req, res) => {
  try {
    const { error } = await supabase.from("admins").select("id").limit(1);
    return res.json({
      success: true,
      status: error ? "DEGRADED" : "OK",
      timestamp: new Date().toISOString(),
      database: error ? "Error" : "Supabase Connected",
      supabase: error ? error.message : "Connected",
      email: transporter ? "Configured" : "Not configured",
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || "development",
    });
  } catch (error) {
    return res.status(500).json({ success: false, status: "ERROR", message: error.message });
  }
});

/* -------------------- AI -------------------- */
try {
  const { initAIRoutes } = require("./server/routes/aiRoutes");
  app.use("/api/ai", initAIRoutes(supabase, verifyAdmin));
  console.log("Ã¢Å“â€¦ Supabase AI routes initialized");
} catch (error) {
  console.error("Ã¢ÂÅ’ Failed to load AI routes:", error);
}

app.get("/", (_req, res) => res.sendFile(path.join(PUBLIC_DIR, "index.html")));

app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ success: false, message: "Something went wrong on the server" });
});

app.use((req, res) => res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` }));

module.exports = app;

async function startServer() {
  try {
    await initAdmin();
    app.listen(PORT, () => {
      console.log("\n" + "=".repeat(60));
      console.log("Ã°Å¸Â©Â¸ Jhar Jeevan Blood Bank - Supabase Edition");
      console.log("=".repeat(60));
      console.log(`Ã°Å¸â€œÂ¡ http://localhost:${PORT}`);
      console.log(`Ã°Å¸â€™Å¡ http://localhost:${PORT}/api/health`);
      console.log("Ã°Å¸â€”â€žÃ¯Â¸Â Database: Supabase PostgreSQL");
      console.log("Ã°Å¸â€Â Admin auth: server-side JWT + Supabase admins table");
      console.log("=".repeat(60) + "\n");
    });
  } catch (error) {
    console.error("Ã¢ÂÅ’ Failed to start server:", error);
    process.exit(1);
  }
}

if (require.main === module) startServer();














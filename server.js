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
    console.error(`ÃƒÂ¢Ã‚ÂÃ…â€™ Missing required environment variable: ${name}`);
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

/* ============================================================
   JHARJEEVAN — EARLY NOTIFICATION ROUTES
   These MUST execute before the global 404 middleware.
   ============================================================ */

app.patch(
  "/api/client/notifications/:id/read",
  verifyClient,
  async (req, res) => {
    try {
      const clientId = req.client?.id;
      const notificationId = req.params.id;

      if (!clientId) {
        return res.status(401).json({
          success: false,
          message: "Client authentication is required."
        });
      }

      if (!notificationId) {
        return res.status(400).json({
          success: false,
          message: "Notification ID is required."
        });
      }

      const { data, error } = await supabase
        .from("notifications")
        .update({
          is_read: true,
          read_at: new Date().toISOString()
        })
        .eq("id", notificationId)
        .eq("recipient_type", "client")
        .eq("recipient_id", clientId)
        .select("*")
        .maybeSingle();

      if (error) {
        console.error(
          "Notification read database error:",
          error
        );

        return res.status(500).json({
          success: false,
          message: "Unable to update notification."
        });
      }

      if (!data) {
        return res.status(404).json({
          success: false,
          message: "Notification not found."
        });
      }

      return res.json({
        success: true,
        message: "Notification marked as read.",
        notification: data
      });

    } catch (error) {

      console.error(
        "Notification read route error:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Unable to update notification."
      });
    }
  }
);

app.patch(
  "/api/client/notifications/read-all",
  verifyClient,
  async (req, res) => {
    try {

      const clientId = req.client?.id;

      if (!clientId) {
        return res.status(401).json({
          success: false,
          message: "Client authentication is required."
        });
      }

      const { error } = await supabase
        .from("notifications")
        .update({
          is_read: true,
          read_at: new Date().toISOString()
        })
        .eq("recipient_type", "client")
        .eq("recipient_id", clientId)
        .eq("is_read", false);

      if (error) {

        console.error(
          "Mark-all-read database error:",
          error
        );

        return res.status(500).json({
          success: false,
          message: "Unable to update notifications."
        });
      }

      return res.json({
        success: true,
        message: "All notifications marked as read."
      });

    } catch (error) {

      console.error(
        "Mark-all-read route error:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Unable to update notifications."
      });
    }
  }
);

/* ============================================================
   END EARLY NOTIFICATION ROUTES
   ============================================================ */


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
    if (error) console.log("ÃƒÂ¢Ã‚ÂÃ…â€™ Email config error:", error.message);
    else console.log("ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ Email server ready");
  });
} else {
  console.log("ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â Email notifications disabled");
}

/* -------------------- EMAIL HELPERS -------------------- */

async function sendEmail(options) {
  if (!transporter) {
    console.log("Ã¢Å¡Â Ã¯Â¸Â Email skipped: SMTP is not configured");
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
    console.error(`Ã¢ÂÅ’ Email failed: ${options.subject || "(no subject)"} - ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function sendAdminNotification(subject, html) {
  const adminEmail = normalizeEmail(process.env.ADMIN_EMAIL);

  if (!adminEmail) {
    console.log("Ã¢Å¡Â Ã¯Â¸Â Admin notification skipped: ADMIN_EMAIL is not configured");
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
            <h2 style="color:#c0392b">Welcome back to JharJeevan Ã¢ÂÂ¤Ã¯Â¸Â</h2>
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
      subject: "Welcome to JharJeevan Newsletter Ã¢ÂÂ¤Ã¯Â¸Â",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px">
          <div style="text-align:center">
            <h2 style="color:#c0392b">Welcome to JharJeevan Ã¢ÂÂ¤Ã¯Â¸Â</h2>
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
      "Ã°Å¸â€œÂ° New Newsletter Subscriber - JharJeevan",
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
    console.log(`ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ Admin account ready: ${email}`);
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
  console.log(`ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ Admin account created: ${email}`);
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

    console.log(`ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â Email not configured. Reset URL for ${email}: ${resetUrl}`);
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

    // Always expose the frontend contract as camelCase.
    bloodGroup:
      client.blood_group ??
      client.bloodGroup ??
      null,

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
        â¤ï¸ Welcome to the JharJeevan network
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
    escapeEmailHtml(client.email || "â€”");

  const safePhone =
    escapeEmailHtml(client.phone || "â€”");

  const safeBloodGroup =
    escapeEmailHtml(client.blood_group || "â€”");

  const safeLocation =
    escapeEmailHtml(client.location || "â€”");

  const safeName =
    escapeEmailHtml(client.name || "â€”");

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
    subject: "New Client Registration â€” JharJeevan Blood Bank",
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
        ðŸ”’ Secure password reset
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
          Â© ${getJharJeevanEmailYear()} JharJeevan Blood Bank
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
                    â™¥
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
        title: "Welcome to JharJeevan Ã¢ÂÂ¤Ã¯Â¸Â",
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

/* ============================================================
   CLIENT REQUEST HISTORY
   ============================================================ */

app.get("/api/client/requests", verifyClient, async (req, res) => {
  try {
    const clientEmail = normalizeEmail(req.client.email);

    if (!clientEmail) {
      return res.status(401).json({
        success: false,
        message: "Client email is unavailable",
      });
    }

    const { data, error } = await supabase
      .from("blood_requests")
      .select("*")
      .eq("requester_email", clientEmail)
      .order("priority_rank", {
        ascending: true,
      })
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      throw error;
    }

    return res.json({
      success: true,
      requests: (data || []).map(publicRequest),
      count: (data || []).length,
    });

  } catch (error) {

    console.error(
      "Client request history error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to load your request history",
    });
  }
});
app.get("/api/client/verify", verifyClient, async (req, res) => {
  try {
    const { data: client, error } = await supabase
      .from("client_users")
      .select(
        "id,name,email,phone,blood_group,location,is_active,last_login_at,created_at,updated_at"
      )
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


/* -------------------- CLIENT NOTIFICATIONS -------------------- */

/* -------------------- CLIENT DONOR CENTER -------------------- */

app.get("/api/client/donor", verifyClient, async (req, res) => {
  try {
    const clientId = req.client?.id;

    if (!clientId) {
      return res.status(401).json({
        success: false,
        message: "Client authentication is required",
      });
    }

    const { data: client, error: clientError } = await supabase
      .from("client_users")
      .select("id,name,email,phone,blood_group,location")
      .eq("id", clientId)
      .maybeSingle();

    if (clientError) throw clientError;

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client profile not found",
      });
    }

    const clientEmail = normalizeEmail(client.email);

    const { data: donor, error: donorError } = await supabase
      .from("donors")
      .select("*")
      .eq("email", clientEmail)
      .maybeSingle();

    if (donorError) throw donorError;

    return res.json({
      success: true,
      client: {
        id: client.id,
        name: client.name,
        email: client.email,
        phone: client.phone,
        blood_group: client.blood_group,
        location: client.location,
      },
      donor: donor ? publicDonor(donor) : null,
    });

  } catch (error) {
    console.error("Client donor profile error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load donor profile",
    });
  }
});

app.post("/api/client/donor", verifyClient, async (req, res) => {

  try {

    console.log("");
    console.log("============================================================");
    console.log("[CLIENT DONOR] REGISTRATION REQUEST");
    console.log("============================================================");

    // ----------------------------------------------------------
    // AUTH
    // ----------------------------------------------------------

    const clientId = req.client?.id;

    if (!clientId) {

      return res.status(401).json({
        success: false,
        message: "Your client session has expired. Please log in again.",
      });

    }

    // ----------------------------------------------------------
    // INPUT
    // ----------------------------------------------------------

    const age = Number(req.body?.age);

    const bloodGroup =
      String(req.body?.bloodGroup || "")
        .trim()
        .toUpperCase();

    const phone =
      String(req.body?.phone || "")
        .replace(/\D/g, "");

    const location =
      String(req.body?.location || "")
        .trim();

    const lastDonationDate =
      req.body?.lastDonationDate
        ? String(req.body.lastDonationDate).trim()
        : "";

    console.log("[CLIENT DONOR] Input:", {
      clientId,
      age,
      bloodGroup,
      phone,
      location,
      lastDonationDate,
    });

    // ----------------------------------------------------------
    // VALIDATION
    // ----------------------------------------------------------

    const allowedBloodGroups = [
      "A+",
      "A-",
      "B+",
      "B-",
      "AB+",
      "AB-",
      "O+",
      "O-",
    ];

    if (
      !Number.isInteger(age) ||
      age < 18 ||
      age > 65
    ) {

      return res.status(400).json({
        success: false,
        message: "Age must be between 18 and 65 years.",
      });

    }

    if (!allowedBloodGroups.includes(bloodGroup)) {

      return res.status(400).json({
        success: false,
        message: "Please select a valid blood group.",
      });

    }

    if (!/^\d{10}$/.test(phone)) {

      return res.status(400).json({
        success: false,
        message: "Phone number must contain exactly 10 digits.",
      });

    }

    if (location.length < 2) {

      return res.status(400).json({
        success: false,
        message: "Please enter your city or location.",
      });

    }

    // ----------------------------------------------------------
    // LOAD CLIENT
    // ----------------------------------------------------------

    const {
      data: client,
      error: clientError,
    } = await supabase
      .from("client_users")
      .select("id,name,email,phone,blood_group,location")
      .eq("id", clientId)
      .maybeSingle();

    if (clientError) {

      console.error(
        "[CLIENT DONOR] CLIENT LOOKUP FAILED:",
        clientError
      );

      return res.status(500).json({
        success: false,
        message: "Unable to load your client profile.",
        debug: clientError.message,
        code: clientError.code || null,
        details: clientError.details || null,
        hint: clientError.hint || null,
      });

    }

    if (!client) {

      return res.status(404).json({
        success: false,
        message: "Client profile not found.",
      });

    }

    const donorEmail =
      String(client.email || "")
        .trim()
        .toLowerCase();

    const donorName =
      String(client.name || "JharJeevan Client")
        .trim();

    if (!donorEmail) {

      return res.status(400).json({
        success: false,
        message: "Your account email is unavailable.",
      });

    }

    // ----------------------------------------------------------
    // SAFE EXISTING-DONOR CHECK
    //
    // IMPORTANT:
    // Do NOT use maybeSingle() here.
    // Multiple old rows must not turn into a 500.
    // ----------------------------------------------------------

    // ----------------------------------------------------------
    // DUPLICATE DONOR CHECK
    // Check BOTH email and phone because phone is UNIQUE in donors.
    // ----------------------------------------------------------

    const [
      existingByEmailResult,
      existingByPhoneResult,
    ] = await Promise.all([

      supabase
        .from("donors")
        .select("id,name,email,phone,blood_group,location")
        .eq("email", donorEmail)
        .limit(1),

      supabase
        .from("donors")
        .select("id,name,email,phone,blood_group,location")
        .eq("phone", phone)
        .limit(1),

    ]);

    const existingEmailError =
      existingByEmailResult.error;

    const existingPhoneError =
      existingByPhoneResult.error;

    if (
      existingEmailError ||
      existingPhoneError
    ) {

      console.error(
        "[CLIENT DONOR] DUPLICATE CHECK FAILED"
      );

      console.error(
        "Email check:",
        existingEmailError
      );

      console.error(
        "Phone check:",
        existingPhoneError
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to verify your existing donor profile.",

        debug:
          existingEmailError?.message ||
          existingPhoneError?.message ||
          "Unknown donor lookup error",

        code:
          existingEmailError?.code ||
          existingPhoneError?.code ||
          null,

        details:
          existingEmailError?.details ||
          existingPhoneError?.details ||
          null,

        hint:
          existingEmailError?.hint ||
          existingPhoneError?.hint ||
          null,
      });

    }

    const existingDonorByEmail =
      Array.isArray(existingByEmailResult.data) &&
      existingByEmailResult.data.length > 0
        ? existingByEmailResult.data[0]
        : null;

    const existingDonorByPhone =
      Array.isArray(existingByPhoneResult.data) &&
      existingByPhoneResult.data.length > 0
        ? existingByPhoneResult.data[0]
        : null;

    if (existingDonorByEmail) {

      console.log(
        "[CLIENT DONOR] Existing donor found by email:",
        existingDonorByEmail.id
      );

      return res.status(409).json({
        success: false,
        message:
          "You are already registered as a donor.",
        donor: existingDonorByEmail,
      });

    }

    if (existingDonorByPhone) {

      console.log(
        "[CLIENT DONOR] Existing donor found by phone:",
        existingDonorByPhone.id
      );

      return res.status(409).json({
        success: false,
        message:
          "This phone number is already registered as a donor.",
        donor: existingDonorByPhone,
      });

    }

    // ----------------------------------------------------------
    // LAST DONATION
    // ----------------------------------------------------------

    let lastDonation = null;

    if (lastDonationDate) {

      const parsedDate =
        new Date(lastDonationDate);

      if (
        Number.isNaN(
          parsedDate.getTime()
        )
      ) {

        return res.status(400).json({
          success: false,
          message: "Please enter a valid last donation date.",
        });

      }

      const today =
        new Date();

      const todayOnly =
        new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate()
        );

      const donationOnly =
        new Date(
          parsedDate.getFullYear(),
          parsedDate.getMonth(),
          parsedDate.getDate()
        );

      if (
        donationOnly > todayOnly
      ) {

        return res.status(400).json({
          success: false,
          message: "Last donation date cannot be in the future.",
        });

      }

      const daysSince =
        Math.floor(
          (
            todayOnly.getTime() -
            donationOnly.getTime()
          ) / 86400000
        );

      if (daysSince < 90) {

        const remaining =
          90 - daysSince;

        return res.status(400).json({
          success: false,
          message:
            `You can register after the 90-day waiting period. ${remaining} day${remaining === 1 ? "" : "s"} remaining.`,
        });

      }

      lastDonation =
        `${donationOnly.getFullYear()}-${String(
          donationOnly.getMonth() + 1
        ).padStart(2, "0")}-${String(
          donationOnly.getDate()
        ).padStart(2, "0")}`;

    }

    // ----------------------------------------------------------
    // DONOR ROW
    // ----------------------------------------------------------

    const donorRow = {

      name:
        donorName,

      age:
        age,

      blood_group:
        bloodGroup,

      phone:
        phone,

      email:
        donorEmail,

      location:
        location,

      last_donation_date:
        lastDonation,

      is_available:
        true,

    };

    console.log(
      "[CLIENT DONOR] INSERT ROW:",
      donorRow
    );

    // ----------------------------------------------------------
    // INSERT
    // ----------------------------------------------------------

    const {
      data: donor,
      error: donorInsertError,
    } = await supabase
      .from("donors")
      .insert(donorRow)
      .select("*")
      .single();

    if (donorInsertError) {

      console.error("");
      console.error(
        "============================================================"
      );
      console.error(
        "[CLIENT DONOR] SUPABASE INSERT FAILED"
      );
      console.error(
        "============================================================"
      );
      console.error(
        "message:",
        donorInsertError.message
      );
      console.error(
        "code:",
        donorInsertError.code
      );
      console.error(
        "details:",
        donorInsertError.details
      );
      console.error(
        "hint:",
        donorInsertError.hint
      );
      console.error(
        "full error:",
        donorInsertError
      );
      console.error(
        "============================================================"
      );

      if (
        donorInsertError.code === "23505"
      ) {

        console.error(
          "[CLIENT DONOR] UNIQUE CONSTRAINT VIOLATION"
        );

        return res.status(409).json({
          success: false,
          message:
            "A donor with this phone number or email already exists.",
          code:
            donorInsertError.code,
        });

      }

      return res.status(500).json({

        success: false,

        message:
          "Unable to save your donor profile.",

        debug:
          donorInsertError.message ||
          "Unknown database error",

        code:
          donorInsertError.code ||
          null,

        details:
          donorInsertError.details ||
          null,

        hint:
          donorInsertError.hint ||
          null,

      });

    }

    console.log(
      "[CLIENT DONOR] INSERT SUCCESS:",
      donor?.id
    );

    // ----------------------------------------------------------
    // EMAIL
    //
    // Email failure must NEVER make registration fail.
    // ----------------------------------------------------------

    try {

      if (
        typeof sendEmail === "function"
      ) {

        await sendEmail({

          to:
            donor.email,

          subject:
            "Thank You for Registering as a Blood Donor - JharJeevan",

          html:
            `
              <div
                style="
                  font-family:Arial,sans-serif;
                  max-width:600px;
                  margin:auto;
                  padding:24px;
                  color:#222;
                "
              >

                <h2 style="color:#d71945;">
                  Dear ${donor.name},
                </h2>

                <p>
                  Thank you for registering as a blood donor
                  with <strong>JharJeevan</strong>.
                </p>

                <p>
                  Your donor registration has been
                  successfully received.
                </p>

                <p>
                  <strong>Blood Group:</strong>
                  ${donor.blood_group}
                </p>

                <p>
                  <strong>Location:</strong>
                  ${donor.location}
                </p>

                <p>
                  Your donation can help save lives.
                </p>

              </div>
            `,

        });

      }

    } catch (emailError) {

      console.error(
        "[CLIENT DONOR] EMAIL FAILED:",
        emailError?.message ||
        emailError
      );

    }

    // ----------------------------------------------------------
    // SUCCESS
    // ----------------------------------------------------------

    return res.status(201).json({

      success:
        true,

      message:
        "Donor registration completed successfully.",

      donor:
        donor,

    });

  } catch (error) {

    console.error("");
    console.error(
      "============================================================"
    );
    console.error(
      "[CLIENT DONOR] UNEXPECTED ERROR"
    );
    console.error(
      "============================================================"
    );
    console.error(
      "message:",
      error?.message
    );
    console.error(
      "name:",
      error?.name
    );
    console.error(
      "code:",
      error?.code
    );
    console.error(
      "details:",
      error?.details
    );
    console.error(
      "hint:",
      error?.hint
    );
    console.error(
      "stack:",
      error?.stack
    );
    console.error(
      "============================================================"
    );

    return res.status(500).json({

      success:
        false,

      message:
        error?.message ||
        "Unable to complete donor registration.",

      debug:
        error?.message ||
        null,

      code:
        error?.code ||
        null,

      details:
        error?.details ||
        null,

      hint:
        error?.hint ||
        null,

    });

  }

});

app.get("/api/client/notifications", verifyClient, async (req, res) => {
  try {
    const { data: notifications, error } = await supabase
      .from("notifications")
      .select("id,recipient_type,recipient_id,type,title,message,data,is_read,created_at,read_at")
      .eq("recipient_type", "client")
      .eq("recipient_id", req.client.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Client notifications query error:", error);

      return res.status(500).json({
        success: false,
        message: "Error loading notifications",
        notifications: [],
      });
    }

    return res.json({
      success: true,
      notifications: notifications || [],
    });
  } catch (error) {
    console.error("Client notifications error:", error);

    return res.status(500).json({
      success: false,
      message: "Error loading notifications",
      notifications: [],
    });
  }
});
app.get("/api/client/profile", verifyClient, async (req, res) => {
  try {
    const { data: client, error } = await supabase
      .from("client_users")
      .select(
        "id,name,email,phone,blood_group,location,is_active,last_login_at,created_at,updated_at"
      )
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
/* -------------------- CLIENT LIVE PROFILE API -------------------- */

/*
 * Update the authenticated client's editable profile fields.
 *
 * Email is intentionally read-only here.
 * Password changes have their own authenticated endpoint.
 */
app.put("/api/client/profile", verifyClient, async (req, res) => {
  try {
    const clientId = req.client?.id;

    if (!clientId) {
      return res.status(401).json({
        success: false,
        message: "Client authentication is required",
      });
    }

    const name = String(req.body?.name || "").trim();
    const phone = String(req.body?.phone || "").trim();
    const bloodGroup = String(
      req.body?.bloodGroup ??
      req.body?.blood_group ??
      ""
    ).trim().toUpperCase();
    const location = String(req.body?.location || "").trim();

    if (name.length < 2 || name.length > 80) {
      return res.status(400).json({
        success: false,
        message: "Name must contain 2 to 80 characters.",
      });
    }

    if (phone && !/^\d{10}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        message: "Phone number must contain exactly 10 digits.",
      });
    }

    if (
      bloodGroup &&
      !["A+","A-","B+","B-","AB+","AB-","O+","O-"].includes(bloodGroup)
    ) {
      return res.status(400).json({
        success: false,
        message: "Please select a valid blood group.",
      });
    }

    if (location.length > 120) {
      return res.status(400).json({
        success: false,
        message: "Location must be 120 characters or fewer.",
      });
    }

    /*
     * Read the current profile first.
     *
     * This is important because pressing "Save Changes"
     * without actually changing anything must NOT generate
     * another "Profile updated" notification.
     */
    const {
      data: existingClient,
      error: existingClientError,
    } = await supabase
      .from("client_users")
      .select(
        "id,name,email,phone,blood_group,location,is_active,last_login_at,created_at,updated_at"
      )
      .eq("id", clientId)
      .single();

    if (existingClientError) {
      throw existingClientError;
    }

    if (!existingClient || !existingClient.is_active) {
      return res.status(404).json({
        success: false,
        message: "Client account not found.",
      });
    }

    /*
     * Normalize old and new values before comparison so that
     * null, empty strings and formatting differences do not
     * create unnecessary notifications.
     */
    const oldName = String(
      existingClient.name || ""
    ).trim();

    const oldPhone = String(
      existingClient.phone || ""
    ).trim();

    const oldBloodGroup = String(
      existingClient.blood_group || ""
    ).trim().toUpperCase();

    const oldLocation = String(
      existingClient.location || ""
    ).trim();

    const newName = name.trim();

    const newPhone = phone.trim();

    const newBloodGroup = bloodGroup.trim().toUpperCase();

    const newLocation = location.trim();

    const profileChanged =
      oldName !== newName ||
      oldPhone !== newPhone ||
      oldBloodGroup !== newBloodGroup ||
      oldLocation !== newLocation;

    /*
     * Nothing changed.
     *
     * Return the existing profile without creating a new
     * database notification.
     */
    if (!profileChanged) {
      return res.json({
        success: true,
        changed: false,
        message: "No profile changes were made.",
        client: publicClient(existingClient),
      });
    }

    /*
     * Actual profile change.
     */
    const { data: updatedClient, error } = await supabase
      .from("client_users")
      .update({
        name: newName,
        phone: newPhone || null,
        blood_group: newBloodGroup || null,
        location: newLocation || null,
      })
      .eq("id", clientId)
      .select(
        "id,name,email,phone,blood_group,location,is_active,last_login_at,created_at,updated_at"
      )
      .single();

    if (error) throw error;

    if (!updatedClient || !updatedClient.is_active) {
      return res.status(404).json({
        success: false,
        message: "Client account not found.",
      });
    }

    /*
     * Create exactly one notification for a real profile change.
     *
     * A real profile change should normally produce one notification.
     * This additional check prevents rapid/concurrent duplicate requests
     * from flooding the notification center.
     */
    try {
      if (typeof createClientNotification === "function") {
        const {
          data: recentProfileNotification,
          error: recentProfileNotificationError,
        } = await supabase
          .from("notifications")
          .select("id,created_at")
          .eq("recipient_id", clientId)
          .eq("recipient_type", "client")
          .eq("type", "profile_updated")
          .eq("title", "Profile updated")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (recentProfileNotificationError) {
          console.warn(
            "Profile notification duplicate check failed:",
            recentProfileNotificationError.message
          );
        }

        const lastNotificationTime =
          recentProfileNotification?.created_at
            ? new Date(recentProfileNotification.created_at).getTime()
            : 0;

        const notificationAge =
          lastNotificationTime > 0
            ? Date.now() - lastNotificationTime
            : Number.POSITIVE_INFINITY;

        const duplicateWindowMs = 5 * 60 * 1000;

        if (notificationAge >= duplicateWindowMs) {
          await createClientNotification({
            recipientId: clientId,
            type: "profile_updated",
            title: "Profile updated",
            message: "Your JharJeevan profile was updated successfully.",
            data: {
              clientId,
            },
          });

          console.log(
            `Profile update notification created for client ${clientId}.`
          );
        } else {
          console.log(
            `Skipped duplicate profile notification for client ${clientId}.`
          );
        }
      }
    } catch (notificationError) {
      console.warn(
        "Profile update notification failed:",
        notificationError?.message || notificationError
      );
    }
    return res.json({
      success: true,
      changed: true,
      message: "Profile updated successfully.",
      client: publicClient(updatedClient),
    });
  } catch (error) {
    console.error("Client profile update error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to update your profile right now.",
    });
  }
});



app.patch(
  "/api/client/notifications/read-all",
  verifyClient,
  async (req, res) => {
    try {

      const clientId = req.client?.id;

      if (!clientId) {
        return res.status(401).json({
          success: false,
          message: "Client authentication is required."
        });
      }

      const { error } = await supabase
        .from("notifications")
        .update({
          is_read: true,
          read_at: new Date().toISOString()
        })
        .eq("recipient_type", "client")
        .eq("recipient_id", clientId)
        .eq("is_read", false);

      if (error) {

        console.error("Mark-all-read database error:", error);

        return res.status(500).json({
          success: false,
          message: "Unable to update notifications."
        });
      }

      return res.json({
        success: true,
        message: "All notifications marked as read."
      });

    } catch (error) {

      console.error("Mark-all-read route error:", error);

      return res.status(500).json({
        success: false,
        message: "Unable to update notifications."
      });
    }
  }
);


/* -------------------- CLIENT BLOOD INVENTORY -------------------- */

app.get("/api/inventory", async (_req, res) => {
  try {
    const [
      { data: donors, error: donorError },
      { data: approved, error: requestError }
    ] = await Promise.all([
      supabase.from("donors").select("blood_group").eq("is_available", true),
      supabase.from("blood_requests").select("blood_group,units_required").eq("status", "Approved")
    ]);

    if (donorError) throw donorError;
    if (requestError) throw requestError;

    const inventory = Object.fromEntries(
      BLOOD_GROUPS.map((bg) => [bg, 0])
    );

    for (const donor of donors || []) {
      if (BLOOD_GROUPS.includes(donor.blood_group)) {
        inventory[donor.blood_group] += 1;
      }
    }

    for (const request of approved || []) {
      if (BLOOD_GROUPS.includes(request.blood_group)) {
        inventory[request.blood_group] = Math.max(
          0,
          inventory[request.blood_group] - Number(request.units_required || 0)
        );
      }
    }

    return res.json(inventory);
  } catch (error) {
    console.error("Inventory error:", error);

    return res.status(500).json({
      success: false,
      message: "Error fetching inventory"
    });
  }
});

async function startServer() {
  try {
    await initAdmin();

    app.listen(PORT, () => {
      console.log("\n" + "=".repeat(60));
      console.log("🚀 Jhar Jeevan Blood Bank - Supabase Edition");
      console.log("=".repeat(60));
      console.log(`📡 http://localhost:${PORT}`);
      console.log(`💚 http://localhost:${PORT}/api/health`);
      console.log("🗄️ Database: Supabase PostgreSQL");
      console.log("🔐 Admin auth: server-side JWT + Supabase admins table");
      console.log("=".repeat(60) + "\n");
    });

  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

if (require.main === "module") startServer();

if (require.main === module) startServer();
































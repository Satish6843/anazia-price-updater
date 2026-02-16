require("dotenv").config();

const express = require("express");
const session = require("express-session");
const nodemailer = require("nodemailer");
const fetch = require("node-fetch");

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

/* SESSION */

app.use(
  session({
    secret: "otp-secret",
    resave: false,
    saveUninitialized: true,
  })
);

/* MAIL */

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/* LOGIN */

app.get("/", (req, res) => {
  if (req.session.login) return res.redirect("/panel");

  res.send(`
<link rel="stylesheet" href="/style.css">
<div class="card">
<img src="/logo.png" class="logo"/>
<h2>Store Login</h2>

<form method="POST" action="/send-otp">
<input name="email" required placeholder="Enter Email"/>
<button>Send OTP</button>
</form>
</div>
`);
});

/* SEND OTP */

app.post("/send-otp", async (req, res) => {
  const otp = Math.floor(100000 + Math.random() * 900000);

  req.session.otp = otp;

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: req.body.email,
    subject: "OTP Login",
    text: `Your OTP is ${otp}`,
  });

  res.send(`
<link rel="stylesheet" href="/style.css">
<div class="card">
<h2>Enter OTP</h2>

<form method="POST" action="/verify">
<input name="otp" required/>
<button>Verify</button>
</form>
</div>
`);
});

/* VERIFY */

app.post("/verify", (req, res) => {
  if (req.body.otp == req.session.otp) {
    req.session.login = true;
    res.redirect("/panel");
  } else {
    res.send("Invalid OTP");
  }
});

/* PANEL */

app.get("/panel", (req, res) => {
  if (!req.session.login) return res.redirect("/");

  res.send(`
<link rel="stylesheet" href="/style.css">

<div class="card">
<img src="/logo.png" class="logo"/>

<h2>Price Updater</h2>

<form method="POST" action="/update">
<input name="gold" placeholder="Gold Rate" required/>
<input name="silver" placeholder="Silver Rate" required/>
<button>Update Prices</button>
</form>
</div>

<script>
window.addEventListener("beforeunload",()=>{
navigator.sendBeacon("/logout-auto");
});
</script>
`);
});

/* PRICE UPDATE */

app.post("/update", async (req, res) => {
  const gold = Number(req.body.gold);
  const silver = Number(req.body.silver);

  const products = await fetch(
    `https://${process.env.SHOP}/admin/api/2023-10/products.json`,
    {
      headers: {
        "X-Shopify-Access-Token": process.env.SHOPIFY_TOKEN,
      },
    }
  ).then((r) => r.json());

  for (const product of products.products) {
    for (const variant of product.variants) {
      await fetch(
        `https://${process.env.SHOP}/admin/api/2023-10/variants/${variant.id}.json`,
        {
          method: "PUT",
          headers: {
            "X-Shopify-Access-Token": process.env.SHOPIFY_TOKEN,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            variant: { id: variant.id, price: gold + silver },
          }),
        }
      );
    }
  }

  res.send("Prices Updated");
});

/* AUTO LOGOUT */

app.post("/logout-auto", (req, res) => {
  req.session.destroy();
});

/* SERVER */

const PORT = process.env.PORT || 3000;
app.listen(PORT);

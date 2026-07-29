/**
 * Restaurant AI Calling Agent - Backend Webhook
 * ------------------------------------------------
 * Ye server Vapi se aane wale "function call" requests ko handle karta hai.
 * Jab agent call ke beech mein checkMenuItem ya placeOrder function call karta hai,
 * Vapi is server ke /vapi/webhook endpoint par POST request bhejta hai.
 *
 * Setup:
 *   1. npm install express body-parser cors
 *   2. node server.js
 *   3. Isko deploy karo (Render, Railway, ya Vercel par) aur us URL ko
 *      vapi-assistant-config.json ke "serverUrl" field mein daalo.
 */

const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;
const ORDERS_FILE = path.join(__dirname, "orders.json");

// ---------------------------------------------
// Sample Menu Database (isko apni asli menu se replace karo,
// ya database/Google Sheet se connect kar sakte ho)
// ---------------------------------------------
const MENU = [
  { name: "Butter Chicken", price: 320, available: true },
  { name: "Veg Biryani", price: 220, available: true },
  { name: "Chicken Biryani", price: 260, available: true },
  { name: "Paneer Tikka", price: 250, available: true },
  { name: "Dal Makhani", price: 200, available: true },
  { name: "Tandoori Roti", price: 30, available: true },
  { name: "Gulab Jamun", price: 80, available: false },
  { name: "Cold Drink", price: 60, available: true },
];

// Simple fuzzy match function - customer "biryani" bole to "Chicken Biryani" bhi mil jaye
function findMenuItem(query) {
  const q = query.toLowerCase().trim();
  return MENU.find(
    (item) =>
      item.name.toLowerCase().includes(q) || q.includes(item.name.toLowerCase())
  );
}

// ---------------------------------------------
// Main Webhook Endpoint - Vapi yahan function calls bhejta hai
// ---------------------------------------------
app.post("/vapi/webhook", (req, res) => {
  const message = req.body.message;

  if (!message || message.type !== "function-call") {
    return res.json({ result: "No function call detected" });
  }

  const functionCall = message.functionCall;
  const { name, parameters } = functionCall;

  console.log(`Function called: ${name}`, parameters);

  if (name === "checkMenuItem") {
    return handleCheckMenuItem(parameters, res);
  }

  if (name === "placeOrder") {
    return handlePlaceOrder(parameters, res);
  }

  return res.json({ result: "Unknown function" });
});

// ---------------------------------------------
// Function: checkMenuItem
// ---------------------------------------------
function handleCheckMenuItem(params, res) {
  const item = findMenuItem(params.itemName);

  if (!item) {
    return res.json({
      result: `${params.itemName} humare menu mein nahi hai. Kripya koi aur item try karein.`,
    });
  }

  if (!item.available) {
    return res.json({
      result: `${item.name} abhi stock mein nahi hai. Kya aap kuch aur order karna chahenge?`,
    });
  }

  return res.json({
    result: `${item.name} available hai, price Rs. ${item.price} hai.`,
  });
}

// ---------------------------------------------
// Function: placeOrder
// ---------------------------------------------
function handlePlaceOrder(params, res) {
  const orderId = `ORD-${Date.now().toString().slice(-6)}`;

  const total = params.items.reduce(
    (sum, i) => sum + i.price * i.quantity,
    0
  );

  const order = {
    orderId,
    items: params.items,
    orderType: params.orderType,
    address: params.address || null,
    paymentMode: params.paymentMode,
    customerPhone: params.customerPhone || null,
    total,
    status: "received",
    createdAt: new Date().toISOString(),
  };

  // Order ko file mein save karo (production mein isko real database se replace karo)
  let orders = [];
  if (fs.existsSync(ORDERS_FILE)) {
    orders = JSON.parse(fs.readFileSync(ORDERS_FILE, "utf-8"));
  }
  orders.push(order);
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));

  console.log("New order placed:", order);

  const estimatedTime = params.orderType === "delivery" ? "30-40 minute" : "15-20 minute";

  return res.json({
    result: `Order confirm ho gaya hai. Order number hai ${orderId}, total Rs. ${total}. Estimated time: ${estimatedTime}.`,
  });
}

// ---------------------------------------------
// Health check + orders view (testing ke liye)
// ---------------------------------------------
app.get("/", (req, res) => {
  res.send("Restaurant AI Agent backend is running.");
});

app.get("/orders", (req, res) => {
  if (!fs.existsSync(ORDERS_FILE)) return res.json([]);
  res.json(JSON.parse(fs.readFileSync(ORDERS_FILE, "utf-8")));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

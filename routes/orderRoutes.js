const express = require("express");
const router = express.Router();
const { executeQuery } = require("../config/db");

// Get all orders
router.get("/", async (req, res) => {
  try {
    const orders = await executeQuery(`
      SELECT orders.id, orders.quantity, customers.name AS customer_name, 
             product_name AS product_name, price.price AS product_price, orders.total
      FROM orders 
      JOIN customers ON orders.customer_id = customers.id 
      JOIN product ON orders.product_id = product.id
      JOIN price ON product.id = price.product_id -- Join with price table
    `);
    res.status(200).json(orders);
  } catch (err) {
    console.error("Error fetching orders:", err);
    res.status(500).json({ message: "Error fetching orders" });
  }
});

// Create a new order
router.post("/", async (req, res) => {
  const { customer_id, product_id, quantity } = req.body;

  try {
    const productPrice = await executeQuery(
      "SELECT price FROM price WHERE product_id = ?", // Get price from price table
      [product_id]
    );
    const total = productPrice[0].price * quantity;

    const result = await executeQuery(
      "INSERT INTO orders (customer_id, product_id, quantity, total) VALUES (?, ?, ?, ?)",
      [customer_id, product_id, quantity, total]
    );

    res
      .status(201)
      .json({ message: "Order created successfully", id: result.insertId });
  } catch (err) {
    console.error("Error creating order:", err);
    res.status(500).json({ message: "Error creating order" });
  }
});

// Update an existing order
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { customer_id, product_id, quantity } = req.body;

  try {
    const productPrice = await executeQuery(
      "SELECT price FROM price WHERE product_id = ?", // Get price from price table
      [product_id]
    );
    const total = productPrice[0].price * quantity;

    await executeQuery(
      "UPDATE orders SET customer_id = ?, product_id = ?, quantity = ?, total = ? WHERE id = ?",
      [customer_id, product_id, quantity, total, id]
    );

    res.status(200).json({ message: "Order updated successfully" });
  } catch (err) {
    console.error("Error updating order:", err);
    res.status(500).json({ message: "Error updating order" });
  }
});

// Delete an order
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await executeQuery("DELETE FROM orders WHERE id = ?", [id]);
    res.status(200).json({ message: "Order deleted successfully" });
  } catch (err) {
    console.error("Error deleting order:", err);
    res.status(500).json({ message: "Error deleting order" });
  }
});

module.exports = router;
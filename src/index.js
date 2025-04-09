const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db.js");
require("dotenv").config();

connectDB();
const PORT = process.env.PORT || 4000; // Render sets process.env.PORT automatically
const app = express();
app.use(express.json());
app.use(cors());

app.use("/auth", require("./routes/authRoutes"));
app.use("/user", require("./routes/userRoutes"));

app.listen(PORT, () => console.log(`Server running on ${PORT}`));

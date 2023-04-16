const mongoose = require("mongoose");
const tokensSchema = new mongoose.Schema({
  access_token: String,
  refresh_token: String,
  expires_at: Number,
});

module.exports = mongoose.model("Tokens", tokensSchema);

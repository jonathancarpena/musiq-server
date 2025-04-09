const express = require("express");
const axios = require("axios");
const querystring = require("querystring");
require("dotenv").config();

const router = express.Router();

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI;
const FRONTEND_URI = process.env.FRONTEND_URI;

// Redirect user to Spotify for authentication
router.get("/login", (req, res) => {
  const scope =
    "user-read-private user-read-email playlist-modify-private playlist-modify-public user-top-read user-read-recently-played ugc-image-upload";

  const authUrl =
    `https://accounts.spotify.com/authorize?` +
    querystring.stringify({
      response_type: "code",
      client_id: CLIENT_ID,
      scope,
      redirect_uri: REDIRECT_URI,
    });

  res.redirect(authUrl);
});

// Handle callback & get access token
router.get("/callback", async (req, res) => {
  const code = req.query.code || null;

  try {
    const tokenResponse = await axios.post(
      "https://accounts.spotify.com/api/token",
      querystring.stringify({
        code,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")}`,
        },
      }
    );

    const accessToken = tokenResponse.data.access_token;

    res.redirect(`${FRONTEND_URI}?access_token=${accessToken}`);
  } catch (error) {
    res.status(500).send("Error getting token");
  }
});

module.exports = router;

module.exports = (req, res, next) => {
    const accessToken = req.query.access_token || req.headers.authorization?.split(" ")[1];
    if (!accessToken) {
      return res.status(401).json({ error: "Unauthorized: Missing access token" });
    }
  
    req.accessToken = accessToken;
    next();
  };
  
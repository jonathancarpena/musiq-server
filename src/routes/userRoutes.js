const express = require("express");
const {
  getUserProfile,
  getTopTracks,
  getTopArtists,
  getRecentlyPlayed,
  getTopGenres,
} = require("../services/spotifyServices");
const authMiddleware = require("../middleware/authMiddleware");
const { User } = require("../Schema");
const path = require("path");
const axios = require("axios");
const fs = require("fs");

const router = express.Router();

// Fetch User Profile
router.get("/profile", authMiddleware, async (req, res) => {
  const userProfile = await getUserProfile(req.accessToken);
  if (!userProfile)
    return res.status(500).json({ error: "Failed to fetch user profile" });
  let user = await User.findOne({ id: userProfile.id });
  if (!user) {
    user = new User(userProfile);
    await user.save();
  }

  res.json(userProfile);
});
const timeRanges = ["short_term", "medium_term", "long_term"];
function formatDateAndSince(isoDate) {
  const date = new Date(isoDate);
  const now = new Date();

  const formattedDate = date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const diffMs = now - date;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  let since;
  if (diffYears > 0) {
    since = `${diffYears} year${diffYears > 1 ? "s" : ""} ago`;
  } else if (diffMonths > 0) {
    since = `${diffMonths} month${diffMonths > 1 ? "s" : ""} ago`;
  } else if (diffDays > 0) {
    since = `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  } else if (diffHours > 0) {
    since = `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  } else if (diffMinutes > 0) {
    since = `${diffMinutes} minute${diffMinutes > 1 ? "s" : ""} ago`;
  } else {
    since = "just now";
  }

  return { date: formattedDate, since };
}
function groupTracksByDate(entries) {
  return entries.reduce((acc, entry) => {
    const { date, since } = formatDateAndSince(entry.played_at);
    const updatedEntry = { ...entry, since }; // Add 'since' field to entry

    if (!acc[date]) {
      acc[date] = [];
    }

    acc[date].push(updatedEntry);
    return acc;
  }, {});
}

// COMPARE

// TRACKS
function dedupeTracks(tracks) {
  const seen = new Set();
  return tracks.filter((track) => {
    if (seen.has(track.id)) return false;
    seen.add(track.id);
    return true;
  });
}

function compareCombinedTopTracks(userATopData, userBTopData) {
  const allRanges = ["short_term", "medium_term", "long_term"];

  const userATracks = dedupeTracks(
    allRanges.flatMap((range) => userATopData?.top_tracks?.[range] || [])
  );
  const userBTracks = dedupeTracks(
    allRanges.flatMap((range) => userBTopData?.top_tracks?.[range] || [])
  );

  return compareTopTracks(userATracks, userBTracks);
}

function compareTopTracks(userATracks, userBTracks) {
  const userATrackIds = userATracks.map((t) => t.id);
  const userBTrackIds = userBTracks.map((t) => t.id);

  const sharedTrackIds = userATrackIds.filter((id) =>
    userBTrackIds.includes(id)
  );
  const sharedTracks = userATracks.filter((t) => sharedTrackIds.includes(t.id));

  const totalUnique = new Set([...userATrackIds, ...userBTrackIds]).size;
  const percentageOverlap = (sharedTrackIds.length / totalUnique) * 100;

  // Bonus: Ranking weight
  let rankingScore = 0;
  sharedTrackIds.forEach((id) => {
    const indexA = userATrackIds.indexOf(id);
    const indexB = userBTrackIds.indexOf(id);
    const normA = 1 - indexA / userATrackIds.length;
    const normB = 1 - indexB / userBTrackIds.length;
    rankingScore += (normA + normB) / 2;
  });
  const scoreByRanking =
    sharedTrackIds.length > 0 ? rankingScore / sharedTrackIds.length : 0;

  // 0.8 – 1.0	Strong match – they love the same songs in the same order.
  // 0.5 – 0.8	Solid match – decent overlap with some high-ranking similarity.
  // 0.2 – 0.5	Mild match – maybe a few common tracks, but not in top slots.
  // < 0.2	Weak match – overlap is shallow or low-ranked.
  return {
    sharedTracks,
    percentageOverlap,
    scoreByRanking,
  };
}

// ARTISTS
function dedupeArtists(artists) {
  const seen = new Set();
  return artists.filter((artist) => {
    if (seen.has(artist.id)) return false;
    seen.add(artist.id);
    return true;
  });
}

function compareCombinedTopArtists(userATopData, userBTopData) {
  const timeRanges = ["short_term", "medium_term", "long_term"];

  const allA = dedupeArtists(
    timeRanges.flatMap((range) => userATopData?.top_artists?.[range] || [])
  );
  const allB = dedupeArtists(
    timeRanges.flatMap((range) => userBTopData?.top_artists?.[range] || [])
  );

  return compareTopArtists(allA, allB);
}

function compareTopArtists(userAArtists, userBArtists) {
  const userAIds = userAArtists.map((artist) => artist.id);
  const userBIds = userBArtists.map((artist) => artist.id);

  const sharedIds = userAIds.filter((id) => userBIds.includes(id));
  const sharedArtists = userAArtists.filter((artist) =>
    sharedIds.includes(artist.id)
  );

  const totalUnique = new Set([...userAIds, ...userBIds]).size;
  const percentageOverlap = (sharedIds.length / totalUnique) * 100;

  // Ranking weight
  let rankingScore = 0;
  sharedIds.forEach((id) => {
    const indexA = userAIds.indexOf(id);
    const indexB = userBIds.indexOf(id);
    const normA = 1 - indexA / userAIds.length;
    const normB = 1 - indexB / userBIds.length;
    rankingScore += (normA + normB) / 2;
  });
  const scoreByRanking =
    sharedIds.length > 0 ? rankingScore / sharedIds.length : 0;

  return {
    sharedArtists,
    percentageOverlap,
    scoreByRanking,
  };
}

// GENRES
function mergeGenreCounts(topGenres) {
  const merged = {};

  const ranges = ["short_term", "medium_term", "long_term"];
  for (const range of ranges) {
    const rangeGenres = topGenres?.[range] || {};
    for (const genre in rangeGenres) {
      merged[genre] = (merged[genre] || 0) + rangeGenres[genre];
    }
  }

  return merged;
}
function compareTopGenres(userAGenres, userBGenres) {
  const genreA = mergeGenreCounts(userAGenres);
  const genreB = mergeGenreCounts(userBGenres);

  const allGenres = new Set([...Object.keys(genreA), ...Object.keys(genreB)]);
  const sharedGenres = [...allGenres].filter(
    (genre) => genreA[genre] && genreB[genre]
  );

  // Overlap
  const percentageOverlap = (sharedGenres.length / allGenres.size) * 100;

  // Score by frequency (optional: normalize weights)
  let scoreSum = 0;
  sharedGenres.forEach((genre) => {
    const aWeight = genreA[genre];
    const bWeight = genreB[genre];
    const avg = (aWeight + bWeight) / 2;
    scoreSum += avg;
  });

  // Normalize score to [0, 1] scale
  const totalA = Object.values(genreA).reduce((a, b) => a + b, 0);
  const totalB = Object.values(genreB).reduce((a, b) => a + b, 0);
  const maxPossibleScore = (totalA + totalB) / 2;
  const scoreByRanking = maxPossibleScore > 0 ? scoreSum / maxPossibleScore : 0;

  return {
    sharedGenres: sharedGenres.sort((a, b) => {
      // Sort by combined importance
      const scoreA = (genreA[a] || 0) + (genreB[a] || 0);
      const scoreB = (genreA[b] || 0) + (genreB[b] || 0);
      return scoreB - scoreA;
    }),
    percentageOverlap,
    scoreByRanking,
  };
}

// POPULARITY SCORE
function calculateTrackPopularity(topData) {
  const timeRanges = ["short_term", "medium_term", "long_term"];
  let totalPopularity = 0;
  let count = 0;

  timeRanges.forEach((range) => {
    const tracks = topData?.top_tracks?.[range] || [];
    tracks.forEach((track) => {
      if (typeof track.popularity === "number") {
        totalPopularity += track.popularity;
        count++;
      }
    });
  });

  return count > 0 ? totalPopularity / count : 0;
}

function calculateArtistPopularity(topData) {
  const timeRanges = ["short_term", "medium_term", "long_term"];
  let totalPopularity = 0;
  let count = 0;

  timeRanges.forEach((range) => {
    const artists = topData?.top_artists?.[range] || [];
    artists.forEach((artist) => {
      if (typeof artist.popularity === "number") {
        totalPopularity += artist.popularity;
        count++;
      }
    });
  });

  return count > 0 ? totalPopularity / count : 0;
}

function calculateOverallPopularity(topData) {
  const trackPopularity = calculateTrackPopularity(topData);
  const artistPopularity = calculateArtistPopularity(topData);
  return (trackPopularity + artistPopularity) / 2;
}

// EXPLICIT
function calculateExplicitPercentage(topData) {
  const timeRanges = ["short_term", "medium_term", "long_term"];
  let explicitCount = 0;
  let totalTracks = 0;

  timeRanges.forEach((range) => {
    const tracks = topData?.top_tracks?.[range] || [];
    tracks.forEach((track) => {
      if (track.explicit) explicitCount++;
      totalTracks++;
    });
  });

  return totalTracks > 0 ? (explicitCount / totalTracks) * 100 : 0;
}

// RELEASE YEAR
function getAverageReleaseYear(topData) {
  const timeRanges = ["short_term", "medium_term", "long_term"];
  let totalYears = 0;
  let trackCount = 0;

  timeRanges.forEach((range) => {
    const tracks = topData?.top_tracks?.[range] || [];
    tracks.forEach((track) => {
      const releaseYear = track.album.release_date.split("-")[0]; // Extract year
      if (releaseYear && !isNaN(releaseYear)) {
        totalYears += parseInt(releaseYear);
        trackCount++;
      }
    });
  });

  return trackCount > 0 ? totalYears / trackCount : 2025; // Default to 2025 if no tracks found
}
function calculateTimeTravelerScore(topData) {
  const averageYear = getAverageReleaseYear(topData);
  const currentYear = new Date().getFullYear();

  const yearsBehind = currentYear - averageYear; // Positive means older music, negative means newer music

  return {
    averageReleaseYear: averageYear,
    yearsBehind: yearsBehind,
  };
}

// MERGE TOP TRACKS
function mergeTopTracks(userAData, userBData, limit = 25) {
  const timeRanges = ["short_term", "medium_term", "long_term"];
  const mergedPlaylists = {};

  for (const range of timeRanges) {
    const userATracks = userAData?.top_tracks?.[range]?.slice(0, limit) || [];
    const userBTracks = userBData?.top_tracks?.[range]?.slice(0, limit) || [];

    const maxLength = Math.max(userATracks.length, userBTracks.length);
    const interleavedTracks = [];

    for (let i = 0; i < maxLength; i++) {
      if (i < userATracks.length) {
        interleavedTracks.push(userATracks[i]);
      }
      if (i < userBTracks.length) {
        interleavedTracks.push(userBTracks[i]);
      }
    }

    // Remove duplicates by track ID, preserving order
    const uniqueTracksMap = new Map();
    interleavedTracks.forEach((track) => {
      if (!uniqueTracksMap.has(track.id)) {
        uniqueTracksMap.set(track.id, track);
      }
    });

    const uniqueTracks = Array.from(uniqueTracksMap.values());
    mergedPlaylists[range] = uniqueTracks;
  }

  return mergedPlaylists;
}

// Fetch User's Top Data
router.get("/top-data", authMiddleware, async (req, res) => {
  const shortTermTracks = await getTopTracks(req.accessToken, "short_term");
  const mediumTermTracks = await getTopTracks(req.accessToken, "medium_term");
  const longTermTracks = await getTopTracks(req.accessToken, "long_term");

  const shortTermArtists = await getTopArtists(req.accessToken, "short_term");
  const mediumTermArtists = await getTopArtists(req.accessToken, "medium_term");
  const longTermArtists = await getTopArtists(req.accessToken, "long_term");

  const recentlyPlayed = await getRecentlyPlayed(req.accessToken);

  let top_genres = {
    short_term: {},
    medium_term: {},
    long_term: {},
  };

  if (shortTermArtists || mediumTermArtists || longTermArtists) {
    top_genres = getTopGenres({
      shortTerm: shortTermArtists,
      mediumTerm: mediumTermArtists,
      longTerm: longTermArtists,
    });
  }

  const topData = {
    top_tracks: {
      short_term: shortTermTracks,
      medium_term: mediumTermTracks,
      long_term: longTermTracks,
    },
    top_artists: {
      short_term: shortTermArtists,
      medium_term: mediumTermArtists,
      long_term: longTermArtists,
    },
    top_genres,
    recentlyPlayed: groupTracksByDate(recentlyPlayed),
  };
  let user = await User.findOne({ id: req.query.id });
  if (!user) {
    res.status(404).json({ error: "User not found" });
  } else {
    await User.findByIdAndUpdate(
      user._id, // Use user's MongoDB _id
      { $set: { topData } }, // Update topData field
      { new: true, upsert: true } // Return updated document and create if not exists
    );
  }

  res.json(topData);
});

// Save User's Playlist
router.post("/save-playlist", authMiddleware, async (req, res) => {
  const { name, description, trackUris } = req.body;

  if (!name || !description || !trackUris || trackUris.length === 0) {
    return res.status(400).json({ error: "Invalid request data" });
  }

  try {
    // Get User ID
    const userProfile = await getUserProfile(req.accessToken);
    if (!userProfile) {
      return res.status(500).json({ error: "Failed to fetch user profile" });
    }

    const userId = userProfile.id;

    // Create Playlist
    const playlistResponse = await axios.post(
      `https://api.spotify.com/v1/users/${userId}/playlists`,
      { name, description, public: false },
      { headers: { Authorization: `Bearer ${req.accessToken}` } }
    );

    const playlistId = playlistResponse.data.id;

    // Set Default Cover Image if None Provided
    const defaultCoverImagePath = path.join(__dirname, "../assets/cover.jpg");

    try {
      // Read the image file from backend folder
      const imageBuffer = fs.readFileSync(defaultCoverImagePath);
      const imageBase64 = imageBuffer.toString("base64"); // Convert to base64 string

      // Upload the cover image to Spotify
      await axios.put(
        `https://api.spotify.com/v1/playlists/${playlistId}/images`,
        imageBase64,
        {
          headers: {
            Authorization: `Bearer ${req.accessToken}`, // Fixed variable name
            "Content-Type": "image/jpeg",
          },
        }
      );
    } catch (error) {
      console.error(
        "Error uploading cover image:",
        error.response ? error.response.data : error.message
      );
    }

    // Add Tracks to Playlist
    await axios.post(
      `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
      { uris: trackUris },
      { headers: { Authorization: `Bearer ${req.accessToken}` } }
    );
    res.json({ message: "Playlist created successfully!", playlistId });
  } catch (error) {
    console.error(
      "Error creating playlist:",
      error.response ? error.response.data : error.message
    );
    res
      .status(500)
      .json({ error: "Failed to create playlist", details: error.message });
  }
});

// Search User
router.get("/search", async (req, res) => {
  try {
    const searchQuery = req.query.username;
    const userDisplayQuery = req.query.userDisplay;
    const userIdQuery = req.query.userId;
    if (!searchQuery) return res.json([]);

    const filter = {
      $or: [
        { id: { $regex: searchQuery, $options: "i" } }, // Case-insensitive ID search
        { display_name: { $regex: searchQuery, $options: "i" } }, // Case-insensitive display name search
      ],
    };

    // Exclude users with specific userId or display name
    if (userDisplayQuery || userIdQuery) {
      filter.$and = [];

      if (userDisplayQuery) {
        filter.$and.push({ display_name: { $ne: userDisplayQuery } });
      }
      if (userIdQuery) {
        filter.$and.push({ id: { $ne: userIdQuery } });
      }
    }

    const users = await User.find(filter).limit(10); // Limit results for performance

    res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Compare Users
router.post("/compare", authMiddleware, async (req, res) => {
  const { userId, otherUserId } = req.body;
  if (!userId || !otherUserId) {
    return res.status(400).json({ error: "Invalid request data" });
  }

  try {
    const userA = await User.findOne({ id: userId });
    const userB = await User.findOne({ id: otherUserId });

    if (!userA || !userB) {
      return res.status(404).json({ message: "One or both users not found" });
    }

    const trackComparison = compareCombinedTopTracks(
      userA.topData,
      userB.topData
    );
    const artistComparison = compareCombinedTopArtists(
      userA.topData,
      userB.topData
    );
    const genreComparison = compareTopGenres(
      userA.topData?.top_genres,
      userB.topData?.top_genres
    );

    const userAPopularity = calculateOverallPopularity(userA.topData);
    const userBPopularity = calculateOverallPopularity(userB.topData);

    const userAExplicit = calculateExplicitPercentage(userA.topData);
    const userBExplicit = calculateExplicitPercentage(userB.topData);

    const userATimeTravel = calculateTimeTravelerScore(userA.topData);
    const userBTimeTravel = calculateTimeTravelerScore(userB.topData);

    const merged = mergeTopTracks(userA.topData, userB.topData);

    res.json({
      tracks: trackComparison,
      artists: artistComparison,
      genres: genreComparison,
      popularity: { userA: userAPopularity, userB: userBPopularity },
      explicit: { userA: userAExplicit, userB: userBExplicit },
      timeTravel: { userA: userATimeTravel, userB: userBTimeTravel },
      merged,
      userB,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Update User Shared Playlist
router.post("/allowSharedPlaylist", authMiddleware, async (req, res) => {
  let user = await User.findOne({ id: req.query.id });
  if (!user) {
    return res.status(500).json({ error: "Failed to fetch user profile" });
  }

  try {
    const { allowSharedPlaylist } = req.body; // <-- Get toggle state from frontend

    const updatedUser = await User.findByIdAndUpdate(
      user._id,
      { $set: { allowSharedPlaylist } },
      { new: true }
    );

    res.status(200).json({
      message: "User updated successfully",
      user: updatedUser,
    });
  } catch (err) {
    console.error("Error updating user:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
module.exports = router;

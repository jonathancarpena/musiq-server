const axios = require("axios");

// Define the Spotify API base URL
const SPOTIFY_API_BASE = "https://api.spotify.com/v1";

// Function to get the user's profile data from Spotify API
const getUserProfile = async (accessToken) => {
 
  try {
    const response = await axios.get(`${SPOTIFY_API_BASE}/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching user profile:", error.response || error.message);
    return null;
  }
};

// Function to get the user's playlists
const getUserPlaylists = async (accessToken) => {
  try {
    const response = await axios.get(`${SPOTIFY_API_BASE}/me/playlists`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching user playlists:", error.response || error.message);
    return null;
  }
};

// Function to get the user's top tracks (can be filtered by time range: short_term, medium_term, long_term)
const getTopTracks = async (accessToken, timeRange = "short_term") => {
  try {
    const response = await axios.get(
      `${SPOTIFY_API_BASE}/me/top/tracks?time_range=${timeRange}&limit=50`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    return response.data.items;
  } catch (error) {
    console.error("Error fetching top tracks:", error.response || error.message);
    return [];
  }
};

// Function to get the user's top artists (can be filtered by time range: short_term, medium_term, long_term)
const getTopArtists = async (accessToken, timeRange = "short_term") => {
  try {
    const response = await axios.get(
      `${SPOTIFY_API_BASE}/me/top/artists?time_range=${timeRange}&limit=50`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    return response.data.items;
  } catch (error) {
    console.error("Error fetching top artists:", error.response || error.message);
    return [];
  }
};

// Function to get the recently played tracks of a user
const getRecentlyPlayed = async (accessToken) => {
  try {
    const response = await axios.get(
      `${SPOTIFY_API_BASE}/me/player/recently-played?limit=50`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    return response.data.items;
  } catch (error) {
    console.error("Error fetching recently played tracks:", error.response || error.message);
    return [];
  }
};

// Function to get the top genres from the user's top artists data
const getTopGenres = (topArtists) => {
  let genreCounter = {
    shortTerm: {},
    mediumTerm: {},
    longTerm: {},
  };

  // Count genres based on top artists data for different time ranges
  if (topArtists.hasOwnProperty("shortTerm")) {
    topArtists.shortTerm.forEach((artist) => {
      artist.genres.forEach((genre) => {
        genreCounter["shortTerm"][genre] = (genreCounter["shortTerm"][genre] || 0) + 1;
      });
    });
  }

  if (topArtists.hasOwnProperty("mediumTerm")) {
    topArtists.mediumTerm.forEach((artist) => {
      artist.genres.forEach((genre) => {
        genreCounter["mediumTerm"][genre] = (genreCounter["mediumTerm"][genre] || 0) + 1;
      });
    });
  }

  if (topArtists.hasOwnProperty("longTerm")) {
    topArtists.longTerm.forEach((artist) => {
      artist.genres.forEach((genre) => {
        genreCounter["longTerm"][genre] = (genreCounter["longTerm"][genre] || 0) + 1;
      });
    });
  }

  // Sort and return the genres by count
  const sortGenres = (genres) => {
    return Object.entries(genres)
      .sort((a, b) => b[1] - a[1])
      .reduce((sorted, [genre, count]) => ({ ...sorted, [genre]: count }), {});
  };

  return {
    short_term: sortGenres(genreCounter.shortTerm),
    medium_term: sortGenres(genreCounter.mediumTerm),
    long_term: sortGenres(genreCounter.longTerm),
  };
};

module.exports = {
  getUserProfile,
  getUserPlaylists,
  getTopTracks,
  getTopArtists,
  getRecentlyPlayed,
  getTopGenres,
};

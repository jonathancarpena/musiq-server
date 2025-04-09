const mongoose = require("mongoose");

const ImageSchema = new mongoose.Schema({
  height: Number,
  url: String,
  width: Number,
});

const SpotifyPlaylistItemSchema = new mongoose.Schema({
  collaborative: Boolean,
  description: String,
  href: String,
  id: { type: String, unique: true },
  images: [ImageSchema],
  name: String,
  owner: {
    display_name: String,
    href: String,
    id: String,
  },
  public: Boolean,
  tracks: {
    href: String,
    total: Number,
  },
});

const UserSchema = new mongoose.Schema({
  display_name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  followers: {
    total: Number,
  },
  id: { type: String, required: true, unique: true },
  product: { type: String, enum: ["free", "premium", "family", "student"] },
  images: [ImageSchema],
  dateReceived: { type: Date, default: Date.now },
  token: String,
  topData: {
    type: mongoose.Schema.Types.Mixed, // Store dynamic TopData as JSON
  },
  allowSharedPlaylist: { type: Boolean, required: false, default: true },
});

const TrackSchema = new mongoose.Schema({
  album: {
    artists: [{ name: String, id: String }],
    id: String,
    images: [ImageSchema],
    name: String,
    release_date: String,
  },
  artists: [{ name: String, id: String }],
  duration_ms: Number,
  explicit: Boolean,
  id: { type: String, unique: true },
  name: String,
  popularity: Number,
});

const ArtistSchema = new mongoose.Schema({
  followers: {
    total: Number,
  },
  genres: [String],
  href: String,
  id: { type: String, unique: true },
  images: [ImageSchema],
  name: String,
  popularity: Number,
});

const RecentlyPlayedTrackSchema = new mongoose.Schema({
  played_at: Date,
  track: TrackSchema,
  since: String,
});

const TopDataSchema = new mongoose.Schema({
  top_tracks: {
    short_term: [TrackSchema],
    medium_term: [TrackSchema],
    long_term: [TrackSchema],
  },
  top_artists: {
    short_term: [ArtistSchema],
    medium_term: [ArtistSchema],
    long_term: [ArtistSchema],
  },
  top_genres: {
    short_term: mongoose.Schema.Types.Mixed,
    medium_term: mongoose.Schema.Types.Mixed,
    long_term: mongoose.Schema.Types.Mixed,
  },
  recentlyPlayed: mongoose.Schema.Types.Mixed,
});

const Image = mongoose.model("Image", ImageSchema);
const SpotifyPlaylistItem = mongoose.model(
  "SpotifyPlaylistItem",
  SpotifyPlaylistItemSchema
);
const User = mongoose.model("User", UserSchema);
const Track = mongoose.model("Track", TrackSchema);
const Artist = mongoose.model("Artist", ArtistSchema);
const TopData = mongoose.model("TopData", TopDataSchema);

module.exports = { Image, SpotifyPlaylistItem, User, Track, Artist, TopData };

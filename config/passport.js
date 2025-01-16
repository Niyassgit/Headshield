const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/userSchema");
const env = require("dotenv").config();

passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID || "your-google-client-id",
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || "your-google-client-secret",
            callbackURL: "/auth/google/callback",
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                // Check if the user already exists
                let user = await User.findOne({ googleId: profile.id });

                if (user) {
                    // Existing user found
                    return done(null, user);
                } else {
                    // Create a new user
                    user = new User({
                        name: profile.displayName,
                        email: profile.emails && profile.emails[0].value, // Get the first email
                        googleId: profile.id,
                    });
                    await user.save();
                    return done(null, user);
                }
            } catch (error) {
                console.error("Error during Google authentication:", error);
                return done(error, null);
            }
        }
    )
);

// Serialize user for session
passport.serializeUser((user, done) => {
    done(null, user.id); // Store the user's ID in the session
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

module.exports = passport;

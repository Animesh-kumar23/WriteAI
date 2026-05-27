const jwt = require("jsonwebtoken");
const ENV = require("../configs/env");
const User = require("../models/User");

const isProduction = ENV.NODE_ENV === "production";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "None" : "Lax",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: "/",
};

function setAuthCookie(res, userId) {
  const token = jwt.sign({ id: userId }, ENV.JWT_SECRET_KEY, {
    expiresIn: "7d",
  });
  res.cookie("token", token, COOKIE_OPTIONS);
  return token; // returned so callers can include it in the response body
}

async function registerUser(req, res) {
  try {
    const { name, email, password } = req.body;
    const normalizedEmail = email?.trim().toLowerCase();

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Required fields are missing!" });
    }

    const userExists = await User.findOne({ email: normalizedEmail });

    if (userExists) {
      return res.status(409).json({ error: "Email already registered!" });
    }

    const user = await User.create({ name, email: normalizedEmail, password });

    const token = setAuthCookie(res, user._id);

    return res.status(201).json({
      message: "User registered successfully!",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
      },
      token,
    });
  } catch (error) {
    console.error("Error registering user:", error);
    return res.status(500).json({ error: "Internal Server Error!" });
  }
}

async function signInUser(req, res) {
  try {
    const { email, password } = req.body;
    const normalizedEmail = email?.trim().toLowerCase();

    if (!email || !password) {
      return res.status(400).json({ error: "Required fields are missing!" });
    }

    const user = await User.findOne({ email: normalizedEmail }).select(
      "+password"
    );

    if (!user || !(await user.passwordsMatch(password))) {
      return res.status(401).json({ error: "Invalid credentials!" });
    }

    const token = setAuthCookie(res, user._id);

    return res.status(200).json({
      message: "User signed in successfully!",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
      },
      token,
    });
  } catch (error) {
    console.error("Error signing in user:", error);
    return res.status(500).json({ error: "Internal Server Error!" });
  }
}

async function logoutUser(req, res) {
  res.clearCookie("token", {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "None" : "Lax",
    path: "/",
  });
  return res.status(200).json({ message: "Logged out successfully!" });
}

async function getMe(req, res) {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ error: "User not found!" });
    }

    return res.status(200).json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    console.error("Error in getMe:", error);
    return res.status(500).json({ error: "Internal Server Error!" });
  }
}

module.exports = { registerUser, signInUser, logoutUser, getMe };
